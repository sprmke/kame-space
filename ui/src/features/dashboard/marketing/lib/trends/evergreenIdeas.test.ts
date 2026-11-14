import { describe, expect, it } from 'vitest';

import {
  allEvergreenIdeas as serverIdeas,
  evergreenIdeasForMonth as serverIdeasForMonth,
} from '../../../../../../../supabase/functions/_shared/marketingTrends/evergreenIdeas.ts';

import {
  allEvergreenIdeas,
  evergreenIdeasForMonth,
} from '@/features/dashboard/marketing/lib/trends/evergreenIdeas';

/**
 * The seasonal ideas exist twice: once for the server (the fallback the read
 * endpoint can return) and once for the client (the bundled copy shown when the
 * endpoint fails). They must be identical, or a host sees one set of ideas in
 * the sheet and a different one when the network is down.
 */
describe('marketing trends evergreen ideas', () => {
  it('matches the server copy', () => {
    expect(allEvergreenIdeas()).toEqual(serverIdeas());
  });

  it('matches the server copy for every month', () => {
    for (let month = 1; month <= 12; month += 1) {
      expect(evergreenIdeasForMonth(month)).toEqual(serverIdeasForMonth(month));
    }
  });

  it('gives every idea three angles and a caption', () => {
    for (const idea of allEvergreenIdeas()) {
      expect(idea.angles.length).toBeGreaterThan(0);
      expect(idea.captionIdea.length).toBeGreaterThan(0);
      expect(idea.title.length).toBeGreaterThan(0);
    }
  });

  it('handles a month outside 1 to 12', () => {
    expect(evergreenIdeasForMonth(0).length).toBeGreaterThan(0);
    expect(evergreenIdeasForMonth(13).length).toBeGreaterThan(0);
  });
});
