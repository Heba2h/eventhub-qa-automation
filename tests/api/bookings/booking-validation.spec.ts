import { expect, test } from '@fixtures';
import { BookingFactory } from '@data/testData';
import { knownIssue } from '@data/helpers';

type Patch = Record<string, unknown>;

const invalidRequests: Array<{ title: string; patch?: Patch; omit?: string; field: string }> = [
  { title: 'quantity of 0', patch: { quantity: 0 }, field: 'quantity' },
  { title: 'quantity above the maximum of 10', patch: { quantity: 11 }, field: 'quantity' },
  { title: 'fractional quantity', patch: { quantity: 2.5 }, field: 'quantity' },
  { title: 'name shorter than 2 characters', patch: { customerName: 'A' }, field: 'customerName' },
  { title: 'malformed email', patch: { customerEmail: 'not-an-email' }, field: 'customerEmail' },
  { title: 'phone shorter than 10 digits', patch: { customerPhone: '12345' }, field: 'customerPhone' },
  { title: 'phone containing letters', patch: { customerPhone: 'call-me-maybe' }, field: 'customerPhone' },
  { title: 'missing customer name', omit: 'customerName', field: 'customerName' },
];

test.describe('Create booking via API — input validation and business rules', { tag: '@api' }, () => {
  for (const { title, patch, omit, field } of invalidRequests) {
    test(`rejects ${title} without side effects`, async ({ api, seed }) => {
      const event = await seed.createEvent({ totalSeats: 20 });
      const payload: Patch = { ...BookingFactory.build(event.id), ...patch };
      if (omit) delete payload[omit];

      const response = await api.bookings.create(payload);

      expect(response.status).toBe(400);
      expect(response.error.error).toBe('Validation failed');
      expect(response.error.details?.map((d) => d.field)).toContain(field);
      expect((await seed.getEvent(event.id)).availableSeats).toBe(20);
    });
  }

  test('returns 404 for an event that does not exist', async ({ api }) => {
    const response = await api.bookings.create(BookingFactory.build(2_147_483_000));

    expect(response.status).toBe(404);
    expect(response.error.success).toBe(false);
  });

  test('rejects booking more tickets than seats available', async ({ api, seed }) => {
    const event = await seed.createEvent({ totalSeats: 3 });

    const response = await api.bookings.create(BookingFactory.build(event.id, { quantity: 4 }));

    expect(response.status).toBe(400);
    expect(response.error.error).toMatch(/3 seat\(s\) available/);
    expect((await seed.getEvent(event.id)).availableSeats).toBe(3);
  });

  test('rejects any booking once an event is sold out', async ({ api, seed }) => {
    const event = await seed.createEvent({ totalSeats: 2 });
    await seed.createBooking(event.id, { quantity: 2 });

    const response = await api.bookings.create(BookingFactory.build(event.id, { quantity: 1 }));

    expect(response.status).toBe(400);
    expect((await seed.getEvent(event.id)).availableSeats).toBe(0);
  });

  test(
    'rejects booking an event that has already taken place',
    { tag: '@known-bug', annotation: knownIssue('BUG-01') },
    async ({ api }) => {
      // Users cannot create past events (validation), so this relies on a shared featured event
      // whose date has passed. Any booking accidentally created is removed by the framework.
      const { data: events } = (await api.events.list({ limit: 100 })).expectStatus(200);
      const pastEvent = events.find((e) => Date.parse(e.eventDate) < Date.now() && e.availableSeats > 0);
      test.skip(!pastEvent, 'No past event with free seats available in this environment');
      test.fail();

      const response = await api.bookings.create(BookingFactory.build(pastEvent!.id, { quantity: 1 }));

      expect(response.status).toBe(400);
    },
  );
});
