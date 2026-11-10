/**
 * Shared parking gallery media upload — used by upload-parking-media and the AI
 * assistant apply tool. Mirrors `propertyMediaUpload.ts` capped at 3 photos.
 */

import { createClient } from './supabaseJs.ts';
import { createServiceClient } from './orgAuth.ts';
import {
  MAX_PARKING_IMAGES,
  normalizeParkingMediaItems,
  parkingMediaItemsFromSettings,
  parkingMediaSettingsPatch,
  type ParkingMediaRecord,
} from './parkingMedia.ts';
import { PROPERTY_MEDIA_BUCKET } from './propertyMedia.ts';
import { assertWithinUploadLimit } from './uploadLimits.ts';
import { formatPublicUrl } from './utils.ts';
import { assertUploadMatchesBytes } from './sniffMime.ts';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

function extensionForMime(mime: string, fileName: string): string {
  const fromName = fileName.includes('.') ? `.${fileName.split('.').pop()?.toLowerCase()}` : '';
  if (fromName && fromName.length <= 6) return fromName;
  switch (mime) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/heic':
      return '.heic';
    case 'image/heif':
      return '.heif';
    default:
      return '.jpg';
  }
}

function parkingMediaStoragePath(parkingId: string, mediaId: string, ext: string): string {
  return `parking/${parkingId}/${mediaId}${ext}`;
}

function parkingStoragePrefix(parkingId: string): string {
  return `parking/${parkingId}/`;
}

async function readSettings(parkingId: string): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('parkings')
    .select('settings')
    .eq('id', parkingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const settings = data?.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return {};
  }
  return settings as Record<string, unknown>;
}

export async function readParkingMedia(parkingId: string): Promise<ParkingMediaRecord[]> {
  return parkingMediaItemsFromSettings(await readSettings(parkingId));
}

export async function persistParkingMedia(
  parkingId: string,
  items: ParkingMediaRecord[]
): Promise<ParkingMediaRecord[]> {
  const supabase = createServiceClient();
  const current = await readSettings(parkingId);
  const patch = parkingMediaSettingsPatch(items);
  const { error } = await supabase
    .from('parkings')
    .update({ settings: { ...current, ...patch }, updated_at: new Date().toISOString() })
    .eq('id', parkingId);
  if (error) throw new Error(error.message);
  return normalizeParkingMediaItems(patch.media);
}

async function removeStorageObjects(parkingId: string, paths: (string | undefined)[]) {
  const prefix = parkingStoragePrefix(parkingId);
  const targets = paths.filter(
    (path): path is string => typeof path === 'string' && path.startsWith(prefix)
  );
  if (targets.length === 0) return;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const { error } = await supabase.storage.from(PROPERTY_MEDIA_BUCKET).remove(targets);
  if (error) {
    console.warn('[parkingMediaUpload] Storage delete failed:', error.message);
  }
}

export type ApplyParkingImageInput = {
  parkingId: string;
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
  /** Force the new photo to be the cover. */
  setPrimary?: boolean;
};

export type ApplyParkingImageResult = {
  item: ParkingMediaRecord;
  media: ParkingMediaRecord[];
};

export async function applyParkingImageFromBytes(
  input: ApplyParkingImageInput
): Promise<ApplyParkingImageResult> {
  const mime = (input.mimeType || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error('File must be JPEG, PNG, WebP, or GIF');
  }
  assertUploadMatchesBytes(input.bytes, mime, ALLOWED_MIME);

  const file = new File([input.bytes as unknown as BlobPart], input.fileName || 'photo.jpg', {
    type: mime,
  });
  assertWithinUploadLimit(file, 'image');

  const current = await readParkingMedia(input.parkingId);
  if (current.length >= MAX_PARKING_IMAGES) {
    throw new Error(`At most ${MAX_PARKING_IMAGES} photos are allowed`);
  }

  const mediaId = crypto.randomUUID();
  const ext = extensionForMime(mime, input.fileName || 'photo.jpg');
  const storagePath = parkingMediaStoragePath(input.parkingId, mediaId, ext);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { error: uploadError } = await supabase.storage
    .from(PROPERTY_MEDIA_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: mime, cacheControl: '31536000' });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(PROPERTY_MEDIA_BUCKET).getPublicUrl(storagePath);
  const safePublicUrl = formatPublicUrl(publicUrl);

  const autoPrimary = !current.some((item) => item.isPrimary);
  const shouldBePrimary = input.setPrimary === true || autoPrimary;

  const draft: ParkingMediaRecord[] = [
    ...current.map((item) => (shouldBePrimary ? { ...item, isPrimary: false } : item)),
    {
      id: mediaId,
      url: safePublicUrl,
      storagePath,
      type: 'image',
      isPrimary: shouldBePrimary,
      order: current.length,
    },
  ];

  const media = await persistParkingMedia(input.parkingId, draft);
  const item = media.find((entry) => entry.id === mediaId);
  if (!item) throw new Error('Uploaded photo was not saved');

  return { item, media };
}

export type RemoveParkingMediaInput = {
  parkingId: string;
  mediaId?: string | null;
  storagePath?: string | null;
};

export async function removeParkingMedia(
  input: RemoveParkingMediaInput
): Promise<ParkingMediaRecord[]> {
  const current = await readParkingMedia(input.parkingId);
  const mediaId = input.mediaId?.trim() ?? '';
  const storagePath = input.storagePath?.trim() ?? '';

  const next = current.filter((item) => {
    if (mediaId && item.id === mediaId) return false;
    if (storagePath && item.storagePath === storagePath) return false;
    return true;
  });

  if (next.length === current.length) return current;

  const removedPaths = current
    .filter((item) => !next.includes(item))
    .map((item) => item.storagePath);
  const media = await persistParkingMedia(input.parkingId, next);
  await removeStorageObjects(input.parkingId, removedPaths);

  return media;
}

export type ApplyParkingCoverInput = {
  parkingId: string;
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
};

export type ApplyParkingCoverResult = {
  coverImage: string;
  coverImageStoragePath: string | null;
  replacedExisting: boolean;
};

/**
 * Set the cover photo (AI assistant flow). Adds the photo as cover; when the
 * gallery is already full the current cover is replaced so the action still works.
 */
export async function applyParkingCoverFromBytes(
  input: ApplyParkingCoverInput
): Promise<ApplyParkingCoverResult> {
  const current = await readParkingMedia(input.parkingId);
  const replacedExisting = current.some((item) => item.isPrimary);

  if (current.length >= MAX_PARKING_IMAGES) {
    const primary = current.find((item) => item.isPrimary) ?? current[0];
    if (primary) await removeParkingMedia({ parkingId: input.parkingId, mediaId: primary.id });
  }

  const { media } = await applyParkingImageFromBytes({ ...input, setPrimary: true });
  const primary = media.find((item) => item.isPrimary) ?? media[0];
  if (!primary) throw new Error('Cover photo was not saved');

  return {
    coverImage: primary.url,
    coverImageStoragePath: primary.storagePath ?? null,
    replacedExisting,
  };
}
