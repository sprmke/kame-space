/**
 * marketing-music — music for marketing videos: grouped browse/search across free sources
 * (Jamendo, Audius), Instagram's licensed Reels music, and caching audio to property-media so a
 * video export can mix it. Auth: serveAuthenticated + marketing.* property-team RBAC.
 *
 * GET  ?group=trending|popular|<genre|mood|collection>&q=&page=0&only=jamendo|audius
 *        — merged Jamendo + Audius list with per-source status (see _shared/musicGroups.ts)
 * GET  ?source=instagram&q=&connectionId=   — Instagram music for Reels (trending when q is empty)
 * GET  ?source=instagram&audioId=&connectionId= — one Instagram song with a fresh preview URL
 * POST JSON { action: 'import-track', source: 'jamendo'|'audius', trackId }
 *      JSON { action: 'import-jamendo', trackId }   — kept for older clients
 *      JSON { action: 'import-url', url }
 * POST multipart file= — upload own audio
 */

import { createServiceClient, requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import { audiusStreamUrl, fetchAudiusTrackById } from '../_shared/audiusMusic.ts';
import {
  fetchInstagramAudioById,
  InstagramAudioError,
  searchInstagramAudio,
} from '../_shared/instagramAudio.ts';
import { fetchJamendoTrackById, readJamendoClientId } from '../_shared/jamendoMusic.ts';
import { getPageAccessToken } from '../_shared/metaInboxGraphHttp.ts';
import { resolveEffectiveMetaConnection } from '../_shared/metaInboxScope.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  browseMusic,
  defaultBrowseDeps,
  resolveGroup,
  UnknownMusicGroupError,
} from '../_shared/musicCatalog.ts';
import {
  extensionForAudioMime,
  fetchRemoteAudioBytes,
  uploadMarketingAudioBytes,
} from '../_shared/marketingMusicStorage.ts';
import {
  resolveOrganizationIdForProperty,
  resolveScopedPropertyAccess,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import type { SocialChannelConnectionRow } from '../_shared/socialInboxTypes.ts';

type ImportedMusic = {
  url: string;
  title?: string;
  artist?: string;
  source: 'jamendo' | 'audius' | 'upload' | 'url';
  trackId?: string;
};

type InstagramMusicStatus = 'ok' | 'not_connected' | 'no_access' | 'reconnect' | 'error';

type SupabaseAdmin = ReturnType<typeof createServiceClient>;

/** Only what an Instagram music call needs; the token is decrypted by `getPageAccessToken`. */
type InstagramConnection = Pick<
  SocialChannelConnectionRow,
  'id' | 'platform' | 'status' | 'meta_ig_user_id' | 'encrypted_access_token'
>;

const INSTAGRAM_CONNECTION_COLUMNS =
  'id, platform, status, meta_ig_user_id, encrypted_access_token';

/** The Instagram account a property posts to: the chosen connection, else the effective one. */
async function resolveInstagramConnection(
  sb: SupabaseAdmin,
  propertyId: string,
  connectionId: string | null
): Promise<InstagramConnection | null> {
  const organizationId = await resolveOrganizationIdForProperty(propertyId);

  if (connectionId) {
    const { data } = await sb
      .from('social_channel_connections')
      .select(INSTAGRAM_CONNECTION_COLUMNS)
      .eq('id', connectionId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    const row = data as InstagramConnection | null;
    return row?.meta_ig_user_id && row.encrypted_access_token && row.status === 'connected'
      ? row
      : null;
  }

  const effective = await resolveEffectiveMetaConnection(organizationId, { propertyId });
  return (
    effective.connections.find(
      (c) => c.platform === 'instagram' && c.meta_ig_user_id && c.encrypted_access_token
    ) ?? null
  );
}

function instagramStatusFor(error: unknown): { status: InstagramMusicStatus; message: string } {
  if (error instanceof InstagramAudioError) {
    if (error.reason === 'no_access') {
      return { status: 'no_access', message: 'Instagram music is not available for this account.' };
    }
    if (error.reason === 'token') {
      return { status: 'reconnect', message: 'Reconnect Instagram to browse its music.' };
    }
  }
  return { status: 'error', message: 'Instagram music could not load.' };
}

async function handleInstagramGet(
  req: Request,
  sb: SupabaseAdmin,
  propertyId: string,
  url: URL
): Promise<Response> {
  const connection = await resolveInstagramConnection(
    sb,
    propertyId,
    url.searchParams.get('connectionId')?.trim() || null
  );
  if (!connection) {
    return jsonSuccess(req, { tracks: [], instagram: { status: 'not_connected' } });
  }

  const audioId = url.searchParams.get('audioId')?.trim();
  const query = url.searchParams.get('q')?.trim() || undefined;

  try {
    // `getPageAccessToken` reads only `encrypted_access_token`.
    const accessToken = await getPageAccessToken(connection as SocialChannelConnectionRow);
    const igUserId = connection.meta_ig_user_id!;

    if (audioId) {
      const track = await fetchInstagramAudioById({ audioId, igUserId, accessToken });
      if (!track) return jsonError(req, 'Song not found', 404);
      return jsonSuccess(req, { track, instagram: { status: 'ok' } });
    }

    const tracks = await searchInstagramAudio({ igUserId, accessToken, query });
    return jsonSuccess(req, {
      tracks,
      instagram: { status: 'ok' },
      connectionId: connection.id,
    });
  } catch (error) {
    const { status, message } = instagramStatusFor(error);
    if (audioId) return jsonError(req, message, status === 'error' ? 502 : 403);
    return jsonSuccess(req, { tracks: [], instagram: { status, message } });
  }
}

async function importJamendo(
  sb: SupabaseAdmin,
  propertyId: string,
  trackId: string
): Promise<ImportedMusic> {
  const clientId = readJamendoClientId();
  if (!clientId) throw new Error('Jamendo is not configured');

  const track = await fetchJamendoTrackById(clientId, trackId);
  if (!track) throw new Error('Track not found');

  // Jamendo download URLs reject server-side fetches; use the official file API (stream).
  const fileApiUrl = new URL('https://api.jamendo.com/v3.0/tracks/file/');
  fileApiUrl.searchParams.set('client_id', clientId);
  fileApiUrl.searchParams.set('id', trackId);
  fileApiUrl.searchParams.set('action', 'stream');
  fileApiUrl.searchParams.set('audioformat', 'mp32');

  let remote;
  try {
    remote = await fetchRemoteAudioBytes(fileApiUrl.toString());
  } catch {
    remote = await fetchRemoteAudioBytes(track.streamUrl);
  }

  const ext = extensionForAudioMime(remote.mime, remote.fileName);
  const publicUrl = await uploadMarketingAudioBytes(
    sb,
    propertyId,
    remote.bytes,
    remote.mime,
    ext,
    `jamendo-${track.id}`
  );
  return {
    url: publicUrl,
    title: track.title,
    artist: track.artist,
    source: 'jamendo',
    trackId: track.id,
  };
}

async function importAudius(
  sb: SupabaseAdmin,
  propertyId: string,
  trackId: string
): Promise<ImportedMusic> {
  // Look the track up first: it must still be streamable and short enough, and it gives the credit.
  const track = await fetchAudiusTrackById(trackId);
  if (!track) throw new Error('Track not found');

  const remote = await fetchRemoteAudioBytes(audiusStreamUrl(track.id));
  const ext = extensionForAudioMime(remote.mime, remote.fileName);
  const publicUrl = await uploadMarketingAudioBytes(
    sb,
    propertyId,
    remote.bytes,
    remote.mime,
    ext,
    `audius-${track.id}`
  );
  return {
    url: publicUrl,
    title: track.title,
    artist: track.artist,
    source: 'audius',
    trackId: track.id,
  };
}

serveAuthenticated('marketing-music', async (req) => {
  const sb = createServiceClient();
  const url = new URL(req.url);
  let propertyId: string;

  if (req.method === 'GET') {
    try {
      const scoped = await resolveScopedPropertyAccess(req, 'marketing:view');
      propertyId = scoped.property.id;
      await requirePropertyPermissionAndFeature(
        req,
        propertyId,
        'marketing:view',
        'marketingStudio'
      );
    } catch (err) {
      if (err instanceof Response) return err;
      throw err;
    }
  } else if (req.method === 'POST') {
    try {
      const scoped = await resolveScopedPropertyAccess(req, 'marketing.content:edit');
      propertyId = scoped.property.id;
      await requirePropertyPermissionAndFeature(
        req,
        propertyId,
        'marketing.content:edit',
        'marketingStudio'
      );
    } catch (err) {
      if (err instanceof Response) return err;
      throw err;
    }
  } else {
    return jsonError(req, 'Method not allowed', 405);
  }

  if (req.method === 'GET') {
    if (url.searchParams.get('source') === 'instagram') {
      return handleInstagramGet(req, sb, propertyId, url);
    }

    let group;
    try {
      group = resolveGroup(url.searchParams.get('group'));
    } catch (error) {
      if (error instanceof UnknownMusicGroupError) return jsonError(req, error.message, 400);
      throw error;
    }

    const search = url.searchParams.get('q')?.trim() || undefined;
    const page = Number(url.searchParams.get('page') ?? 0);

    // `only` limits the list to one source. The default-music resolver and the older scene editor
    // need Jamendo ids, so they never see Audius tracks.
    const deps = defaultBrowseDeps(readJamendoClientId());
    const only = url.searchParams.get('only');
    if (only === 'jamendo') deps.audiusOn = false;
    if (only === 'audius') deps.jamendoClientId = null;

    const result = await browseMusic(
      { group, search, page: Number.isFinite(page) ? page : 0 },
      deps
    );
    return jsonSuccess(req, {
      ...result,
      // Older clients read this flag to decide whether to show the list at all.
      jamendoConfigured: result.sources.jamendo !== 'off',
    });
  }

  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return jsonError(req, 'file is required', 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = file.type || 'audio/mpeg';
    const ext = extensionForAudioMime(mime, file.name);
    const requestedKey = formData.get('fileKey');
    const fileKey =
      typeof requestedKey === 'string' && requestedKey.trim()
        ? requestedKey.trim().replace(/[^a-zA-Z0-9_-]/g, '')
        : `upload-${crypto.randomUUID().slice(0, 12)}`;

    try {
      const publicUrl = await uploadMarketingAudioBytes(sb, propertyId, bytes, mime, ext, fileKey);
      const title = file.name.replace(/\.[^.]+$/, '').trim() || undefined;
      const payload: ImportedMusic = { url: publicUrl, title, source: 'upload' };
      return jsonSuccess(req, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      return jsonError(req, message, 400);
    }
  }

  const body = await readJsonBody(req);
  const action = typeof body.action === 'string' ? body.action.trim() : '';

  if (action === 'import-jamendo' || action === 'import-track') {
    const trackId = typeof body.trackId === 'string' ? body.trackId.trim() : '';
    if (!trackId) return jsonError(req, 'trackId is required', 400);

    const source = action === 'import-jamendo' ? 'jamendo' : String(body.source ?? '').trim();
    if (source !== 'jamendo' && source !== 'audius') {
      return jsonError(req, 'source must be jamendo or audius', 400);
    }

    try {
      const payload =
        source === 'jamendo'
          ? await importJamendo(sb, propertyId, trackId)
          : await importAudius(sb, propertyId, trackId);
      return jsonSuccess(req, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      const status =
        message === 'Jamendo is not configured' ? 503 : message === 'Track not found' ? 404 : 400;
      return jsonError(req, message, status);
    }
  }

  if (action === 'import-url') {
    const remoteUrl = typeof body.url === 'string' ? body.url.trim() : '';
    if (!remoteUrl) return jsonError(req, 'url is required', 400);

    try {
      const remote = await fetchRemoteAudioBytes(remoteUrl);
      const ext = extensionForAudioMime(remote.mime, remote.fileName);
      const fileKey = `url-${crypto.randomUUID().slice(0, 12)}`;
      const publicUrl = await uploadMarketingAudioBytes(
        sb,
        propertyId,
        remote.bytes,
        remote.mime,
        ext,
        fileKey
      );

      const payload: ImportedMusic = {
        url: publicUrl,
        title: remote.fileName?.replace(/\.[^.]+$/, '').trim() || undefined,
        source: 'url',
      };
      return jsonSuccess(req, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      return jsonError(req, message, 400);
    }
  }

  return jsonError(req, 'Unknown action', 400);
});
