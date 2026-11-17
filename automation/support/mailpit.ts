import { expect, request } from '@playwright/test';
import { mailpitURL } from './env';

interface MessageSummary {
  ID: string;
  Subject: string;
}

export interface Message {
  ID: string;
  Subject: string;
  From: { Address: string };
  To: { Address: string }[];
  Text: string;
}

/** Messages Mailpit has received for one recipient, newest first. */
export async function messagesTo(address: string): Promise<MessageSummary[]> {
  const api = await request.newContext({ baseURL: mailpitURL });
  try {
    const response = await api.get('/api/v1/search', { params: { query: `to:"${address}"` } });
    expect(response.ok(), `Mailpit search failed: ${response.status()}`).toBeTruthy();
    const body = (await response.json()) as { messages: MessageSummary[] };
    return body.messages;
  } finally {
    await api.dispose();
  }
}

/** Waits until exactly one message has arrived for the recipient and returns it in full. */
export async function waitForSingleMessageTo(address: string): Promise<Message> {
  let found: MessageSummary[] = [];
  await expect
    .poll(async () => (found = await messagesTo(address)).length, {
      message: `waiting for an email to ${address}`,
      timeout: 15_000,
    })
    .toBe(1);

  const api = await request.newContext({ baseURL: mailpitURL });
  try {
    const response = await api.get(`/api/v1/message/${found[0].ID}`);
    expect(response.ok()).toBeTruthy();
    return (await response.json()) as Message;
  } finally {
    await api.dispose();
  }
}

/** First link in the message text that starts with the given URL prefix. */
export function linkStartingWith(message: Message, prefix: string): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = message.Text.match(new RegExp(`${escaped}\\S+`));
  if (!match) {
    throw new Error(`No link starting with ${prefix} in "${message.Subject}"`);
  }
  return match[0];
}
