import { describe, expect, it } from 'vitest';

import {
  buildAiCreateRequest,
  effectiveVideoResolution,
  type AiCreateFormState,
} from '@/features/dashboard/marketing/lib/aiStudioCreatePayload';
import { DRAFT_VIDEO_RESOLUTION, DEFAULT_VIDEO_DURATION } from '@/features/dashboard/marketing/lib/marketingGenerationPricing';

function state(overrides: Partial<AiCreateFormState> = {}): AiCreateFormState {
  return {
    output: 'image',
    text: '  Sunset over the pool  ',
    goal: 'vibe',
    format: 'instagram-portrait',
    aspect: '4:5',
    lookId: null,
    tier: 'standard',
    imageSize: '2K',
    resolution: '1080p',
    allowHighResolution: true,
    cameraMove: 'still',
    sound: 'music',
    enhance: true,
    referenceIds: [],
    sampleId: null,
    preferredArchetype: null,
    ...overrides,
  };
}

describe('effectiveVideoResolution', () => {
  it('forces 720p on the draft tier', () => {
    expect(
      effectiveVideoResolution({ tier: 'draft', resolution: '1080p', allowHighResolution: true })
    ).toBe(DRAFT_VIDEO_RESOLUTION);
  });

  it('forces 720p when high resolution is not allowed', () => {
    expect(
      effectiveVideoResolution({
        tier: 'premium',
        resolution: '1080p',
        allowHighResolution: false,
      })
    ).toBe(DRAFT_VIDEO_RESOLUTION);
  });

  it('keeps the requested resolution for a paid tier that allows it', () => {
    expect(
      effectiveVideoResolution({
        tier: 'premium',
        resolution: '1080p',
        allowHighResolution: true,
      })
    ).toBe('1080p');
  });
});

describe('buildAiCreateRequest reel', () => {
  it('sends the host words and picked photos, with no media payload', () => {
    expect(
      buildAiCreateRequest(
        state({ output: 'reel', photoUrls: ['https://img/a.jpg'], text: ' Pool first ' })
      )
    ).toEqual({
      output: 'reel',
      prompt: 'Pool first',
      photoUrls: ['https://img/a.jpg'],
      sampleId: null,
      trendTopicKey: null,
    });
  });
});

