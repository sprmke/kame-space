import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCachedMarketingThumbnail = vi.fn();
const getPersistedPresetThumbnail = vi.fn();
const setCachedMarketingThumbnail = vi.fn();
const designPresetThumbnailKey = vi.fn(() => 'design-key');
const videoPresetThumbnailKey = vi.fn(() => 'video-key');
const marketingBindingCacheKey = vi.fn(() => 'binding-key');

vi.mock('@/features/dashboard/marketing/lib/marketingTemplateThumbnailCache', () => ({
  designPresetThumbnailKey,
  videoPresetThumbnailKey,
  marketingBindingCacheKey,
  getCachedMarketingThumbnail,
  setCachedMarketingThumbnail,
}));

vi.mock('@/features/dashboard/marketing/lib/marketingPresetThumbnailStore', () => ({
  getPersistedPresetThumbnail,
  setPersistedPresetThumbnail: vi.fn(),
}));

vi.mock('@/features/dashboard/marketing/lib/marketingThumbnailQueue', () => ({
  withGlobalRenderSlot: vi.fn(),
}));

const { findStoredPresetThumb, peekPresetThumb, presetThumbCacheKey } = await import(
  '@/features/dashboard/marketing/lib/marketingPresetThumbs'
);

const THEME = {
  version: 1,
  palette: {
    primary: '#e8752a',
    secondary: '#fbe3cf',
    accent: '#c2410c',
    surface: '#fbf8f3',
    ink: '#231f1c',
  },
  fonts: { display: 'Fraunces', body: 'Plus Jakarta Sans', label: 'Jost' },
  background: 'solid',
  corners: 'soft',
} as never;

const DESIGN = {
  contentType: 'design',
  presetId: 'promo-500-off-instagram-story',
  theme: THEME,
  themeHash: 'theme-1',
} as const;

const VIDEO = {
  contentType: 'video',
  presetId: 'quiet-morning',
  size: 'instagram-story',
  theme: THEME,
  themeHash: 'theme-1',
} as const;

describe('presetThumbCacheKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the design thumbnail key for a design preset', () => {
    expect(presetThumbCacheKey(DESIGN)).toBe('design-key');
    expect(designPresetThumbnailKey).toHaveBeenCalledWith(
      'promo-500-off-instagram-story',
      undefined,
      'theme-1'
    );
  });

  it('folds the resolved binding and size into a video key', () => {
    expect(presetThumbCacheKey(VIDEO)).toBe('video-key');
    expect(marketingBindingCacheKey).toHaveBeenCalled();
    expect(videoPresetThumbnailKey).toHaveBeenCalledWith(
      'quiet-morning',
      'instagram-story',
      undefined,
      'binding-key',
      'theme-1'
    );
  });

  it('is stable for the same request and different across themes', () => {
    expect(presetThumbCacheKey(DESIGN)).toBe(presetThumbCacheKey({ ...DESIGN }));
  });
});

describe('peekPresetThumb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads only the in-memory cache', () => {
    getCachedMarketingThumbnail.mockReturnValue('data:image/png;base64,aaa');

    expect(peekPresetThumb(DESIGN)).toBe('data:image/png;base64,aaa');
    expect(getCachedMarketingThumbnail).toHaveBeenCalledWith('design-key');
    expect(getPersistedPresetThumbnail).not.toHaveBeenCalled();
  });

  it('returns undefined on a miss instead of rendering', () => {
    getCachedMarketingThumbnail.mockReturnValue(undefined);

    expect(peekPresetThumb(DESIGN)).toBeUndefined();
  });
});

describe('findStoredPresetThumb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers the memory cache', async () => {
    getCachedMarketingThumbnail.mockReturnValue('data:image/png;base64,memory');

    await expect(findStoredPresetThumb(DESIGN)).resolves.toBe('data:image/png;base64,memory');
    expect(getPersistedPresetThumbnail).not.toHaveBeenCalled();
  });

  it('falls back to IndexedDB and warms the memory cache', async () => {
    getCachedMarketingThumbnail.mockReturnValue(undefined);
    getPersistedPresetThumbnail.mockResolvedValue('data:image/png;base64,stored');

    await expect(findStoredPresetThumb(DESIGN)).resolves.toBe('data:image/png;base64,stored');

    expect(getPersistedPresetThumbnail).toHaveBeenCalledWith('design:design-key');
    expect(setCachedMarketingThumbnail).toHaveBeenCalledWith(
      'design-key',
      'data:image/png;base64,stored'
    );
  });

  it('returns undefined when nothing is stored', async () => {
    getCachedMarketingThumbnail.mockReturnValue(undefined);
    getPersistedPresetThumbnail.mockResolvedValue(undefined);

    await expect(findStoredPresetThumb(DESIGN)).resolves.toBeUndefined();
    expect(setCachedMarketingThumbnail).not.toHaveBeenCalled();
  });
});
