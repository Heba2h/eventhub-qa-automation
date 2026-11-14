import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { createApiContext } from '@api/client';
import { EventHubApi } from '@api/EventHubApi';
import { loadSession, storageStatePath, type Role, type StoredSession, type UserRole } from '@auth';
import { TestDataSeeder } from '@data/testData';
import { EventDetailsPage } from '@pages/EventDetailsPage';
import { EventsPage } from '@pages/EventsPage';
import { MyBookingsPage } from '@pages/MyBookingsPage';

// ---------------------------------------------------------------------------------------------
// Session pool: authenticated API clients per role + automatic cleanup of created data
// ---------------------------------------------------------------------------------------------

type ResourceKind = 'event' | 'booking';

interface TrackedResource {
  role: Role;
  kind: ResourceKind;
  id: number;
}

/**
 * Per-test registry of authenticated API clients and the server-side data they created.
 *
 * - Clients are created lazily per role from the session written by the setup project,
 *   so a test can act as several users (e.g. owner vs. intruder) without touching tokens.
 * - Every successful create is recorded and removed in teardown: bookings first, then events
 *   (deleting an event also cascades to its bookings). Already-deleted data (404) is fine.
 */
class ApiSessionPool {
  private readonly sessions = new Map<Role, Promise<{ context: APIRequestContext; api: EventHubApi }>>();
  private readonly resources: TrackedResource[] = [];

  async get(role: Role): Promise<EventHubApi> {
    let session = this.sessions.get(role);
    if (!session) {
      session = this.open(role);
      this.sessions.set(role, session);
    }
    return (await session).api;
  }

  track(role: Role, kind: ResourceKind, id: number): void {
    if (!this.resources.some((r) => r.kind === kind && r.id === id)) this.resources.push({ role, kind, id });
  }

  /** Returns human-readable problems instead of throwing, so cleanup never masks the real test result. */
  async cleanup(): Promise<string[]> {
    const problems: string[] = [];
    const ordered = [
      ...this.resources.filter((r) => r.kind === 'booking').reverse(),
      ...this.resources.filter((r) => r.kind === 'event').reverse(),
    ];
    for (const resource of ordered) {
      try {
        const api = await this.get(resource.role);
        const response =
          resource.kind === 'booking' ? await api.bookings.cancel(resource.id) : await api.events.remove(resource.id);
        if (response.status !== 200 && response.status !== 404) {
          problems.push(`${resource.kind} #${resource.id}: HTTP ${response.status}`);
        }
      } catch (error) {
        problems.push(`${resource.kind} #${resource.id}: ${(error as Error).message}`);
      }
    }
    this.resources.length = 0;
    return problems;
  }

  async dispose(): Promise<void> {
    const sessions = await Promise.allSettled(this.sessions.values());
    await Promise.all(sessions.map((s) => (s.status === 'fulfilled' ? s.value.context.dispose() : undefined)));
    this.sessions.clear();
  }

  private async open(role: Role) {
    const token = role === 'anonymous' ? undefined : loadSession(role).token;
    const context = await createApiContext(token);
    const api = new EventHubApi(context, (kind, id) => this.track(role, kind, id));
    return { context, api };
  }
}

// ---------------------------------------------------------------------------------------------
// Fixtures: what a test can ask for
// ---------------------------------------------------------------------------------------------

export interface FrameworkOptions {
  /**
   * Identity the test runs as, for both `api` and the browser `page`.
   * Default "primary". Override per file/describe with `test.use({ role: 'anonymous' })`.
   */
  role: Role;
}

export interface FrameworkFixtures {
  /** API clients authenticated as `role`. */
  api: EventHubApi;
  /** API clients for any other identity — for multi-user scenarios (ownership, isolation). */
  apiAs: (role: Role) => Promise<EventHubApi>;
  /** Identity details of `role` (email, userId). Not available for "anonymous". */
  currentUser: StoredSession;
  /** Creates preconditions via the API; all created data is cleaned up automatically. */
  seed: TestDataSeeder;
  eventsPage: EventsPage;
  eventDetailsPage: EventDetailsPage;
  myBookingsPage: MyBookingsPage;
  /** @internal */
  apiPool: ApiSessionPool;
}

const BOOKING_CREATE_PATH = /\/api\/bookings\/?$/;

export const test = base.extend<FrameworkOptions & FrameworkFixtures>({
  role: ['primary', { option: true }],

  apiPool: async ({}, use, testInfo) => {
    const pool = new ApiSessionPool();
    await use(pool);
    const problems = await pool.cleanup();
    if (problems.length) {
      testInfo.annotations.push({ type: 'cleanup-warning', description: problems.join('; ') });
    }
    await pool.dispose();
  },

  api: async ({ apiPool, role }, use) => {
    await use(await apiPool.get(role));
  },

  apiAs: async ({ apiPool }, use) => {
    await use((role) => apiPool.get(role));
  },

  currentUser: async ({ role }, use) => {
    if (role === 'anonymous') throw new Error('currentUser is not available when role is "anonymous"');
    await use(loadSession(role));
  },

  seed: async ({ apiPool, role }, use) => {
    // Anonymous tests still need data to exist; it is owned by the primary user.
    const owner: UserRole = role === 'anonymous' ? 'primary' : role;
    await use(new TestDataSeeder(await apiPool.get(owner)));
  },

  // Browser contexts start already authenticated as `role` — no UI login in tests.
  storageState: async ({ role }, use) => {
    await use(role === 'anonymous' ? { cookies: [], origins: [] } : storageStatePath(role));
  },

  // Bookings made through the UI are registered for cleanup exactly like API-created ones.
  page: async ({ page, role, apiPool }, use) => {
    if (role !== 'anonymous') {
      page.on('response', async (response) => {
        if (response.request().method() !== 'POST' || response.status() !== 201) return;
        if (!BOOKING_CREATE_PATH.test(new URL(response.url()).pathname)) return;
        const body = (await response.json().catch(() => undefined)) as { data?: { id?: number } } | undefined;
        if (body?.data?.id) apiPool.track(role, 'booking', body.data.id);
      });
    }
    await use(page);
  },

  eventsPage: async ({ page }, use) => use(new EventsPage(page)),
  eventDetailsPage: async ({ page }, use) => use(new EventDetailsPage(page)),
  myBookingsPage: async ({ page }, use) => use(new MyBookingsPage(page)),
});

export { expect };
