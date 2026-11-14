import { describe, expect, it } from 'vitest';

import { displayFontsHref, ensureDisplayFonts } from '@/lib/fonts/displayFonts';

describe('displayFontsHref', () => {
  it('requests every display family with swap, and never the product font', () => {
    const href = displayFontsHref();
    for (const family of [
      'Playfair+Display',
      'Cormorant+Garamond',
      'Fraunces',
      'Instrument+Serif',
      'Space+Grotesk',
      'Figtree',
    ]) {
      expect(href).toContain(`family=${family}`);
    }
    expect(href.endsWith('&display=swap')).toBe(true);
    expect(href).not.toContain('Plus+Jakarta+Sans');
  });

  it('is a stable URL so the browser cache is reused', () => {
    expect(displayFontsHref()).toBe(displayFontsHref());
  });
});

describe('ensureDisplayFonts', () => {
  it('appends one display stylesheet', () => {
    document.head.innerHTML = '';
    ensureDisplayFonts(document);
    const links = document.head.querySelectorAll<HTMLLinkElement>('#kame-display-fonts');
    expect(links).toHaveLength(1);
    expect(links[0]!.rel).toBe('stylesheet');
    expect(links[0]!.href).toBe(displayFontsHref());
  });

  it('is idempotent, so navigating in and out of a showcase does not pile up links', () => {
    document.head.innerHTML = '';
    ensureDisplayFonts(document);
    ensureDisplayFonts(document);
    ensureDisplayFonts(document);
    expect(document.head.querySelectorAll('#kame-display-fonts')).toHaveLength(1);
  });

  it('leaves the product font stylesheet alone', () => {
    document.head.innerHTML =
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans&display=swap" />';
    ensureDisplayFonts(document);
    expect(document.head.querySelectorAll('link')).toHaveLength(2);
    expect(displayFontsHref()).not.toContain('Plus+Jakarta+Sans');
  });
});
