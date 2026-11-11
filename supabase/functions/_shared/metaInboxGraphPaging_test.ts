import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildMetaConversationsUrl,
  extractMetaPagingCursor,
} from './metaInboxGraphPaging.ts';

const PAGE_ID = '1234567890';
const TOKEN = 'super-secret-page-token';

Deno.test('extractMetaPagingCursor: keeps only the after cursor', () => {
  const cursor = extractMetaPagingCursor(
    `https://graph.facebook.com/v26.0/${PAGE_ID}/conversations?platform=messenger&after=CURSOR123&access_token=${TOKEN}`
  );
  assertEquals(cursor, 'CURSOR123');
  assertEquals(cursor?.includes(TOKEN), false);
});

Deno.test('extractMetaPagingCursor: refuses a paging URL from another host', () => {
  assertEquals(
    extractMetaPagingCursor(`https://evil.example.com/conversations?after=CURSOR123`),
    null
  );
  assertEquals(extractMetaPagingCursor('not a url'), null);
  assertEquals(extractMetaPagingCursor(null), null);
  assertEquals(extractMetaPagingCursor(undefined), null);
});

Deno.test('extractMetaPagingCursor: a paging URL without a cursor is null', () => {
  assertEquals(
    extractMetaPagingCursor(`https://graph.facebook.com/v26.0/${PAGE_ID}/conversations`),
    null
  );
});

Deno.test('buildMetaConversationsUrl: carries the cursor, never a previous URL', () => {
  const url = new URL(
    buildMetaConversationsUrl(PAGE_ID, TOKEN, 'messenger', { after: 'CURSOR123' })
  );
  assertEquals(url.searchParams.get('after'), 'CURSOR123');
  assertEquals(url.searchParams.get('platform'), 'messenger');
  assertEquals(url.searchParams.get('access_token'), TOKEN);
  assertStringIncludes(url.pathname, `/v26.0/${PAGE_ID}/conversations`);
});

Deno.test('buildMetaConversationsUrl: no cursor means the first page', () => {
  const url = new URL(buildMetaConversationsUrl(PAGE_ID, TOKEN, 'instagram'));
  assertEquals(url.searchParams.get('after'), null);
  assertEquals(url.searchParams.get('platform'), 'instagram');
});

Deno.test('the Graph version is v26.0', () => {
  const url = new URL(buildMetaConversationsUrl(PAGE_ID, TOKEN, 'messenger'));
  assertStringIncludes(url.pathname, '/v26.0/');
});
