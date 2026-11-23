import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { publishToInstagramMedia } from './metaPublishing.ts';

function stubGraph() {
  const calls: URL[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input : input.url
    );
    calls.push(url);
    if (url.pathname.endsWith('/media')) {
      return Promise.resolve(new Response(JSON.stringify({ id: 'creation-1' })));
    }
    if (url.pathname.endsWith('/creation-1')) {
      return Promise.resolve(new Response(JSON.stringify({ status_code: 'FINISHED' })));
    }
    if (url.pathname.endsWith('/media_publish')) {
      return Promise.resolve(new Response(JSON.stringify({ id: 'media-9' })));
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

Deno.test(
  'publishToInstagramMedia: a Reel with a song sends audio_configuration and caption',
  async () => {
    const { calls, restore } = stubGraph();
    try {
      const result = await publishToInstagramMedia({
        igUserId: '17841',
        pageAccessToken: 'T',
        videoUrl: 'https://cdn/video.mp4',
        caption: 'Weekend stay',
        mediaType: 'REELS',
        audio: { audioId: '1234', audioVolume: 60 },
      });
      assertEquals(result.mediaId, 'media-9');
      const container = calls.find((u) => u.pathname.endsWith('/media'))!;
      assertEquals(container.searchParams.get('media_type'), 'REELS');
      assertEquals(container.searchParams.get('caption'), 'Weekend stay');
      assertEquals(JSON.parse(container.searchParams.get('audio_configuration')!), {
        audio_id: '1234',
        audio_volume: 60,
        video_volume: 100,
      });
    } finally {
      restore();
    }
  }
);

Deno.test(
  'publishToInstagramMedia: a Reel without a song sends no audio_configuration',
  async () => {
    const { calls, restore } = stubGraph();
    try {
      await publishToInstagramMedia({
        igUserId: '1',
        pageAccessToken: 'T',
        videoUrl: 'https://cdn/video.mp4',
        mediaType: 'REELS',
      });
      const container = calls.find((u) => u.pathname.endsWith('/media'))!;
      assertEquals(container.searchParams.get('audio_configuration'), null);
    } finally {
      restore();
    }
  }
);

Deno.test(
  'publishToInstagramMedia: a song on a Story is refused before any Graph call',
  async () => {
    const { calls, restore } = stubGraph();
    try {
      await assertRejects(
        () =>
          publishToInstagramMedia({
            igUserId: '1',
            pageAccessToken: 'T',
            videoUrl: 'https://cdn/video.mp4',
            mediaType: 'STORIES',
            audio: { audioId: '1' },
          }),
        Error,
        'only be added to Reels'
      );
      assertEquals(calls.length, 0);
    } finally {
      restore();
    }
  }
);

Deno.test('publishToInstagramMedia: stories never carry a caption', async () => {
  const { calls, restore } = stubGraph();
  try {
    await publishToInstagramMedia({
      igUserId: '1',
      pageAccessToken: 'T',
      imageUrl: 'https://cdn/a.jpg',
      caption: 'hi',
      mediaType: 'STORIES',
    });
    assert(!calls.find((u) => u.pathname.endsWith('/media'))!.searchParams.has('caption'));
  } finally {
    restore();
  }
});
