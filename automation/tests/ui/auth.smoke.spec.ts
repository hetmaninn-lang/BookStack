import { expect, test } from '@playwright/test';

const adminEmail = process.env.BOOKSTACK_ADMIN_EMAIL ?? '';
const adminPassword = process.env.BOOKSTACK_ADMIN_PASSWORD ?? '';

test.describe('Authentication @smoke', () => {
  test.beforeAll(() => {
    expect(adminEmail, 'BOOKSTACK_ADMIN_EMAIL must be set (see .env.example)').not.toBe('');
    expect(adminPassword, 'BOOKSTACK_ADMIN_PASSWORD must be set (see .env.example)').not.toBe('');
  });

  test('login page is reachable', async ({ page }) => {
    const response = await page.goto('/login');

    expect(response?.status()).toBe(200);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('administrator can log in with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill(adminEmail);
    await page.locator('input[name="password"]').fill(adminPassword);
    await page.locator('input[name="password"]').press('Enter');

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
  });

  test('login is rejected with an invalid password', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill(adminEmail);
    await page.locator('input[name="password"]').fill(`${adminPassword}-wrong`);
    await page.locator('input[name="password"]').press('Enter');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });
});