describe('buildAiCreateRequest', () => {
  it('builds a post request with the trimmed prompt and layout hints', () => {
    const request = buildAiCreateRequest(
      state({
        output: 'post',
        sampleId: 'sample-1',
        preferredArchetype: 'sky-headline',
      })
    );

    expect(request).toEqual({
      output: 'post',
      goal: 'vibe',
      format: 'instagram-portrait',
      prompt: 'Sunset over the pool',
      preferredArchetype: 'sky-headline',
      offer: null,
      photoUrls: [],
      family: 'auto',
      alsoStory: false,
      sampleId: 'sample-1',
      trendTopicKey: null,
    });
  });

  it('carries the picked photos and style choice', () => {
    const request = buildAiCreateRequest(
      state({ output: 'post', photoUrls: ['a.jpg', 'b.jpg'], family: 'clean' })
    );
    if (request.output !== 'post') throw new Error('wrong branch');
    expect(request.photoUrls).toEqual(['a.jpg', 'b.jpg']);
    expect(request.family).toBe('clean');
  });

  it('builds an enhance request: one photo, the preset instruction, structure locked', () => {
    const request = buildAiCreateRequest(
      state({
        output: 'image',
        imageMode: 'enhance',
        enhancePreset: 'brighten',
        referenceIds: ['a', 'b'],
        text: '',
      })
    );
    if (request.output !== 'image') throw new Error('wrong branch');
    expect(request.payload).toMatchObject({
      intent: 'enhance',
      referenceIds: ['a'],
      enhancePrompt: false,
    });
    expect(request.payload.prompt).toMatch(/brighten the room/);
  });

  it('Extend presets force the output shape and Upscale asks for the largest size', () => {
    const extend = buildAiCreateRequest(
      state({ output: 'image', imageMode: 'enhance', enhancePreset: 'extend-story', referenceIds: ['a'] })
    );
    if (extend.output !== 'image') throw new Error('wrong branch');
    expect(extend.payload).toMatchObject({ aspectRatio: '9:16', intent: 'enhance' });
    const up = buildAiCreateRequest(
      state({ output: 'image', imageMode: 'enhance', enhancePreset: 'upscale', referenceIds: ['a'] })
    );
    if (up.output !== 'image') throw new Error('wrong branch');
    expect(['2K', '4K']).toContain(up.payload.imageSize);
  });

  it('builds an image request with the chosen size', () => {
    const request = buildAiCreateRequest(state({ output: 'image' }));

    expect(request.output).toBe('image');
    expect(request.prompt).toBe('Sunset over the pool');
    if (request.output !== 'image') throw new Error('wrong branch');
    expect(request.payload).toMatchObject({
      mediaType: 'image',
      qualityTier: 'standard',
      aspectRatio: '4:5',
      imageSize: '2K',
      referenceIds: [],
      enhancePrompt: true,
    });
  });

  it('drops the image size to 1K on the draft tier', () => {
    const request = buildAiCreateRequest(state({ output: 'image', tier: 'draft' }));

    if (request.output !== 'image') throw new Error('wrong branch');
    expect(request.payload.imageSize).toBe('1K');
  });

  it('builds a video request with duration, camera move and sound', () => {
    const request = buildAiCreateRequest(
      state({ output: 'video', aspect: '9:16', cameraMove: 'push-in', sound: 'ambient' })
    );

    if (request.output !== 'video') throw new Error('wrong branch');
    expect(request.payload).toMatchObject({
      mediaType: 'video',
      qualityTier: 'standard',
      aspectRatio: '9:16',
      resolution: '1080p',
      durationSeconds: DEFAULT_VIDEO_DURATION,
      cameraMove: 'push-in',
      sound: 'ambient',
    });
  });

  it('adds the look to the prompt, unless a start photo already sets the light', () => {
    const withLook = buildAiCreateRequest(state({ output: 'video', lookId: 'golden-hour' }));
    const withStartFrame = buildAiCreateRequest(
      state({ output: 'video', lookId: 'golden-hour', referenceIds: ['ref-1'] })
    );

    if (withLook.output !== 'video' || withStartFrame.output !== 'video') {
      throw new Error('wrong branch');
    }
    expect(withLook.payload.prompt.length).toBeGreaterThan(withLook.prompt.length);
    expect(withStartFrame.payload.prompt).toBe('Sunset over the pool');
  });

  it('carries the sample attribution only when an example was applied', () => {
    const plain = buildAiCreateRequest(state({ output: 'video' }));
    const fromSample = buildAiCreateRequest(state({ output: 'video', sampleId: 'sample-9' }));

    if (plain.output !== 'video' || fromSample.output !== 'video') throw new Error('wrong branch');
    expect(plain.payload).not.toHaveProperty('sampleId');
    expect(fromSample.payload).toMatchObject({ sampleId: 'sample-9' });
    expect(fromSample.sampleId).toBe('sample-9');
  });
});

describe('buildAiCreateRequest promo offer', () => {
  const post = (overrides: Partial<AiCreateFormState> = {}) =>
    buildAiCreateRequest(state({ output: 'post', goal: 'promo', ...overrides }));

  it('carries a valid offer on a promo post', () => {
    const request = post({ offerText: '20% off weekdays', offerCode: 'summer10' });
    expect(request.output === 'post' && request.offer).toEqual({
      text: '20% off weekdays',
      validUntil: null,
      code: 'SUMMER10',
    });
  });

  it('sends no offer when the fields are empty or the offer has passed', () => {
    expect(post({ offerText: '' })).toMatchObject({ offer: null });
    expect(post({ offerText: '10% off', offerUntil: '2020-01-01' })).toMatchObject({ offer: null });
  });

  it('never sends an offer on other goals, even if the fields hold text', () => {
    expect(post({ goal: 'vibe', offerText: '20% off weekdays' })).toMatchObject({ offer: null });
  });
});
