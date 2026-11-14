export type DesignTemplateFormat =
  'instagram-post' | 'instagram-portrait' | 'instagram-story' | 'facebook-post';

export const DESIGN_FORMAT_DIMENSIONS: Record<
  DesignTemplateFormat,
  { width: number; height: number; label: string }
> = {
  'instagram-post': { width: 1080, height: 1080, label: 'Instagram Post' },
  'instagram-portrait': { width: 1080, height: 1350, label: 'Instagram Portrait' },
  'instagram-story': { width: 1080, height: 1920, label: 'Instagram Story' },
  'facebook-post': { width: 1200, height: 630, label: 'Facebook Post' },
};

/**
 * Formats with built-in Design presets. The layouts are ratio-based, so 4:5 portrait
 * (checked on the preset contact sheet, plan 9.2) is offered beside the others.
 */
export const DESIGN_PRESET_FORMATS: DesignTemplateFormat[] = [
  'instagram-post',
  'instagram-portrait',
  'instagram-story',
  'facebook-post',
];
