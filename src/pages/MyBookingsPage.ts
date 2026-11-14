import type { Locator, Page } from '@playwright/test';
import { parseDisplayedAmount } from '@data/helpers';
import { BasePage } from './BasePage';

export class MyBookingsPage extends BasePage {
  protected path = '/bookings';

  readonly heading: Locator;
  readonly bookingCards: Locator;
  readonly cancelDialog: CancelBookingDialog;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'My Bookings', level: 1 });
    this.bookingCards = page.getByTestId('booking-card');
    this.cancelDialog = new CancelBookingDialog(page);
  }

  /** Booking references are unique, so they are the stable way to address a card. */
  bookingCard(bookingRef: string): BookingCard {
    return new BookingCard(this.bookingCards.filter({ hasText: bookingRef }));
  }

  async cancelBooking(bookingRef: string): Promise<void> {
    await this.bookingCard(bookingRef).cancelButton.click();
    await this.cancelDialog.confirmButton.click();
  }
}

/** Component: one booking entry on the "My Bookings" page. */
export class BookingCard {
  readonly status: Locator;
  readonly eventTitle: Locator;
  readonly ticketsLabel: Locator;
  readonly totalAmount: Locator;
  readonly viewDetailsLink: Locator;
  readonly cancelButton: Locator;

  constructor(readonly root: Locator) {
    this.status = root.getByText(/^(confirmed|cancelled)$/i);
    this.eventTitle = root.getByRole('heading', { level: 3 });
    this.ticketsLabel = root.getByText(/\d+ tickets?/);
    this.totalAmount = root.getByRole('paragraph').filter({ hasText: /^\$/ });
    this.viewDetailsLink = root.getByRole('link', { name: 'View Details' });
    this.cancelButton = root.getByTestId('cancel-booking-btn');
  }

  async tickets(): Promise<number> {
    const match = /(\d+) tickets?/.exec(await this.ticketsLabel.innerText());
    if (!match?.[1]) throw new Error('Ticket count not found on booking card');
    return Number(match[1]);
  }

  async total(): Promise<number> {
    return parseDisplayedAmount(await this.totalAmount.innerText());
  }
}

/** Component: the "Cancel this booking?" confirmation dialog. */
export class CancelBookingDialog {
  readonly root: Locator;
  readonly message: Locator;
  readonly confirmButton: Locator;
  readonly dismissButton: Locator;

  constructor(page: Page) {
    this.root = page.getByRole('dialog', { name: 'Cancel this booking?' });
    this.message = this.root.getByRole('paragraph');
    this.confirmButton = this.root.getByRole('button', { name: 'Yes, cancel it' });
    this.dismissButton = this.root.getByRole('button', { name: 'Cancel', exact: true });
  }
}
