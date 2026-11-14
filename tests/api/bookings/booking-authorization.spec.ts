import { expect, test } from '@fixtures';
import { BookingFactory } from '@data/testData';

test.describe('Booking authorization', { tag: ['@api', '@security'] }, () => {
  test('rejects unauthenticated requests', async ({ apiAs, seed }) => {
    const event = await seed.createEvent();
    const anonymous = await apiAs('anonymous');

    expect((await anonymous.bookings.create(BookingFactory.build(event.id))).status).toBe(401);
    expect((await anonymous.bookings.list()).status).toBe(401);
  });

  test('another user can neither see nor cancel my booking', async ({ api, apiAs, seed }) => {
    const event = await seed.createEvent();
    const booking = await seed.createBooking(event.id);
    const intruder = await apiAs('secondary');

    // 403 vs 404 is inconsistent across endpoints (README, finding D-06); either is a denial.
    expect([403, 404]).toContain((await intruder.bookings.getById(booking.id)).status);
    expect([403, 404]).toContain((await intruder.bookings.getByRef(booking.bookingRef)).status);
    expect([403, 404]).toContain((await intruder.bookings.cancel(booking.id)).status);
    expect((await intruder.bookings.list()).body.data.map((b) => b.id)).not.toContain(booking.id);

    expect((await api.bookings.getById(booking.id)).body.data.status).toBe('confirmed');
  });

  test('another user cannot book my private event', async ({ apiAs, seed }) => {
    const event = await seed.createEvent({ totalSeats: 5 });
    const intruder = await apiAs('secondary');

    const response = await intruder.bookings.create(BookingFactory.build(event.id, { quantity: 1 }));

    expect(response.status).toBe(404);
    expect((await seed.getEvent(event.id)).availableSeats).toBe(5);
  });
});
