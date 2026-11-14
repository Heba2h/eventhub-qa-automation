import { request, test, type APIRequestContext } from '@playwright/test';
import { env } from '@config';
import type { ErrorEnvelope } from './models';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type QueryValue = string | number | boolean | undefined;

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
}

/** Callback the framework uses to register server-side resources for automatic cleanup. */
export type ResourceTrackerFn = (kind: 'event' | 'booking', id: number) => void;

/**
 * The one place that knows how an API identity is expressed on the wire.
 * Pass a token for an authenticated context, omit it for an anonymous one.
 */
export function createApiContext(token?: string): Promise<APIRequestContext> {
  return request.newContext({
    // Trailing slash matters: relative client paths ("bookings") resolve under /api/.
    baseURL: `${env.apiUrl}/`,
    extraHTTPHeaders: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/**
 * Thin, immutable view over an HTTP response.
 * Tests assert on `status`/`body` themselves; arrange steps use `expectStatus()` which
 * fails fast with a readable diagnostic instead of a cryptic "cannot read property of undefined".
 */
export class ApiResponse<T> {
  constructor(
    readonly method: string,
    readonly url: string,
    readonly status: number,
    readonly body: T,
    readonly headers: Record<string, string>,
  ) {}

  get ok(): boolean {
    return this.status >= 200 && this.status < 300;
  }

  /** Body interpreted as the API's error envelope (use on non-2xx responses). */
  get error(): ErrorEnvelope {
    return this.body as unknown as ErrorEnvelope;
  }

  expectStatus(expected: number): T {
    if (this.status !== expected) {
      throw new Error(
        `${this.method} ${this.url} expected HTTP ${expected} but got ${this.status}.\n` +
          `Response body: ${JSON.stringify(this.body, null, 2)}`,
      );
    }
    return this.body;
  }
}

/**
 * Base class for every endpoint client.
 *
 * - The injected APIRequestContext is already authenticated (or deliberately anonymous) by the
 *   fixture layer, so clients never deal with tokens.
 * - Every call is wrapped in a boxed `test.step`, so the HTML report/trace reads like
 *   "POST bookings -> 201" without leaking framework internals into stack traces.
 */
export abstract class BaseApiClient {
  constructor(
    protected readonly request: APIRequestContext,
    protected readonly track: ResourceTrackerFn = () => {},
  ) {}

  protected get<T>(path: string, options?: RequestOptions) {
    return this.send<T>('GET', path, options);
  }

  protected post<T>(path: string, options?: RequestOptions) {
    return this.send<T>('POST', path, options);
  }

  protected put<T>(path: string, options?: RequestOptions) {
    return this.send<T>('PUT', path, options);
  }

  protected delete<T>(path: string, options?: RequestOptions) {
    return this.send<T>('DELETE', path, options);
  }

  private async send<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    // Paths must be relative so they resolve against the "/api/" base URL instead of replacing it.
    const relativePath = path.replace(/^\/+/, '');

    return test.step(
      `${method} ${relativePath}`,
      async () => {
        const response = await this.fetchWithTransportRetry(method, relativePath, options);
        const text = await response.text();
        let body: unknown = text;
        try {
          body = text ? JSON.parse(text) : undefined;
        } catch {
          // Non-JSON payload: keep raw text so assertions/diagnostics can still show it.
        }
        return new ApiResponse<T>(method, response.url(), response.status(), body as T, response.headers());
      },
      { box: true },
    );
  }

  /**
   * The shared environment occasionally drops connections. Only network-level failures of
   * idempotent GETs are retried — never HTTP error statuses (those are results to assert on),
   * and never writes (a retried POST could double-book).
   */
  private async fetchWithTransportRetry(method: HttpMethod, path: string, options: RequestOptions) {
    const attempts = method === 'GET' ? 1 + TRANSPORT_RETRIES : 1;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.request.fetch(path, { method, params: compactQuery(options.query), data: options.body });
      } catch (error) {
        if (attempt >= attempts || !TRANSIENT_NETWORK_ERROR.test((error as Error).message)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
}

const TRANSPORT_RETRIES = 2;
const TRANSIENT_NETWORK_ERROR = /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|socket hang up/i;

function compactQuery(query?: Record<string, QueryValue>): Record<string, string | number | boolean> | undefined {
  if (!query) return undefined;
  const entries = Object.entries(query).filter(
    (entry): entry is [string, string | number | boolean] => entry[1] !== undefined,
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}
