import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type APIRequestContext, chromium, request } from '@playwright/test';
import { type Account, accounts, baseURL, paths } from './support/env';
import { type ApiToken, type SeedData, apiAuthHeader, logIn, readApiToken } from './support/session';

/**
 * Prepares the test instance before any test runs:
 *  1. logs in as the administrator and saves the browser session,
 *  2. makes sure an administrator API token exists (created through the UI,
 *     because BookStack offers no other way to issue the first token),
 *  3. seeds users and content through the REST API.
 * Every step is idempotent, so it is safe against a fresh or a reused instance.
 */
export default async function globalSetup(): Promise<void> {
  mkdirSync(paths.authDir, { recursive: true });
  resetRateLimits();

  const token = (await reuseExistingToken()) ?? (await createTokenThroughUi());
  writeFileSync(paths.apiToken, JSON.stringify(token, null, 2));

  const api = await request.newContext({ baseURL, extraHTTPHeaders: apiAuthHeader(token) });
  try {
    const seed = await seedData(api);
    writeFileSync(paths.seed, JSON.stringify(seed, null, 2));
  } finally {
    await api.dispose();
  }
}

/**
 * BookStack keeps login and password-reset rate-limit counters in its cache. Clearing the cache
 * on the local Docker instance lets the suite be rerun within the same minute. Set
 * RESET_RATE_LIMITS=false when testing an environment that is not this Docker Compose setup.
 */
function resetRateLimits(): void {
  if (process.env.RESET_RATE_LIMITS === 'false') {
    return;
  }
  try {
    execFileSync(
      process.env.DOCKER_BIN ?? 'docker',
      ['compose', 'exec', '-T', 'bookstack', 'php', '/app/www/artisan', 'cache:clear'],
      { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' },
    );
  } catch (error) {
    console.warn(
      'Could not reset BookStack rate limits; password reset and login throttling tests may fail ' +
        `if the suite ran in the last minute. ${(error as Error).message.split('\n')[0]}`,
    );
  }
}

async function reuseExistingToken(): Promise<ApiToken | null> {
  if (!existsSync(paths.apiToken)) {
    return null;
  }
  const token = readApiToken();
  const api = await request.newContext({ baseURL, extraHTTPHeaders: apiAuthHeader(token) });
  try {
    const response = await api.get('/api/books?count=1');
    return response.ok() ? token : null;
  } finally {
    await api.dispose();
  }
}

async function createTokenThroughUi(): Promise<ApiToken> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    await logIn(page, accounts.admin);
    await page.goto('/my-account/auth');
    await page.getByRole('link', { name: 'Create Token' }).click();
    await page.locator('input[name="name"]').fill('automation');
    await page.getByRole('button', { name: 'Save' }).click();

    // The secret is shown only once, on the page that follows creation.
    const readOnlyFields = page.locator('input[readonly]');
    await readOnlyFields.nth(1).waitFor();
    const token: ApiToken = {
      id: await readOnlyFields.nth(0).inputValue(),
      secret: await readOnlyFields.nth(1).inputValue(),
    };
    if (!token.id || !token.secret) {
      throw new Error('Could not read the new API token from the page');
    }

    await context.storageState({ path: paths.adminSession });
    return token;
  } finally {
    await browser.close();
  }
}

interface Listing<T> {
  data: T[];
}

async function findFirst<T>(api: APIRequestContext, resource: string, field: string, value: string): Promise<T | null> {
  const response = await api.get(`/api/${resource}`, { params: { [`filter[${field}]`]: value } });
  if (!response.ok()) {
    throw new Error(`GET /api/${resource} failed: ${response.status()} ${await response.text()}`);
  }
  const body = (await response.json()) as Listing<T>;
  return body.data[0] ?? null;
}

async function create<T>(api: APIRequestContext, resource: string, data: Record<string, unknown>): Promise<T> {
  const response = await api.post(`/api/${resource}`, { data });
  if (!response.ok()) {
    throw new Error(`POST /api/${resource} failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function ensureUser(api: APIRequestContext, account: Account, roleName: string): Promise<number> {
  const existing = await findFirst<{ id: number }>(api, 'users', 'email', account.email);
  if (existing) {
    return existing.id;
  }
  const role = await findFirst<{ id: number }>(api, 'roles', 'display_name', roleName);
  if (!role) {
    throw new Error(`Role "${roleName}" not found`);
  }
  const user = await create<{ id: number }>(api, 'users', {
    name: account.name,
    email: account.email,
    password: account.password,
    roles: [role.id],
  });
  return user.id;
}

async function seedData(api: APIRequestContext): Promise<SeedData> {
  const editorId = await ensureUser(api, accounts.editor, 'Editor');
  const viewerId = await ensureUser(api, accounts.viewer, 'Viewer');

  type Book = SeedData['book'];
  type Chapter = SeedData['chapter'];
  type Page = SeedData['page'];

  const bookName = 'QA Seed Book';
  const book =
    (await findFirst<Book>(api, 'books', 'name', bookName)) ??
    (await create<Book>(api, 'books', {
      name: bookName,
      description: 'Baseline content created by the automated test setup.',
    }));

  const chapterName = 'QA Seed Chapter';
  const chapter =
    (await findFirst<Chapter>(api, 'chapters', 'name', chapterName)) ??
    (await create<Chapter>(api, 'chapters', { book_id: book.id, name: chapterName }));

  const pageName = 'QA Seed Page';
  const page =
    (await findFirst<Page>(api, 'pages', 'name', pageName)) ??
    (await create<Page>(api, 'pages', {
      chapter_id: chapter.id,
      name: pageName,
      markdown: '# QA Seed Page\n\nBaseline page used by the smoke checks.',
    }));

  return {
    book: { id: book.id, slug: book.slug, name: book.name },
    chapter: { id: chapter.id, name: chapter.name },
    page: { id: page.id, slug: page.slug, name: page.name },
    users: { editorId, viewerId },
  };
}
