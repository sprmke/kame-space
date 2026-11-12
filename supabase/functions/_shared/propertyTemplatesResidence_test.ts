import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { getBuiltinPropertyTemplate, resolvePropertyTemplateContent } from './propertyTemplates.ts';

/**
 * Phase 5 resolution order for workflow email bodies (plan §4.1 "building default"):
 * property override → residence `templateDefaults` → built-in. Azure sets no residence
 * template default, so every step below only adds a layer, it never changes Azure's copy.
 */

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function withStubbedDb(
  rows: { propertyTemplate?: unknown; property?: unknown; development?: unknown },
  run: () => Promise<void>
) {
  const realFetch = globalThis.fetch;
  Deno.env.set('SUPABASE_URL', 'http://stub.local');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'stub-key');
  globalThis.fetch = (input: Request | URL | string) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    );
    if (url.pathname.endsWith('/property_template_contents')) {
      return Promise.resolve(json(rows.propertyTemplate ?? null));
    }
    if (url.pathname.endsWith('/properties')) {
      return Promise.resolve(json(rows.property ?? null));
    }
    if (url.pathname.endsWith('/developments')) {
      return Promise.resolve(json(rows.development ?? null));
    }
    return Promise.resolve(new Response(`unexpected ${url.pathname}`, { status: 500 }));
  };
  try {
    await run();
  } finally {
    globalThis.fetch = realFetch;
  }
}

const RESIDENCE_TEMPLATE = {
  settings: {
    templateDefaults: {
      'email-gaf-request': { content: '<p>Residence copy</p>' },
    },
  },
};

Deno.test('a property override wins over the residence default', async () => {
  await withStubbedDb(
    {
      propertyTemplate: { content: '<p>Property copy</p>', section_image_url: null, updated_at: null },
      property: { development_id: 'dev-1', residence_name: 'Test Residence' },
      development: RESIDENCE_TEMPLATE,
    },
    async () => {
      const resolved = await resolvePropertyTemplateContent(PROPERTY_ID, 'email-gaf-request');
      assert(resolved.content.includes('Property copy'));
    }
  );
});

Deno.test('the residence default reaches a property that did not override', async () => {
  await withStubbedDb(
    {
      propertyTemplate: null,
      property: { development_id: 'dev-1', residence_name: 'Test Residence' },
      development: RESIDENCE_TEMPLATE,
    },
    async () => {
      const resolved = await resolvePropertyTemplateContent(PROPERTY_ID, 'email-gaf-request');
      assert(resolved.content.includes('Residence copy'));
    }
  );
});

Deno.test('a residence with no template default falls back to the built-in body', async () => {
  await withStubbedDb(
    {
      propertyTemplate: null,
      property: { development_id: 'dev-1', residence_name: 'Azure North Residences' },
      development: { settings: { pmoEmail: 'pmo@azure.test' } },
    },
    async () => {
      const resolved = await resolvePropertyTemplateContent(PROPERTY_ID, 'email-gaf-request');
      const builtin = getBuiltinPropertyTemplate('email-gaf-request');
      assertEquals(resolved.content, builtin?.defaultContent);
    }
  );
});

Deno.test('a residence read failure falls back instead of breaking the email', async () => {
  await withStubbedDb(
    {
      propertyTemplate: null,
      // No property row: the residence lookup returns generic, never an error.
      property: null,
    },
    async () => {
      const resolved = await resolvePropertyTemplateContent(PROPERTY_ID, 'email-pet-request');
      const builtin = getBuiltinPropertyTemplate('email-pet-request');
      assertEquals(resolved.content, builtin?.defaultContent);
    }
  );
});
