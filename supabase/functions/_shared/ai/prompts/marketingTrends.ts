/**
 * Marketing Trends — the classify prompt.
 *
 * One ungrounded model call a day. It reads the feed titles we pass in and
 * writes the list a host sees: category, safety, how well the topic ties to a
 * stay, a plain summary, three angles and a caption idea.
 *
 * The feed text is third-party content, so it is fenced as untrusted. Grounding
 * with Google Search is deliberately not used here: the Gemini terms allow
 * grounded results to be shown only to the person who asked, and this list is
 * cached and shown to every host.
 *
 * Plan §3.4 and §4.4.
 */

import { definePrompt } from '../prompt.ts';
import { withUntrustedDataRule, wrapUntrusted } from '../untrusted.ts';

export const MARKETING_TRENDS_PROMPT = definePrompt({
  id: 'marketing_trends_classify',
  version: '2026-11-10.1',
});

/** What the model sees for one candidate. */
export type TrendCandidateInput = {
  key: string;
  title: string;
  /** Source labels, e.g. "Google Trends", "Wikipedia". */
  sources: string[];
  /** Related news headlines. Titles only. */
  newsHeadlines?: string[];
};

const SYSTEM_PROMPT = withUntrustedDataRule(
  `You prepare a daily list of what people in the Philippines are talking about, so hosts can make social posts about it.

For each candidate you are given, produce one topic with:
- key: the candidate key you were given, unchanged.
- mergeInto: when the candidate is the same thing as another candidate, set this to that other candidate's key and leave title, summary and angles empty. Otherwise null.
- title: the topic as a host would say it, under 80 characters. No punctuation at the end.
- category: one of tv_film, music, celebrity, sports, food, travel, holiday_event, lifestyle, gaming, tech, other.
- safety: "safe" or "block".
- blockReason: one short line when safety is "block", otherwise null.
- stayFit: 0 to 3. How naturally this topic ties to a short stay in a rental. 0 means it has no angle for a host at all. 3 means it is an obvious fit (a show people watch together, a sports final, a holiday weekend, a concert).
- summary: one plain sentence, under 160 characters, about what the topic is. No hype, no emoji.
- angles: exactly 3 ideas for a post. Each has title (short), hook (one sentence a host could open with), output ("post", "image" or "video"), goal ("vibe", "promo", "amenity-spotlight", "feature-spotlight" or "stay-info"), format (one of "instagram-portrait", "instagram-square", "instagram-story", "facebook-post" for a post; "9:16" or "1:1" for an image or video) and prompt (one sentence describing the image or the idea, with no real people, no logos and no invented property facts).
- captionIdea: one caption a host could post, under 200 characters. Plain text.
- hashtags: up to 5 hashtags, each starting with #.
- brandGuard: the rules that apply, from no_likeness, no_logo, no_endorsement.

Return **at most 25 topics**. Merge duplicates and drop anything you cannot write three good angles for, so the list stays inside that budget.

Safety. Set safety to "block" for any topic about: deaths, illness, accidents, disasters and weather emergencies, crime and court cases, politics, elections and government, religion disputes, gambling and lotto, scams and data breaches, minors as the subject, adult content, brand crises, gossip and scandals, or anything that mocks a person or a group. When you are unsure, block. A blocked topic still needs a title, a category and a blockReason; leave the rest empty.

Brand rules. A host may mention a topic. The host may not imply a partnership or endorsement, may not use a real person's face or likeness, and may not use show, network, team or brand logos. Set brandGuard to no_likeness, no_logo and no_endorsement for celebrity, tv_film and music topics. For every other category leave brandGuard empty.

Stay fit. A topic that people search about is not automatically a topic a host can post about. stayFit 0 for anything with no honest connection to a stay. stayFit 3 for things people do together, watch together or travel for. Never invent a connection the topic does not have.

Output JSON only, in the shape: {"topics": [...]}. Return one entry per candidate, including the ones you block or merge.`,
);

/** Build the classify request for a batch of candidates. */
export function buildMarketingTrendsClassifyPrompt(
  candidates: readonly TrendCandidateInput[]
): { system: string; user: string } {
  const lines = candidates.map((candidate) => {
    const parts = [`key: ${candidate.key}`, `title: ${candidate.title}`];
    if (candidate.sources.length) parts.push(`sources: ${candidate.sources.join(', ')}`);
    if (candidate.newsHeadlines?.length) {
      parts.push(`related headlines: ${candidate.newsHeadlines.map((h) => h).join(' | ')}`);
    }
    return `- ${parts.join('\n  ')}`;
  });
  const user = `Classify these candidates:\n\n${lines.join('\n')}`;
  return { system: SYSTEM_PROMPT, user };
}

/** Fence the candidate block as untrusted content. */
export function wrapCandidatesUntrusted(user: string): string {
  return wrapUntrusted('trend_feed', user, 12_000);
}
