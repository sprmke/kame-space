import { PDFDocument, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the super-admin PDF template upload.
 *
 * The contract that matters is the input gate: a real fillable PDF comes back with its
 * AcroForm field names, a PDF with no fields is refused, and the file is only stored once
 * those pass. Supabase is stubbed at `fetch`, which is the only boundary it crosses.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');
Deno.env.set('SUPER_ADMIN_EMAILS', 'boss@example.test');

const EMAILS: Record<string, string> = {
  'super-token': 'boss@example.test',
  'host-token': 'host@example.test',
};

let storageWrites = 0;

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  if (url.includes('/auth/v1/user')) {
    const auth = new Headers(init?.headers).get('authorization') ?? '';
    const email = EMAILS[auth.replace(/^Bearer\s+/i, '')];
    if (!email) {
      return Promise.resolve(new Response('{"message":"invalid token"}', { status: 401 }));
    }
    return Promise.resolve(
      new Response(JSON.stringify({ user: { id: 'user-super-1', email } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
  }

  if (url.includes('/rest/v1/developments')) {
    return Promise.resolve(
      new Response(JSON.stringify({ id: 'dev-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
  }

  if (url.includes('/storage/v1/object/templates/')) {
    storageWrites += 1;
    return Promise.resolve(
      new Response(JSON.stringify({ Key: 'templates/dev-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
  }

  // Audit write and PostHog capture are fire-and-forget.
  return Promise.resolve(new Response('{}', { status: 201 }));
}) as typeof fetch;

await import('../../upload-development-pdf-template/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const handler = getMountedEdgeHandler('upload-development-pdf-template');
assert(handler, 'the wrapper must mount a handler in test mode');

/** The real GAF template we ship: the field names in the response are its fields. */
const TEMPLATE_PDF = new URL(
  '../../../../ui/public/templates/guest-form-template.pdf',
  import.meta.url
);

/** A one-page PDF with no AcroForm at all, for the reject case. */
async function pdfWithoutForm(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([300, 200]);
  page.drawText('no fields here', { x: 20, y: 100, font, size: 12 });
  return doc.save();
}

async function upload(
  token: string | null,
  options: { fieldCount?: number; developmentId?: string; name?: string } = {}
): Promise<Response> {
  const body = new FormData();
  body.append('developmentId', options.developmentId ?? 'dev-1');
  body.append('name', options.name ?? 'Move-in permit');
  const bytes = options.fieldCount === 0 ? await pdfWithoutForm() : await Deno.readFile(TEMPLATE_PDF);
  // Copy into a fresh ArrayBuffer: pdf-lib returns a Uint8Array over ArrayBufferLike.
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  body.append('file', new File([copied], 'template.pdf', { type: 'application/pdf' }));

  return handler!(
    new Request(`${FUNCTIONS_URL}/upload-development-pdf-template`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    })
  );
}

Deno.test('upload returns the AcroForm field names and stores the file once', async () => {
  storageWrites = 0;
  const response = await upload('super-token');

  assertEquals(response.status, 200);
  const body = (await response.json()) as {
    success?: boolean;
    data?: { storagePath?: string; name?: string; fieldNames?: string[] };
  };
  assertEquals(body.success, true);
  assert(
    (body.data?.fieldNames?.length ?? 0) > 20,
    `expected the template fields, got ${body.data?.fieldNames?.length}`
  );
  assert(body.data?.fieldNames?.includes('unitOwner'));
  assertEquals(body.data?.name, 'Move-in permit');
  assert(body.data?.storagePath?.startsWith('developments/dev-1/pdf-templates/'));
  assertEquals(storageWrites, 1);
});

Deno.test('a PDF with no form fields is refused before anything is stored', async () => {
  storageWrites = 0;
  const response = await upload('super-token', { fieldCount: 0 });

  assertEquals(response.status, 400);
  const body = (await response.json()) as { error?: string };
  assert(body.error && body.error.includes('no fillable form fields'));
  assertEquals(storageWrites, 0);
});

Deno.test('a non-super-admin is rejected by the wrapper', async () => {
  const response = await upload('host-token');
  assertEquals(response.status, 403);
});

Deno.test('a missing token is rejected before the handler runs', async () => {
  const response = await upload(null);
  assertEquals(response.status, 401);
});

Deno.test('developmentId is required', async () => {
  const response = await upload('super-token', { developmentId: '  ' });
  assertEquals(response.status, 400);
});
