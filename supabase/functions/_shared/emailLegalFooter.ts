/**
 * Copyright + Privacy Policy link for the bottom of every transactional email sent through
 * `fragments/configurable-template-send.html` (surface inventory #24, legal-and-privacy-coverage
 * plan). The organization name is the only untrusted part — escape it, trust the rest.
 */

import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';
import { escapeHtml } from './renderEmailHtml.ts';

export function buildEmailLegalFooterHtml(brandName: string): string {
  const copyright = brandName
    ? `© ${escapeHtml(brandName)}. All rights reserved.`
    : '© All rights reserved.';
  const privacyUrl = `${resolvePublicGuestAppOrigin(null)}/privacy`;
  return `${copyright} <a href="${escapeHtml(privacyUrl)}" style="color:#666666;text-decoration:underline;" target="_blank" rel="noopener">Privacy Policy</a>`;
}
