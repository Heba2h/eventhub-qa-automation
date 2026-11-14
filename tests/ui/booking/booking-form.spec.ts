import { expect, test } from '@fixtures';
import { MAX_TICKETS_PER_BOOKING } from '@data/helpers';

test.describe('Booking form rules in the web app', { tag: '@ui' }, () => {
  test('invalid customer details are flagged and no booking is made', async ({ api, seed, eventDetailsPage }) => {
    const event = await seed.createEvent();
    await eventDetailsPage.openEvent(event.id);
    const { bookingForm } = eventDetailsPage;

    await bookingForm.fillCustomer({ customerName: 'A', customerEmail: 'not-an-email', customerPhone: '12345' });
    await bookingForm.submit();

    await expect(bookingForm.fieldError('Name must be at least 2 chars')).toBeVisible();
    await expect(bookingForm.fieldError('Enter a valid email')).toBeVisible();
    await expect(bookingForm.fieldError('Enter a valid 10-digit phone')).toBeVisible();
    await expect(eventDetailsPage.confirmation.heading).toBeHidden();
    expect((await api.bookings.list({ eventId: event.id })).body.data).toHaveLength(0);
  });

  test('ticket quantity is capped at 10 per booking', async ({ seed, eventDetailsPage }) => {
    const event = await seed.createEvent({ totalSeats: 50 });
    await eventDetailsPage.openEvent(event.id);
    const { bookingForm } = eventDetailsPage;

    await bookingForm.setQuantity(MAX_TICKETS_PER_BOOKING);

    await expect(bookingForm.increaseButton).toBeDisabled();
    await expect(bookingForm.maxTicketsHint).toHaveText(`(max ${MAX_TICKETS_PER_BOOKING})`);
  });

  test('ticket quantity is capped at the seats still available', async ({ seed, eventDetailsPage }) => {
    const event = await seed.createEvent({ totalSeats: 5 });
    await seed.createBooking(event.id, { quantity: 3 });
    await eventDetailsPage.openEvent(event.id);
    const { bookingForm } = eventDetailsPage;

    await expect(eventDetailsPage.availableSeats).toHaveText('2 / 5 seats');
    await bookingForm.setQuantity(2);

    await expect(bookingForm.increaseButton).toBeDisabled();
    await expect(bookingForm.maxTicketsHint).toHaveText('(max 2)');
  });

  test('decreasing tickets cannot go below 1', async ({ seed, eventDetailsPage }) => {
    const event = await seed.createEvent();
    await eventDetailsPage.openEvent(event.id);

    await expect(eventDetailsPage.bookingForm.ticketCount).toHaveText('1');
    await expect(eventDetailsPage.bookingForm.decreaseButton).toBeDisabled();
  });
});

test.describe('Booking as a signed-out visitor', { tag: '@ui' }, () => {
  test.use({ role: 'anonymous' });

  // The story says "As a visitor", but booking requires an account (README, finding S-01).
  test('is redirected to sign in before booking', async ({ page, seed, eventDetailsPage }) => {
    const event = await seed.createEvent();

    await eventDetailsPage.openEvent(event.id);

    await expect(page).toHaveURL(/\/login/);
    await expect(eventDetailsPage.bookingForm.confirmButton).toBeHidden();
  });
});
