#!/usr/bin/env node
/**
 * The single production test tenant.
 *
 * Purpose: give an AI agent (or a human) a place to run production measurements, RBAC
 * checks and UI verification without touching a real host's data.
 *
 * Guardrails, in order of strength:
 *
 * 1. **The database** enforces it. `organizations_single_test_tenant` is a partial unique
 *    index, so a second test org is impossible. `properties_test_never_active` and
 *    `parkings_test_never_active` make an ACTIVE test listing impossible, which is what
 *    keeps the tenant out of every public surface (they all key off ACTIVE).
 * 2. **This script** refuses to create anything if a different test org already exists,
 *    and it only ever writes rows belonging to the test org.
 * 3. **`--apply`** additionally requires `CONFIRM_TEST_TENANT=yes` in the environment, so
 *    it cannot be triggered by an accidental copy-paste of a command.
 *
 * Usage:
 *
 *   node scripts/dev/test-tenant.mjs            # read-only audit; safe any time
 *   CONFIRM_TEST_TENANT=yes node scripts/dev/test-tenant.mjs --apply
 *
 * Reading docs/architecture/test-tenant.md is a prerequisite for --apply.
 */
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const ENV_FILES = ['supabase/.env.management.local', 'supabase/.env.dev.local'];

const ORG_SLUG = 'kame-test-tenant';
const ORG_NAME = 'Kame Test Tenant (not public)';
const PROPERTY_SLUG = 'kame-test-property';
const PROPERTY_NAME = 'Test Property';
const PARKING_SLUG = 'kame-test-parking';
const OWNER_EMAIL = 'ai-perf-probe@kamehomes.space';
const PASSWORD_ENV_KEY = 'TEST_TENANT_PASSWORD';

