import { test as teardown } from '@fixtures';
import { ALL_USER_ROLES } from '@auth';
import { TEST_DATA_PREFIX } from '@data/testData';

/**
 * Safety net for data left behind by aborted/killed runs (per-test cleanup handles the normal case).
 * Only touches the automation accounts, and only data older than the grace period, so it never
 * deletes data of a run that is still in progress on another machine/CI job with the same account.
 */
const GRACE_PERIOD_MS = 30 * 60 * 1000;
const PAGE_SIZE = 100;

for (const role of ALL_USER_ROLES) {
  teardown(`sweep stale test data of ${role}`, async ({ apiAs }) => {
    const api = await apiAs(role);
    const isStale = (createdAt: string) => Date.now() - Date.parse(createdAt) > GRACE_PERIOD_MS;
    let removed = 0;

    // Collect first, delete afterwards: deleting while paginating would shift pages and skip items.
    const staleEvents: number[] = [];
    for (let page = 1; ; page++) {
      const { data, pagination } = (await api.events.list({ page, limit: PAGE_SIZE })).expectStatus(200);
      staleEvents.push(
        ...data
          .filter((e) => !e.isStatic && e.title.startsWith(TEST_DATA_PREFIX) && isStale(e.createdAt))
          .map((e) => e.id),
      );
      if (page >= pagination.totalPages) break;
    }
    // Deleting a user-owned event cascades to its bookings, so events go first.
    for (const id of staleEvents) {
      if ((await api.events.remove(id)).ok) removed++;
    }

    // Remaining bookings are on shared (static) events. The accounts are dedicated to automation,
    // so any of their stale bookings is test data.
    const staleBookings: number[] = [];
    for (let page = 1; ; page++) {
      const { data, pagination } = (await api.bookings.list({ page, limit: PAGE_SIZE })).expectStatus(200);
      staleBookings.push(...data.filter((b) => isStale(b.createdAt)).map((b) => b.id));
      if (page >= pagination.totalPages) break;
    }
    for (const id of staleBookings) {
      if ((await api.bookings.cancel(id)).ok) removed++;
    }

    teardown.info().annotations.push({ type: 'cleanup', description: `${role}: removed ${removed} stale item(s)` });
  });
}
