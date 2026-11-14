import type { APIRequestContext } from '@playwright/test';
import { BaseApiClient, type ResourceTrackerFn } from './client';
import type {
  AuthResponse,
  Booking,
  BookingQuery,
  CreateBookingInput,
  CreateEventInput,
  Credentials,
  EventhubEvent,
  EventQuery,
  ListEnvelope,
  MeResponse,
  MessageEnvelope,
  SuccessEnvelope,
} from './models';

/** One client per API resource; one method per endpoint. Clients never assert. */

export class AuthApi extends BaseApiClient {
  register(credentials: Credentials) {
    return this.post<AuthResponse>('auth/register', { body: credentials });
  }

  login(credentials: Credentials) {
    return this.post<AuthResponse>('auth/login', { body: credentials });
  }

  me() {
    return this.get<MeResponse>('auth/me');
  }
}

export class EventsApi extends BaseApiClient {
  list(query: EventQuery = {}) {
    return this.get<ListEnvelope<EventhubEvent>>('events', { query: { ...query } });
  }

  getById(id: number) {
    return this.get<SuccessEnvelope<EventhubEvent>>(`events/${id}`);
  }

  async create(input: CreateEventInput) {
    const response = await this.post<SuccessEnvelope<EventhubEvent>>('events', { body: input });
    if (response.status === 201) this.track('event', response.body.data.id);
    return response;
  }

  update(id: number, input: CreateEventInput) {
    return this.put<SuccessEnvelope<EventhubEvent>>(`events/${id}`, { body: input });
  }

  remove(id: number) {
    return this.delete<MessageEnvelope>(`events/${id}`);
  }
}

export class BookingsApi extends BaseApiClient {
  list(query: BookingQuery = {}) {
    return this.get<ListEnvelope<Booking>>('bookings', { query: { ...query } });
  }

  getById(id: number) {
    return this.get<SuccessEnvelope<Booking>>(`bookings/${id}`);
  }

  getByRef(ref: string) {
    return this.get<SuccessEnvelope<Booking>>(`bookings/ref/${encodeURIComponent(ref)}`);
  }

  /**
   * Typed as `CreateBookingInput`, but accepts a looser shape so negative tests can send
   * malformed payloads (wrong types, missing fields) through the same client.
   */
  async create(input: CreateBookingInput | Record<string, unknown>) {
    const response = await this.post<SuccessEnvelope<Booking>>('bookings', { body: input });
    if (response.status === 201) this.track('booking', response.body.data.id);
    return response;
  }

  /** Cancels a booking. Note: the live API hard-deletes it (see README, story review). */
  cancel(id: number) {
    return this.delete<MessageEnvelope>(`bookings/${id}`);
  }
}

/**
 * Facade over all endpoint clients for one identity.
 * New API areas are added here once and become available to every test via the `api` fixture.
 */
export class EventHubApi {
  readonly auth: AuthApi;
  readonly events: EventsApi;
  readonly bookings: BookingsApi;

  constructor(request: APIRequestContext, track?: ResourceTrackerFn) {
    this.auth = new AuthApi(request, track);
    this.events = new EventsApi(request, track);
    this.bookings = new BookingsApi(request, track);
  }
}