/** Read a KEY from the first env file that defines it. Never printed. */
function envValue(key) {
  if (process.env[key]) return process.env[key];
  for (const relative of ENV_FILES) {
    const file = path.join(repoRoot, relative);
    if (!existsSync(file)) continue;
    const line = readFileSync(file, 'utf8')
      .split('\n')
      .find((candidate) => candidate.trim().startsWith(`${key}=`));
    if (line)
      return line
        .slice(line.indexOf('=') + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
  }
  return '';
}

const apply = process.argv.includes('--apply');

const dbUrl = envValue('PROD_DB_URL') || envValue('DB_URL');
const supabaseUrl = (envValue('PUBLIC_API_URL') || envValue('DEV_SUPABASE_URL') || '').replace(
  /\/$/,
  ''
);
const serviceRoleKey = envValue('DEV_SERVICE_ROLE_KEY') || envValue('TARGET_SERVICE_ROLE_KEY');

function fail(message) {
  console.error(`test-tenant: ${message}`);
  process.exit(1);
}

if (!dbUrl) fail('no connection string. Set PROD_DB_URL or DB_URL.');

async function adminApi(pathname, init = {}) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin${pathname}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

function randomPassword() {
  // 24 url-safe chars from a CSPRNG. Only used for the probe account.
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url').slice(0, 24);
}

async function findOwnerId(client) {
  const existing = await adminApi(`/users?per_page=200`);
  if (existing.ok) {
    const users = Array.isArray(existing.body?.users) ? existing.body.users : [];
    const match = users.find((user) => user.email === OWNER_EMAIL);
    if (match) return { id: match.id, created: false };
  }
  const { rows } = await client.query(
    'SELECT id FROM auth.users WHERE lower(email) = lower($1) LIMIT 1',
    [OWNER_EMAIL]
  );
  return rows[0] ? { id: rows[0].id, created: false } : null;
}

async function audit(client) {
  const { rows: columns } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'organizations'
       AND column_name = 'is_test'`
  );
  if (columns.length === 0) {
    console.log('test-tenant: migration 20261322000000_test_tenant_isolation is NOT applied.');
    console.log('test-tenant: apply it before creating the tenant. Audit incomplete.');
    return { migrationApplied: false };
  }

  const { rows: orgs } = await client.query(
    `SELECT id, slug, name, is_test FROM public.organizations WHERE is_test ORDER BY created_at`
  );
  const { rows: properties } = await client.query(
    `SELECT id, slug, status, is_test FROM public.properties WHERE is_test`
  );
  const { rows: parkings } = await client.query(
    `SELECT id, slug, status, is_test FROM public.parkings WHERE is_test`
  );

  const problems = [];
  if (orgs.length > 1) problems.push(`${orgs.length} test orgs exist; exactly one is allowed`);
  for (const property of properties) {
    if (property.status === 'ACTIVE') problems.push(`test property ${property.slug} is ACTIVE`);
  }
  for (const parking of parkings) {
    if (parking.status === 'ACTIVE') problems.push(`test parking ${parking.slug} is ACTIVE`);
  }
  if (orgs.length === 1 && orgs[0].slug !== ORG_SLUG) {
    problems.push(`the test org slug is ${orgs[0].slug}, expected ${ORG_SLUG}`);
  }

  console.log(
    `test-tenant: ${orgs.length} test org, ${properties.length} test properties, ${parkings.length} test parkings`
  );
  for (const org of orgs) console.log(`  org      ${org.slug}  (${org.name})`);
  for (const property of properties) {
    console.log(`  property ${property.slug}  status=${property.status}`);
  }
  for (const parking of parkings) {
    console.log(`  parking  ${parking.slug}  status=${parking.status}`);
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(`  PROBLEM  ${problem}`);
    return { migrationApplied: true, problems, orgCount: orgs.length };
  }
  console.log('test-tenant: OK, invariants hold');
  return { migrationApplied: true, problems: [], orgCount: orgs.length };
}

async function createTenant(client) {
  if (process.env.CONFIRM_TEST_TENANT !== 'yes') {
    fail('--apply requires CONFIRM_TEST_TENANT=yes. Read docs/architecture/test-tenant.md first.');
  }
  if (!supabaseUrl || !serviceRoleKey) {
    fail('--apply needs PUBLIC_API_URL/DEV_SUPABASE_URL and a service role key.');
  }

  const { rows: existingOrgs } = await client.query(
    `SELECT id, slug FROM public.organizations WHERE is_test LIMIT 2`
  );
  const foreign = existingOrgs.find((org) => org.slug !== ORG_SLUG);
  if (foreign) {
    fail(`a different test org already exists (${foreign.slug}). Exactly one is allowed.`);
  }

  let ownerId;
  let createdUser = false;
  const found = await findOwnerId(client);
  if (found) {
    ownerId = found.id;
  } else {
    const password = randomPassword();
    const created = await adminApi('/users', {
      method: 'POST',
      body: JSON.stringify({ email: OWNER_EMAIL, password, email_confirm: true }),
    });
    if (!created.ok) {
      fail(
        `could not create the probe user (${created.status}): ${created.body?.msg ?? 'unknown'}`
      );
    }
    ownerId = created.body.id;
    createdUser = true;
    const envFile = path.join(repoRoot, 'supabase/.env.management.local');
    appendFileSync(envFile, `\n${PASSWORD_ENV_KEY}=${password}\n`);
    console.log(
      `test-tenant: wrote ${PASSWORD_ENV_KEY} to supabase/.env.management.local (gitignored)`
    );
  }

  await client.query('BEGIN');
  try {
    const { rows: orgRows } = await client.query(
      `INSERT INTO public.organizations (owner_id, name, slug, description, is_test)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
       RETURNING id, slug, is_test`,
      [
        ownerId,
        ORG_NAME,
        ORG_SLUG,
        'Synthetic org for production measurement. Never public. See docs/architecture/test-tenant.md.',
      ]
    );
    const org = orgRows[0];

    const { rows: propertyRows } = await client.query(
      `INSERT INTO public.properties
         (organization_id, name, slug, type, status, inactive_reason, address, tower_and_unit, max_guests)
       VALUES ($1, $2, $3, 'CONDO', 'INACTIVE', 'pending_verification', $4, $5, 2)
       ON CONFLICT (organization_id, slug) DO UPDATE
         SET name = EXCLUDED.name, status = 'INACTIVE', inactive_reason = 'pending_verification'
       RETURNING id, slug, status, is_test`,
      [org.id, PROPERTY_NAME, PROPERTY_SLUG, 'Test address', 'Test Tower 1']
    );

    const { rows: parkingRows } = await client.query(
      `INSERT INTO public.parkings
         (organization_id, name, slug, status, residence_name, tower, level, slot_label)
       VALUES ($1, $2, $3, 'INACTIVE', $4, $5, $6, $7)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, status = 'INACTIVE'
       RETURNING id, slug, status, is_test`,
      [org.id, 'Test Parking', PARKING_SLUG, 'Test Residence', 'Test Tower 1', 'L2', 'T-01']
    );

    await client.query('COMMIT');
    console.log('test-tenant: created');
    console.log(`  org      ${org.slug}  id=${org.id}  is_test=${org.is_test}`);
    console.log(`  property ${propertyRows[0].slug}  is_test=${propertyRows[0].is_test}`);
    console.log(`  parking  ${parkingRows[0].slug}  is_test=${parkingRows[0].is_test}`);
    console.log(
      `  owner    ${OWNER_EMAIL}  password ${
        createdUser ? 'generated, see supabase/.env.management.local' : `in ${PASSWORD_ENV_KEY}`
      }`
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    // Always audit first: it is the safety check before any write.
    const result = await audit(client);
    if (!result.migrationApplied) {
      process.exitCode = 2;
      return;
    }
    if (apply && (result.problems?.length ?? 0) === 0 && result.orgCount === 0) {
      await createTenant(client);
      await audit(client);
    } else if (apply) {
      console.log('test-tenant: nothing to create, the tenant already exists');
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`test-tenant failed: ${error.message}`);
  process.exit(1);
});
