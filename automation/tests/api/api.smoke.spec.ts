import { expect, test } from '@playwright/test';
import { apiAuthHeader, readApiToken, readSeed } from '../../support/session';

test.describe('REST API @smoke', () => {
  test('lists books for a valid administrator token', async ({ request }) => {
    const seed = readSeed();

    const response = await request.get('/api/books', { headers: apiAuthHeader(readApiToken()) });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.map((book: { id: number }) => book.id)).toContain(seed.book.id);
  });

  test('rejects a request without a token', async ({ request }) => {
    const response = await request.get('/api/books');

    expect(response.status()).toBe(401);
  });

  test('rejects a request with an invalid token secret', async ({ request }) => {
    const token = readApiToken();

    const response = await request.get('/api/books', {
      headers: apiAuthHeader({ id: token.id, secret: 'not-the-secret' }),
    });

    expect(response.status()).toBe(401);
  });
});
