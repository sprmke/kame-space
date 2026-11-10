/**
 * `list-organizations` response mapping.
 *
 * Extracted from the handler so it can be unit-tested without starting the HTTP server, and
 * so the response contract lives in exactly one place. Every row always carries `accessKind`,
 * and `planLimited` is always present (false included), which is what the pre-RPC handler
 * returned.
 */

import {
  type AuthenticatedUser,
  isPlatformAdmin,
  isSuperAdminEmail,
  serializeOrganization,
} from './orgAuth.ts';
import type { SupabaseClient } from './supabaseJs.ts';

/** Row shape returned by `list_user_organizations` and the platform-admin variant. */
export type OrgAccessRow = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  settings: Record<string, unknown> | null;
  host_modes: string[] | null;
  created_at: string;
  updated_at: string;
  access_kind: 'owner' | 'org_admin' | 'property_member' | 'platform_admin';
  plan_limited: boolean;
};

export function toOrganizationPayload(rows: OrgAccessRow[]) {
  return rows.map((row) => ({
    ...serializeOrganization({
      ...row,
      settings: row.settings ?? {},
      host_modes: row.host_modes ?? [],
    }),
    accessKind: row.access_kind,
    planLimited: row.plan_limited === true,
  }));
}

/** Load and map the caller's organizations. One RPC, shared by the handler and the bootstrap. */
export async function loadOrganizationsPayload(
  supabase: SupabaseClient,
  user: AuthenticatedUser
): Promise<{ isSuperAdmin: boolean; organizations: ReturnType<typeof toOrganizationPayload> }> {
  const superAdmin = isSuperAdminEmail(user.email);

  const { data, error } = superAdmin
    ? await supabase.rpc('list_all_organizations_for_platform_admin')
    : await supabase.rpc('list_user_organizations', {
        p_user_id: user.id,
        p_platform_admin: isPlatformAdmin(user.email),
      });

  if (error) {
    console.error('[list-organizations]', error.message);
    throw new Error('Failed to list organizations');
  }

  return {
    isSuperAdmin: superAdmin,
    organizations: toOrganizationPayload((data ?? []) as OrgAccessRow[]),
  };
}
