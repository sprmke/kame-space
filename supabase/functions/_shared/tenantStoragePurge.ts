/**
 * Tenant-scoped storage cleanup for property and organization deletion (doc 20, PR-016).
 *
 * Every object a tenant owns sits under a prefix that encodes the tenant, so deletion can
 * remove the whole tree without a per-row path list. Guest-PII buckets are included: a
 * deleted property must not leave IDs, receipts or pet documents behind as orphans.
 *
 * Best effort by design. A storage hiccup must never block the database delete; the caller
 * logs and moves on, and `bun run media:storage-audit` remains the reconcile tool.
 */

import { PROPERTY_MEDIA_BUCKET } from './propertyMedia.ts';

export const MARKETING_MEDIA_BUCKET = 'marketing-media';
export const LISTING_AUTHORIZATION_BUCKET = 'listing-authorization-assets';
export const APP_SETTINGS_ASSETS_BUCKET = 'app-settings-assets';
export const GUEST_CHAT_ATTACHMENTS_BUCKET = 'guest-chat-attachments';

/**
 * Private buckets that can hold guest PII (doc 20 §20.1). Uploads use
 * `{propertyId}/{bookingId}/{fileName}`, so a property prefix covers every booking's files.
 */
export const GUEST_ASSET_BUCKETS = [
  'valid-ids',
  'payment-receipts',
  'pet-vaccinations',
  'pet-images',
  'parking-endorsements',
] as const;

/** Property-scoped prefixes inside `app-settings-assets` (see appSettingsAssetUpload.ts). */
export const APP_SETTINGS_PROPERTY_PREFIXES = [
  'gaf-unit-owner-signature',
  'external-review',
  'external-review-stay',
] as const;

export type StorageRemoval = { bucket: string; prefix: string };

/** Every bucket/prefix a deleted property owns, including its guest documents. */
export function propertyStoragePurgeTargets(input: {
  propertyId: string;
  orgId: string;
  conversationIds?: readonly string[];
}): StorageRemoval[] {
  const { propertyId, orgId, conversationIds = [] } = input;
  return [
    { bucket: PROPERTY_MEDIA_BUCKET, prefix: `${propertyId}/` },
    { bucket: MARKETING_MEDIA_BUCKET, prefix: `${propertyId}/` },
    {
      bucket: LISTING_AUTHORIZATION_BUCKET,
      prefix: `org/${orgId}/property/${propertyId}/`,
    },
    ...APP_SETTINGS_PROPERTY_PREFIXES.map((prefix) => ({
      bucket: APP_SETTINGS_ASSETS_BUCKET,
      prefix: `${prefix}/${propertyId}/`,
    })),
    ...GUEST_ASSET_BUCKETS.map((bucket) => ({ bucket, prefix: `${propertyId}/` })),
    ...conversationIds.map((conversationId) => ({
      bucket: GUEST_CHAT_ATTACHMENTS_BUCKET,
      prefix: `${orgId}/${conversationId}/`,
    })),
  ];
}

type StorageListEntry = { name: string; id?: string | null };
type StorageListResult = {
  data: StorageListEntry[] | null;
  error: { message: string } | null;
};

/** The slice of the Supabase client this helper needs; keeps it testable with a fake. */
export type TenantStorageClient = {
  storage: {
    from(bucket: string): {
      list(path: string, options: { limit: number }): Promise<StorageListResult>;
      remove(paths: string[]): Promise<{ error: { message: string } | null }>;
    };
  };
};

/**
 * Recursively remove every object under a storage prefix. Best effort, never throws.
 * Supabase lists folders with a null id and no metadata, files with one.
 */
export async function removeStoragePrefix(
  client: TenantStorageClient,
  bucket: string,
  prefix: string,
  label = 'tenant-storage'
): Promise<void> {
  const directory = prefix.replace(/\/+$/, '');
  const pending = [directory];
  while (pending.length > 0) {
    const dir = pending.pop()!;
    const { data, error } = await client.storage.from(bucket).list(dir, { limit: 1000 });
    if (error) {
      console.warn(`[${label}] list ${bucket}/${dir}:`, error.message);
      continue;
    }

    const files: string[] = [];
    for (const item of data ?? []) {
      const path = `${dir}/${item.name}`;
      if (item.id === null || item.id === undefined) pending.push(path);
      else files.push(path);
    }

    if (files.length > 0) {
      const { error: removeError } = await client.storage.from(bucket).remove(files);
      if (removeError) {
        console.warn(`[${label}] remove ${bucket}/${dir}:`, removeError.message);
      }
    }
  }
}

/** Remove every target in order. Best effort, never throws. */
export async function purgeStorageTargets(
  client: TenantStorageClient,
  targets: readonly StorageRemoval[],
  label = 'tenant-storage'
): Promise<void> {
  for (const { bucket, prefix } of targets) {
    await removeStoragePrefix(client, bucket, prefix, label);
  }
}
