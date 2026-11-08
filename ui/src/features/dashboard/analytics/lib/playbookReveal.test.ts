import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PLAYBOOK_ARTICLE_TRIGGER_ATTR,
  playbookArticleElementId,
  revealPlaybookArticle,
} from '@/features/dashboard/analytics/lib/playbookReveal';

const focus = vi.fn();
const scrollIntoView = vi.fn();

function stubArticle(options: { article?: boolean; trigger?: boolean } = {}) {
  const { article: hasArticle = true, trigger: hasTrigger = true } = options;
  const article = {
    querySelector: vi.fn(() => (hasTrigger ? { focus } : null)),
    scrollIntoView,
  };
  vi.stubGlobal('document', { getElementById: vi.fn(() => (hasArticle ? article : null)) });
  return article;
}

afterEach(() => {
  vi.unstubAllGlobals();
  focus.mockReset();
  scrollIntoView.mockReset();
});

describe('playbookArticleElementId', () => {
  it('matches the anchor target format', () => {
    expect(playbookArticleElementId('pricing-tiers')).toBe('playbook-pricing-tiers');
  });
});

describe('revealPlaybookArticle', () => {
  it('does nothing when the article is not rendered', () => {
    stubArticle({ article: false });

    expect(() => revealPlaybookArticle('missing')).not.toThrow();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('focuses the disclosure and scrolls it into view smoothly', () => {
    const article = stubArticle();

    revealPlaybookArticle('pricing-tiers');

    expect(article.querySelector).toHaveBeenCalledWith(`[${PLAYBOOK_ARTICLE_TRIGGER_ATTR}]`);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
  });

  it('scrolls instantly when the guest prefers reduced motion', () => {
    stubArticle();

    revealPlaybookArticle('pricing-tiers', { reducedMotion: true });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
  });

  it('still scrolls when the disclosure button is missing', () => {
    const article = stubArticle({ trigger: false });

    revealPlaybookArticle('pricing-tiers');

    expect(article.querySelector).toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });
});
