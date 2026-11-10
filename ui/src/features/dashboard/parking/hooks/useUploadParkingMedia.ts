import { useMutation, useQueryClient } from '@tanstack/react-query';

import { PARKINGS_QUERY_KEY } from '@/features/dashboard/org/hooks/useParkings';
import {
  scopedParkingFunctionsBaseUrl,
  useParkingIdParam,
} from '@/features/dashboard/org/lib/adminParkingScope';
import {
  normalizeParkingMediaDraft,
  type ParkingMediaItem,
} from '@/features/dashboard/parking/lib/parkingMedia';

import { prepareUpload } from '@/lib/media/prepareUpload';
import { supabase } from '@/lib/supabase/client';

type ParkingMediaResult = {
  media: ParkingMediaItem[];
};

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

async function parseMediaResponse(res: Response): Promise<ParkingMediaResult> {
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: { media?: ParkingMediaItem[] };
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return { media: normalizeParkingMediaDraft(json.data.media ?? []) };
}

function invalidateParkingMedia(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: PARKINGS_QUERY_KEY });
}

export function useUploadParkingMedia() {
  const qc = useQueryClient();
  const parkingId = useParkingIdParam();

  const upload = useMutation({
    mutationFn: async (rawFile: File): Promise<ParkingMediaResult> => {
      const prepared = await prepareUpload(rawFile, {
        imagePreset: 'PHOTO_MASTER',
        surface: 'parking-media',
      });
      if (prepared.error) throw new Error(prepared.error);
      const file = prepared.file;

      const jwt = await getAdminJwt();
      const body = new FormData();
      body.append('file', file);
      body.append('fileName', file.name);

      const res = await fetch(scopedParkingFunctionsBaseUrl('/upload-parking-media', parkingId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body,
      });

      return parseMediaResponse(res);
    },
    onSuccess: () => invalidateParkingMedia(qc),
  });

  const remove = useMutation({
    mutationFn: async (payload: {
      mediaId?: string;
      storagePath?: string;
    }): Promise<ParkingMediaResult> => {
      const jwt = await getAdminJwt();
      const res = await fetch(scopedParkingFunctionsBaseUrl('/upload-parking-media', parkingId), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      return parseMediaResponse(res);
    },
    onSuccess: () => invalidateParkingMedia(qc),
  });

  return { upload, remove };
}
