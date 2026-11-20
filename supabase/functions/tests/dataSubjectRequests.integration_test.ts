/**
 * Data-subject export and deletion requests (ledger PR-145) against the local stack.
 *
 * Creates a throwaway auth user per test, exercises the export shape and the reviewed
 * deletion request, then removes both. No hosted writes.
 *
 * Run with a local stack up:
 *   bun run test:edge:privacy
 */

import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

import {
  buildDataSubjectExport,
  listDueDeletionRequests,
  requestAccountDeletion,
} from '../_shared/dataSubjectService.ts';
import { LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from './_localSupabaseEnv.ts';

const supabase = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY);

type TestUser = { id: string; email: string };

async function withUser(run: (user: TestUser) => Promise<void>) {
  const email = `privacy-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: `Test-${crypto.randomUUID()}`,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Could not create test user: ${error?.message}`);
  const user = { id: data.user.id, email };
  try {
    await run(user);
  } finally {
    await supabase.from('data_subject_requests').delete().eq('user_id', user.id);
    await supabase.auth.admin.deleteUser(user.id);
  }
}

Deno.test('data export returns the caller scope with empty collections for a new user', () =>
  withUser(async (user) => {
    const payload = await buildDataSubjectExport(user);
    const subject = payload.subject as { user_id: string; email: string };
    assertEquals(subject.user_id, user.id);
    assertEquals(subject.email, user.email);
    assert(Array.isArray((payload.guest as { bookings: unknown[] }).bookings));
    assert(Array.isArray((payload.host as { owned_organizations: unknown[] }).owned_organizations));
    assertEquals(payload.profile, null);
    assert(String(payload.retention_note).includes('financial records'));
  })
);

Deno.test('a deletion request is idempotent and appears once it is due', () =>
  withUser(async (user) => {
    const first = await requestAccountDeletion(user);
    assertEquals(first.kind, 'delete');
    assertEquals(first.status, 'pending');
    const due = new Date(first.due_at).getTime() - Date.now();
    assert(due > 14 * 24 * 60 * 60 * 1000 && due <= 15 * 24 * 60 * 60 * 1000);

    const second = await requestAccountDeletion(user);
    assertEquals(second.id, first.id);

    assertEquals(
      (await listDueDeletionRequests()).some((row) => row.id === first.id),
      false
    );

    await supabase
      .from('data_subject_requests')
      .update({ due_at: new Date(Date.now() - 1000).toISOString() })
      .eq('id', first.id);

    assertEquals(
      (await listDueDeletionRequests()).some((row) => row.id === first.id),
      true
    );
  })
);
