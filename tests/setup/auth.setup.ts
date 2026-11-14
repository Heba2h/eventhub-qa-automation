import { test as setup } from '@playwright/test';
import { ALL_USER_ROLES, authenticate } from '@auth';

/**
 * Runs once per test run, before any test project. Logs every role in through the API and stores
 * the session as (a) a token for API clients and (b) a browser storage state for UI tests.
 */
for (const role of ALL_USER_ROLES) {
  setup(`authenticate as ${role}`, async () => {
    const session = await authenticate(role);
    setup.info().annotations.push({ type: 'auth', description: `${role} -> ${session.email}` });
  });
}
