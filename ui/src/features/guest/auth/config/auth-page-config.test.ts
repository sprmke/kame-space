import { describe, expect, it } from 'vitest';

import { AUTH_PAGE_CONFIG, type AuthAudience } from '@/features/guest/auth/config/auth-page-config';

/**
 * One sign-in screen per audience, with no sign-up variant. These assertions hold the
 * copy contract that replaced the old "Create one now" register link: both headings read
 * the same, and the footer sends people to the other audience instead.
 */
describe('AUTH_PAGE_CONFIG', () => {
  it('uses the unified log in or sign up heading for both audiences', () => {
    expect(AUTH_PAGE_CONFIG.host.title).toBe('Log in or sign up');
    expect(AUTH_PAGE_CONFIG.guest.title).toBe('Log in or sign up');
  });

  it.each<[AuthAudience, AuthAudience, string]>([
    ['host', 'guest', '/for-guests/login'],
    ['guest', 'host', '/for-hosts/login'],
  ])('sends the %s footer to the %s sign-in page', (audience, _other, href) => {
    expect(AUTH_PAGE_CONFIG[audience].otherHref).toBe(href);
  });

  it('carries no redirect query on the cross-audience link', () => {
    for (const config of Object.values(AUTH_PAGE_CONFIG)) {
      expect(config.otherHref).not.toContain('?');
    }
  });

  it('names each audience without repeating the prompt', () => {
    for (const config of Object.values(AUTH_PAGE_CONFIG)) {
      const prompt = config.otherPrompt.toLowerCase();
      const label = config.otherLinkLabel.toLowerCase();
      for (const word of ['host', 'guest']) {
        expect(prompt.includes(word) && label.includes(word)).toBe(false);
      }
    }
  });

  it('keeps the labels short enough for one line on a phone', () => {
    for (const config of Object.values(AUTH_PAGE_CONFIG)) {
      expect(config.otherLinkLabel.length).toBeLessThanOrEqual(16);
      expect(config.otherPrompt.length).toBeLessThanOrEqual(28);
    }
  });
});
