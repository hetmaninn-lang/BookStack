import { type APIRequestContext, type Page, expect, request, test } from '@playwright/test';
import { type Account, baseURL } from '../../support/env';
import { linkStartingWith, messagesTo, waitForSingleMessageTo } from '../../support/mailpit';
import { apiAuthHeader, logIn, readApiToken } from '../../support/session';

// Risks covered: AU-05 (password reset abuse / account enumeration), AU-02 (old credentials).
// Each test creates its own user, so it never changes the seeded users' passwords.
//
// BookStack allows 10 password-reset requests per minute from one client, shared between
// requesting a link and setting a new password. These tests run in order in one worker so the
// budget is spent predictably, with the rate-limit test last. Global setup resets the counters
// on the local Docker instance so the suite can be rerun straight away.
test.describe.configure({ mode: 'default' });

const resetConfirmation = /A password reset link will be sent to .+ if that email address is found in the system\./;
const resetSucceeded = 'Your password has been successfully reset.';
const tokenRejected = 'The password reset token is invalid for this email address.';

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await request.newContext({ baseURL, extraHTTPHeaders: apiAuthHeader(readApiToken()) });
});

test.afterAll(async () => {
  await api.dispose();
});

function uniqueEmail(label: string): string {
  return `qa.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function createUser(label: string): Promise<Account & { id: number }> {
  const account = { name: `QA Reset ${label}`, email: uniqueEmail(label), password: 'original-test-pass' };
  const response = await api.post('/api/users', { data: { ...account, roles: [] } });
  expect(response.ok(), await response.text()).toBeTruthy();
  const { id } = (await response.json()) as { id: number };
  return { ...account, id };
}

async function deleteUser(id: number): Promise<void> {
  await api.delete(`/api/users/${id}`);
}

async function requestReset(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Forgot Password?' }).click();
  await page.locator('input[name="email"]').fill(email);
  await page.getByRole('button', { name: 'Send Reset Link' }).click();
}

async function submitNewPassword(page: Page, link: string, email: string, password: string): Promise<void> {
  await page.goto(link);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="password_confirmation"]').fill(password);
  await page.getByRole('button', { name: 'Reset Password' }).click();
}

test.describe('Password reset', () => {
  test('a user can reset their password through the emailed link', async ({ page, browser }) => {
    const user = await createUser('reset');
    try {
      await requestReset(page, user.email);
      await expect(page.locator('.notification').filter({ hasText: resetConfirmation })).toBeVisible();

      const email = await waitForSingleMessageTo(user.email);
      expect(email.Subject).toBe('Reset your BookStack password');
      const link = linkStartingWith(email, `${baseURL}/password/reset/`);

      const newPassword = 'changed-test-pass';
      await submitNewPassword(page, link, user.email, newPassword);
      await expect(page.getByText(resetSucceeded)).toBeVisible();

      const fresh = await browser.newContext();
      const freshPage = await fresh.newPage();
      try {
        await logIn(freshPage, user);
        await expect(freshPage, 'old password must be rejected').toHaveURL(/\/login/);

        await logIn(freshPage, { ...user, password: newPassword });
        await expect(freshPage, 'new password must be accepted').not.toHaveURL(/\/login/);
      } finally {
        await fresh.close();
      }
    } finally {
      await deleteUser(user.id);
    }
  });

  test('a reset link cannot be used a second time', async ({ page }) => {
    const user = await createUser('reuse');
    try {
      await requestReset(page, user.email);
      const link = linkStartingWith(await waitForSingleMessageTo(user.email), `${baseURL}/password/reset/`);

      await submitNewPassword(page, link, user.email, 'first-reset-pass');
      await expect(page.getByText(resetSucceeded)).toBeVisible();

      await page.context().clearCookies();
      await submitNewPassword(page, link, user.email, 'second-reset-pass');
      await expect(page.getByText(tokenRejected), 'a used link must not reset the password again').toBeVisible();

      await logIn(page, { ...user, password: 'second-reset-pass' });
      await expect(page).toHaveURL(/\/login/);
    } finally {
      await deleteUser(user.id);
    }
  });

  test('an unknown email gets the same response and no email is sent', async ({ page }) => {
    const unknown = uniqueEmail('unknown');

    await requestReset(page, unknown);

    // Same wording as for a registered address, so the page does not reveal who has an account.
    await expect(page.locator('.notification').filter({ hasText: resetConfirmation })).toBeVisible();

    // Negative check: give the mailer time to send anything it was going to send.
    await page.waitForTimeout(3_000);
    expect(await messagesTo(unknown)).toHaveLength(0);
  });

  test('reset requests are rate limited to 10 per minute', async () => {
    const client = await request.newContext({ baseURL });
    try {
      const form = await (await client.get('/password/email')).text();
      const csrf = form.match(/name="_token" value="([^"]+)"/)?.[1];
      expect(csrf, 'CSRF token on the reset form').toBeTruthy();

      const statuses: number[] = [];
      let limitHeader: string | undefined;
      for (let attempt = 1; attempt <= 11; attempt++) {
        const response = await client.post('/password/email', {
          form: { _token: csrf!, email: uniqueEmail('limit') },
          maxRedirects: 0,
        });
        statuses.push(response.status());
        limitHeader ??= response.headers()['x-ratelimit-limit'];
        if (response.status() === 429) {
          expect(Number(response.headers()['retry-after']), 'Retry-After header').toBeGreaterThan(0);
          break;
        }
      }

      expect(limitHeader).toBe('10');
      expect(statuses.at(-1), `statuses seen: ${statuses.join(', ')}`).toBe(429);
    } finally {
      await client.dispose();
    }
  });
});
