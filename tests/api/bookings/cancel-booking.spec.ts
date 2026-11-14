import { expect, test } from '@fixtures';

test.describe('Cancel booking via API — US-114 AC4', { tag: '@api' }, () => {
  test('cancels a booking and releases its seats', { tag: '@smoke' }, async ({ api, seed }) => {
    const event = await seed.createEvent({ totalSeats: 10 });
    const booking = await seed.createBooking(event.id, { quantity: 3 });

    const response = await api.bookings.cancel(booking.id);

    expect(response.status).toBe(200);
    expect((await seed.getEvent(event.id)).availableSeats).toBe(10);
    // Cancellation is a hard delete on this API (README, findings D-03): the booking is gone,
    // not kept with status "cancelled".
    expect((await api.bookings.getById(booking.id)).status).toBe(404);
    expect((await api.bookings.list({ eventId: event.id })).body.data).toHaveLength(0);
  });

  test('only releases the seats of the cancelled booking', async ({ api, seed }) => {
    const event = await seed.createEvent({ totalSeats: 10 });
    const kept = await seed.createBooking(event.id, { quantity: 2 });
    const cancelled = await seed.createBooking(event.id, { quantity: 5 });

    (await api.bookings.cancel(cancelled.id)).expectStatus(200);

    expect((await seed.getEvent(event.id)).availableSeats).toBe(8);
    expect((await api.bookings.getById(kept.id)).body.data.status).toBe('confirmed');
  });

  test('cannot cancel the same booking twice', async ({ api, seed }) => {
    const event = await seed.createEvent({ totalSeats: 10 });
    const booking = await seed.createBooking(event.id, { quantity: 2 });
    (await api.bookings.cancel(booking.id)).expectStatus(200);

    const second = await api.bookings.cancel(booking.id);

    expect(second.status).toBe(404);
    expect((await seed.getEvent(event.id)).availableSeats).toBe(10);
  });
});
