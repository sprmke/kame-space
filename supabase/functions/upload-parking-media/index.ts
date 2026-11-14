/**
 * upload-parking-media — Admin upload/delete for parking gallery photos (max 3).
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleEdgeError } from '../_shared/httpResponse.ts';
import {
  applyParkingImageFromBytes,
  readParkingMedia,
  removeParkingMedia,
} from '../_shared/parkingMediaUpload.ts';
import { resolveScopedParkingTeamAccess } from '../_shared/parkingScope.ts';
import { serveHandler } from '../_shared/serveEdge.ts';

serveHandler('upload-parking-media', async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const { parkingRow, ...parkingAccess } = await resolveScopedParkingTeamAccess(
      req,
      'settings:edit'
    );
    const parkingId = parkingRow.id as string;

    const logMediaChange = async (mediaCount: number) => {
      await logActivity({
        action: 'parking.updated',
        organizationId: parkingRow.organization_id as string,
        parkingId,
        scope: 'parking',
        actor: buildActorContext('dashboard', { parkingAccess }, req),
        targetType: 'parking',
        targetId: parkingId,
        targetLabel: (parkingRow.name as string | undefined) ?? null,
        metadata: { photos: mediaCount },
      });
    };

    if (req.method === 'DELETE') {
      const body = (await req.json().catch(() => ({}))) as {
        mediaId?: string;
        storagePath?: string;
      };
      const hasTarget = Boolean(body.mediaId?.trim() || body.storagePath?.trim());

      if (!hasTarget) {
        // Legacy clients removed the single cover with a bare DELETE.
        const current = await readParkingMedia(parkingId);
        for (const item of current) {
          await removeParkingMedia({ parkingId, mediaId: item.id });
        }
        const media = await readParkingMedia(parkingId);
        await logMediaChange(media.length);
        return new Response(JSON.stringify({ success: true, data: { media } }), {
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        });
      }

      const media = await removeParkingMedia({
        parkingId,
        mediaId: body.mediaId,
        storagePath: body.storagePath,
      });
      await logMediaChange(media.length);

      return new Response(JSON.stringify({ success: true, data: { media } }), {
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    if (req.method !== 'POST') {
      throw new Error(`Method ${req.method} not allowed`);
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const fileName = (formData.get('fileName') as string) || file?.name || '';

    if (!file) throw new Error('file is required');
    if (!fileName) throw new Error('fileName is required');

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await applyParkingImageFromBytes({
      parkingId,
      bytes,
      mimeType: file.type || '',
      fileName,
      setPrimary: formData.get('setPrimary') === 'true',
    });

    await logMediaChange(result.media.length);

    console.log(
      `[upload-parking-media] Uploaded photo for ${parkingId}: ${result.item.storagePath}`
    );

    return new Response(JSON.stringify({ success: true, data: { media: result.media } }), {
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return await handleEdgeError(req, error, '[upload-parking-media]');
  }
});
