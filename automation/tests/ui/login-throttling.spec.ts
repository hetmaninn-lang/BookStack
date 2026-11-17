import { expect, request, test } from '@playwright/test';
import { baseURL } from '../../support/env';
import { apiAuthHeader, logIn, readApiToken } from '../../support/session';

// Risk covered: AU-01 (repeated failed logins are not throttled).
// Observed behaviour on v26.09.3: an account is locked for about a minute after 5 failed
// attempts from the same client. The lockout is per account; failures spread across
// different accounts are not limited (recorded in the risk assessment, not asserted here).

test('an account is locked after 5 failed logins, even for the correct password', async ({ page }) => {
  const api = await request.newContext({ baseURL, extraHTTPHeaders: apiAuthHeader(readApiToken()) });
  const user = {
    name: 'QA Lockout',
    email: `qa.lockout.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.test`,
    password: 'correct-test-pass',
  };
  const created = await api.post('/api/users', { data: { ...user, roles: [] } });
  expect(created.ok(), await created.text()).toBeTruthy();
  const { id } = (await created.json()) as { id: number };

  try {
    for (let attempt = 1; attempt <= 5; attempt++) {
      await logIn(page, { ...user, password: `wrong-${attempt}` });
      await expect(page.getByText('These credentials do not match our records.')).toBeVisible();
    }

    await logIn(page, user);

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/Too many login attempts\. Please try again in \d+ seconds\./)).toBeVisible();
  } finally {
    await api.delete(`/api/users/${id}`);
    await api.dispose();
  }
});
