import { expect, test } from '@fixtures';
import { CustomerFactory } from '@data/testData';
import { BOOKING_REF_PATTERN, expectedTotal, knownIssue, toAmount } from '@data/helpers';

test.describe('Book tickets in the web app — US-114 AC1, AC2, AC3', { tag: '@ui' }, () => {
  test(
    'user books tickets and finds the booking in My Bookings',
    { tag: '@smoke' },
    async ({ api, seed, eventsPage, eventDetailsPage, myBookingsPage }) => {
      const event = await seed.createEvent({ price: 45, totalSeats: 30 });
      const customer = CustomerFactory.build();
      const quantity = 3;
      const total = expectedTotal(event.price, quantity);

      await test.step('find the event and open it', async () => {
        await eventsPage.open();
        await eventsPage.openEventToBook(event.title);
        await expect(eventDetailsPage.title).toHaveText(event.title);
      });

      await test.step('choose tickets, enter details and confirm (AC1)', async () => {
        await eventDetailsPage.bookingForm.book(customer, quantity);
        await expect(eventDetailsPage.confirmation.heading).toBeVisible();
      });

      const bookingRef = await eventDetailsPage.confirmation.reference();

      await test.step('confirmation shows reference, customer, tickets and total (AC1, AC2)', async () => {
        const { confirmation } = eventDetailsPage;
        expect(bookingRef).toMatch(BOOKING_REF_PATTERN);
        await expect(confirmation.value('Customer')).toHaveText(customer.customerName);
        await expect(confirmation.value('Tickets')).toHaveText(String(quantity));
        expect(await confirmation.total()).toBe(total);
      });

      await test.step('booking was persisted with the submitted data', async () => {
        const booking = (await api.bookings.getByRef(bookingRef)).expectStatus(200).data;
        expect(booking).toMatchObject({ eventId: event.id, quantity, status: 'confirmed', ...customer });
        expect(toAmount(booking.totalPrice)).toBe(total);
      });

      await test.step('booking appears in My Bookings (AC3)', async () => {
        await eventDetailsPage.confirmation.viewMyBookingsButton.click();
        const card = myBookingsPage.bookingCard(bookingRef);
        await expect(card.root).toBeVisible();
        await expect(card.eventTitle).toHaveText(event.title);
        await expect(card.status).toHaveText('confirmed');
        expect(await card.tickets()).toBe(quantity);
        expect(await card.total()).toBe(total);
      });
    },
  );

  test('order total updates as the number of tickets changes (AC2)', async ({ seed, eventDetailsPage }) => {
    const event = await seed.createEvent({ price: 35 });
    await eventDetailsPage.openEvent(event.id);
    const { bookingForm } = eventDetailsPage;

    for (const quantity of [1, 4, 2]) {
      await bookingForm.setQuantity(quantity);
      expect(await bookingForm.total(), `total for ${quantity} ticket(s)`).toBe(expectedTotal(event.price, quantity));
    }
  });

  test(
    'shows exact prices for non-whole-dollar tickets (AC2)',
    { tag: '@known-bug', annotation: knownIssue('BUG-02') },
    async ({ seed, eventDetailsPage }) => {
      test.fail();
      const event = await seed.createEvent({ price: 12.5 });
      await eventDetailsPage.openEvent(event.id);

      await eventDetailsPage.bookingForm.book(CustomerFactory.build(), 3);

      await expect(eventDetailsPage.confirmation.heading).toBeVisible();
      expect(await eventDetailsPage.confirmation.total()).toBe(37.5);
    },
  );
});
