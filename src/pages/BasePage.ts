import type { Page } from '@playwright/test';

/**
 * Base for all page objects. Pages expose locators and user-level actions only —
 * assertions live in the tests so a page object can serve many scenarios.
 */
export abstract class BasePage {
  protected constructor(protected readonly page: Page) {}

  /** Path relative to the configured baseURL. */
  protected abstract readonly path: string;

  async open(): Promise<void> {
    await this.page.goto(this.path);
  }
}
