import { expect, test } from '@fixtures';

test.describe('Cancel a booking in the web app — US-114 AC4', { tag: '@ui' }, () => {
  test('user cancels a booking from My Bookings', { tag: '@smoke' }, async ({ api, seed, myBookingsPage }) => {
    const event = await seed.createEvent({ totalSeats: 10 });
    const booking = await seed.createBooking(event.id, { quantity: 3 });
    await myBookingsPage.open();
    const card = myBookingsPage.bookingCard(booking.bookingRef);

    await card.cancelButton.click();
    await expect(myBookingsPage.cancelDialog.message).toContainText(booking.bookingRef);
    await myBookingsPage.cancelDialog.confirmButton.click();

    await expect(card.root).toBeHidden();
    expect((await api.bookings.getById(booking.id)).status).toBe(404);
    expect((await seed.getEvent(event.id)).availableSeats).toBe(10);
  });

  test('dismissing the confirmation dialog keeps the booking', async ({ api, seed, myBookingsPage }) => {
    const event = await seed.createEvent();
    const booking = await seed.createBooking(event.id);
    await myBookingsPage.open();
    const card = myBookingsPage.bookingCard(booking.bookingRef);

    await card.cancelButton.click();
    await myBookingsPage.cancelDialog.dismissButton.click();

    await expect(myBookingsPage.cancelDialog.root).toBeHidden();
    await expect(card.status).toHaveText('confirmed');
    expect((await api.bookings.getById(booking.id)).body.data.status).toBe('confirmed');
  });
});
