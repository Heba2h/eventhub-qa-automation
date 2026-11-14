import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class EventsPage extends BasePage {
  protected path = '/events';

  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly eventCards: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
    this.searchInput = page.getByPlaceholder('Search events, venues…');
    this.eventCards = page.getByTestId('event-card');
  }

  eventCard(title: string): Locator {
    return this.eventCards.filter({ has: this.page.getByRole('heading', { name: title, exact: true }) });
  }

  /**
   * The search box is debounced and rewrites the URL (?search=...) once applied. Waiting for the
   * filtered API response prevents a late URL rewrite from undoing a navigation that follows.
   */
  async search(text: string): Promise<void> {
    const searchApplied = this.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/api/events') &&
        new URL(response.url()).searchParams.get('search') === text,
    );
    await this.searchInput.fill(text);
    await searchApplied;
  }

  /** Finds an event via the search box (the list is paginated) and opens it with "Book Now". */
  async openEventToBook(title: string): Promise<void> {
    await this.search(title);
    await this.eventCard(title).getByTestId('book-now-btn').click();
  }
}
