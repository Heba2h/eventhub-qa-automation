import { expect, test } from '@fixtures';
import { BookingFactory } from '@data/testData';
import { BOOKING_REF_PATTERN, MAX_TICKETS_PER_BOOKING, expectedTotal, toAmount } from '@data/helpers';

test.describe('Create booking via API — US-114 AC1, AC2, AC3, AC5', { tag: '@api' }, () => {
  test('creates a confirmed booking with a booking reference', { tag: '@smoke' }, async ({ api, seed }) => {
    const event = await seed.createEvent();
    const input = BookingFactory.build(event.id, { quantity: 2 });

    const response = await api.bookings.create(input);

    expect(response.status).toBe(201);
    const booking = response.body.data;
    expect(booking).toMatchObject({
      eventId: event.id,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      quantity: 2,
      status: 'confirmed',
    });
    expect(booking.bookingRef).toMatch(BOOKING_REF_PATTERN);

    const byRef = await api.bookings.getByRef(booking.bookingRef);
    expect(byRef.status).toBe(200);
    expect(byRef.body.data.id).toBe(booking.id);
  });

  const priceCases = [
    { title: 'single ticket', price: 40, quantity: 1 },
    { title: 'maximum tickets per booking', price: 40, quantity: MAX_TICKETS_PER_BOOKING },
    { title: 'fractional price (rounding)', price: 19.99, quantity: 3 },
  ];
  for (const { title, price, quantity } of priceCases) {
    test(`total price equals ticket price × quantity — ${title}`, async ({ api, seed }) => {
      const event = await seed.createEvent({ price });

      const booking = (await api.bookings.create(BookingFactory.build(event.id, { quantity }))).expectStatus(201).data;

      expect(toAmount(booking.totalPrice)).toBe(expectedTotal(event.price, quantity));
    });
  }

  test('reduces the event’s available seats by the booked quantity', async ({ seed }) => {
    const event = await seed.createEvent({ totalSeats: 20 });

    await seed.createBooking(event.id, { quantity: 4 });

    expect((await seed.getEvent(event.id)).availableSeats).toBe(16);
  });

  test('lists the booking in the user’s bookings (My Bookings)', async ({ api, seed }) => {
    const event = await seed.createEvent();
    const booking = await seed.createBooking(event.id);

    const response = await api.bookings.list({ eventId: event.id });

    expect(response.status).toBe(200);
    expect(response.body.data.map((b) => b.bookingRef)).toEqual([booking.bookingRef]);
  });

  test('issues a unique reference for every booking', async ({ seed }) => {
    const event = await seed.createEvent();

    const refs = [];
    for (let i = 0; i < 3; i++) refs.push((await seed.createBooking(event.id, { quantity: 1 })).bookingRef);

    expect(new Set(refs).size).toBe(refs.length);
  });
});
