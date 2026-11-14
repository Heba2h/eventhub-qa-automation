import { expect, type Locator, type Page } from '@playwright/test';
import type { Customer } from '@data/testData';
import { parseDisplayedAmount } from '@data/helpers';
import { BasePage } from './BasePage';

export class EventDetailsPage extends BasePage {
  protected path = '/events';

  readonly title: Locator;
  readonly availableSeats: Locator;
  readonly pricePerTicket: Locator;
  readonly bookingForm: BookingForm;
  readonly confirmation: BookingConfirmation;

  constructor(page: Page) {
    super(page);
    this.title = page.getByRole('main').getByRole('heading', { level: 1 });
    this.availableSeats = page.locator('p:text-is("Available") + p');
    this.pricePerTicket = page.locator('p:text-is("Price per ticket") + p');
    this.bookingForm = new BookingForm(page);
    this.confirmation = new BookingConfirmation(page);
  }

  async openEvent(eventId: number): Promise<void> {
    await this.page.goto(`${this.path}/${eventId}`);
  }
}

/** Component: "Book Tickets" form on the event details page. */
export class BookingForm {
  readonly root: Locator;
  readonly decreaseButton: Locator;
  readonly increaseButton: Locator;
  readonly ticketCount: Locator;
  readonly maxTicketsHint: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly confirmButton: Locator;
  readonly totalAmount: Locator;

  constructor(page: Page) {
    this.confirmButton = page.locator('#confirm-booking');
    this.root = page.locator('form', { has: this.confirmButton });
    this.decreaseButton = this.root.getByRole('button', { name: '−' });
    this.increaseButton = this.root.getByRole('button', { name: '+' });
    this.ticketCount = this.root.locator('#ticket-count');
    this.maxTicketsHint = this.root.getByText(/^\(max \d+\)$/);
    this.nameInput = this.root.locator('#customerName');
    this.emailInput = this.root.getByTestId('customer-email');
    this.phoneInput = this.root.locator('#phone');
    this.totalAmount = this.root.locator('div:has(> span:text-is("Total")) > span:last-child');
  }

  /** The quantity stepper starts at 1; each click is verified so a swallowed click fails here, not later. */
  async setQuantity(quantity: number): Promise<void> {
    let current = Number(await this.ticketCount.innerText());
    while (current < quantity) {
      await this.increaseButton.click();
      await expect(this.ticketCount).toHaveText(String(++current));
    }
    while (current > quantity) {
      await this.decreaseButton.click();
      await expect(this.ticketCount).toHaveText(String(--current));
    }
  }

  async fillCustomer(customer: Customer): Promise<void> {
    await this.nameInput.fill(customer.customerName);
    await this.emailInput.fill(customer.customerEmail);
    await this.phoneInput.fill(customer.customerPhone);
  }

  async submit(): Promise<void> {
    await this.confirmButton.click();
  }

  async book(customer: Customer, quantity: number): Promise<void> {
    await this.setQuantity(quantity);
    await this.fillCustomer(customer);
    await this.submit();
  }

  async total(): Promise<number> {
    return parseDisplayedAmount(await this.totalAmount.innerText());
  }

  fieldError(message: string | RegExp): Locator {
    return this.root.getByText(message);
  }
}

/** Component: success panel shown in place of the booking form after "Confirm Booking". */
export class BookingConfirmation {
  readonly root: Locator;
  readonly heading: Locator;
  readonly bookingRef: Locator;
  readonly viewMyBookingsButton: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: /Booking Confirmed/ });
    this.root = page.locator('div', { has: this.heading }).last();
    this.bookingRef = this.root.locator('.booking-ref');
    this.viewMyBookingsButton = this.root.getByRole('button', { name: 'View My Bookings' });
  }

  /** Value cell of a "label  value" summary row (Booking Ref, Customer, Tickets, Total). */
  value(label: 'Customer' | 'Tickets' | 'Total'): Locator {
    return this.root.locator(`div:has(> span:text-is("${label}")) > span:last-child`);
  }

  async reference(): Promise<string> {
    return (await this.bookingRef.innerText()).trim();
  }

  async total(): Promise<number> {
    return parseDisplayedAmount(await this.value('Total').innerText());
  }
}
