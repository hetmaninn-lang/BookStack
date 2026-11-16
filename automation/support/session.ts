import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { type Account, paths } from './env';

export interface ApiToken {
  id: string;
  secret: string;
}

export interface SeedData {
  book: { id: number; slug: string; name: string };
  chapter: { id: number; name: string };
  page: { id: number; slug: string; name: string };
  users: { editorId: number; viewerId: number };
}

export async function logIn(page: Page, account: Account): Promise<void> {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.locator('input[name="password"]').press('Enter');
}

export function apiAuthHeader(token: ApiToken): Record<string, string> {
  return { Authorization: `Token ${token.id}:${token.secret}` };
}

/** Admin API token created by global setup. */
export function readApiToken(): ApiToken {
  return JSON.parse(readFileSync(paths.apiToken, 'utf8')) as ApiToken;
}

/** Identifiers of the content and users created by global setup. */
export function readSeed(): SeedData {
  return JSON.parse(readFileSync(paths.seed, 'utf8')) as SeedData;
}
