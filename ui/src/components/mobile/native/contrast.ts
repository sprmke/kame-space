/**
 * Relative luminance + contrast for WCAG AA checks on native tokens.
 * Inputs are CSS HSL channel strings like `"168 70% 22%"` (no `hsl()`).
 */

function parseHsl(channels: string): { h: number; s: number; l: number } {
  const parts = channels.trim().split(/\s+/);
  if (parts.length < 3) {
    throw new Error(`Invalid HSL channels: ${channels}`);
  }
  const h = Number.parseFloat(parts[0] ?? '0');
  const s = Number.parseFloat((parts[1] ?? '0').replace('%', '')) / 100;
  const l = Number.parseFloat((parts[2] ?? '0').replace('%', '')) / 100;
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [r + m, g + m, b + m];
}

function channelLuminance(c: number): number {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(channels: string): number {
  const { h, s, l } = parseHsl(channels);
  const [r, g, b] = hslToRgb(h, s, l);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio between two HSL channel strings. */
export function contrastRatio(fgChannels: string, bgChannels: string): number {
  const l1 = relativeLuminance(fgChannels);
  const l2 = relativeLuminance(bgChannels);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Normal text AA is 4.5:1; large text (bold ≥14px / regular ≥18px) is 3:1. */
export function meetsAa(fgChannels: string, bgChannels: string, large = false): boolean {
  return contrastRatio(fgChannels, bgChannels) >= (large ? 3 : 4.5);
}
