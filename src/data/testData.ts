import { faker } from '@faker-js/faker';
import type { EventHubApi } from '@api/EventHubApi';
import type { Booking, CreateBookingInput, CreateEventInput, EventhubEvent } from '@api/models';

/**
 * Every entity the framework creates carries this prefix, so leftovers from aborted runs can be
 * found and swept by the cleanup project without touching anybody else's data.
 */
export const TEST_DATA_PREFIX = 'QA-AUTO';

const DAY_MS = 24 * 60 * 60 * 1000;

export type Customer = Pick<CreateBookingInput, 'customerName' | 'customerEmail' | 'customerPhone'>;

// ---------------------------------------------------------------------------------------------
// Factories: valid random data by default, override only what a test cares about
// ---------------------------------------------------------------------------------------------

export const EventFactory = {
  build(overrides: Partial<CreateEventInput> = {}): CreateEventInput {
    const eventDate = new Date(Date.now() + faker.number.int({ min: 30, max: 180 }) * DAY_MS);
    eventDate.setUTCHours(18, 0, 0, 0);
    return {
      title: `${TEST_DATA_PREFIX} ${faker.music.genre()} Night ${faker.string.alphanumeric(6).toUpperCase()}`,
      description: 'Created by automated tests — safe to delete.',
      category: 'Concert',
      venue: `${faker.location.street()} Hall`,
      city: faker.location.city(),
      eventDate: eventDate.toISOString(),
      // Whole-number default keeps unrelated tests independent of the UI price-rounding defect
      // (BUG-02), which has its own dedicated test.
      price: faker.number.int({ min: 10, max: 250 }),
      totalSeats: 50,
      ...overrides,
    };
  },
};

export const CustomerFactory = {
  build(overrides: Partial<Customer> = {}): Customer {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
      customerName: `${firstName} ${lastName}`,
      // example.com is reserved (RFC 2606) — never reaches a real inbox.
      customerEmail: faker.internet.email({ firstName, lastName, provider: 'example.com' }).toLowerCase(),
      customerPhone: `+1 555 ${faker.string.numeric(7)}`,
      ...overrides,
    };
  },
};

export const BookingFactory = {
  build(eventId: number, overrides: Partial<CreateBookingInput> = {}): CreateBookingInput {
    return { eventId, quantity: 2, ...CustomerFactory.build(), ...overrides };
  },
};

// ---------------------------------------------------------------------------------------------
// Seeder: creates preconditions through the API
// ---------------------------------------------------------------------------------------------

/**
 * Arrange-phase helpers: create the exact preconditions a test needs through the API
 * (fast, deterministic) instead of clicking through the UI. Everything created is tracked
 * by the fixture layer and removed after the test.
 */
export class TestDataSeeder {
  constructor(private readonly api: EventHubApi) {}

  /**
   * Tests book against their own freshly created event instead of the shared "featured" events:
   * known price and seat count, and no interference from other people using the public environment.
   */
  async createEvent(overrides: Partial<CreateEventInput> = {}): Promise<EventhubEvent> {
    return (await this.api.events.create(EventFactory.build(overrides))).expectStatus(201).data;
  }

  async createBooking(eventId: number, overrides: Partial<CreateBookingInput> = {}): Promise<Booking> {
    return (await this.api.bookings.create(BookingFactory.build(eventId, overrides))).expectStatus(201).data;
  }

  async getEvent(eventId: number): Promise<EventhubEvent> {
    return (await this.api.events.getById(eventId)).expectStatus(200).data;
  }
}
