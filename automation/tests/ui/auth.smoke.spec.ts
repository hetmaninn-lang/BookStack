import { expect, test } from '@playwright/test';
import { accounts } from '../../support/env';
import { logIn, readSeed } from '../../support/session';

test.describe('Authentication @smoke', () => {
  test('login page is reachable', async ({ page }) => {
    const response = await page.goto('/login');

    expect(response?.status()).toBe(200);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  for (const role of ['admin', 'editor', 'viewer'] as const) {
    test(`${role} can log in and open seeded content`, async ({ page }) => {
      const seed = readSeed();

      await logIn(page, accounts[role]);
      await expect(page).not.toHaveURL(/\/login/);

      await page.goto(`/books/${seed.book.slug}`);
      await expect(page.getByRole('heading', { level: 1, name: seed.book.name })).toBeVisible();
    });
  }

  test('login is rejected with an invalid password', async ({ page }) => {
    await logIn(page, { ...accounts.admin, password: `${accounts.admin.password}-wrong` });

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });
});
