import {
  offerDetailLine,
  type PosterOffer,
} from '@/features/dashboard/marketing/lib/poster/posterOffer';
import type { PosterFacts, PosterGoal } from '@/features/dashboard/marketing/lib/poster/posterSpec';

/**
 * Hand-written copy for the rule-based posters (and the fallback when the AI director
 * is unavailable). Six sets per goal, English and Taglish, all inside the slot limits
 * in `posterSpec.ts`. Rules: facts only (no invented offers, prices or perks), the
 * listing name appears once, short plain sentences, no em dashes.
 */

export type PosterCopySet = {
  eyebrow: string;
  headline: string;
  accent: string;
  subhead: string;
  tagline: string;
  cta: string;
  badge: string;
  listTitle: string;
};

export type CopyContext = {
  name: string;
  /** First segment of the location, e.g. "Tagaytay". */
  place: string | null;
  /** Most distinctive amenity, short label, or null. */
  amenity: string | null;
  rate: string | null;
  checkIn: string | null;
  checkOut: string | null;
  /** The host's own offer (promo). The only source of any discount wording. */
  offer: PosterOffer | null;
};

export function copyContext(facts: PosterFacts, amenity: string | null): CopyContext {
  return {
    name: facts.propertyName,
    place: facts.location?.split(',')[0]?.trim() || null,
    amenity,
    rate: facts.nightlyRate,
    checkIn: facts.checkIn,
    checkOut: facts.checkOut,
    offer: facts.offer ?? null,
  };
}

type Builder = (c: CopyContext) => PosterCopySet;

const set = (fields: PosterCopySet): PosterCopySet => fields;
const inPlace = (c: CopyContext, withPlace: string, without: string) =>
  c.place ? withPlace.replace('{place}', c.place) : without;

const VIBE: Builder[] = [
  (c) =>
    set({
      eyebrow: 'Your next staycation',
      headline: c.name,
      accent: inPlace(c, '{place} Staycation', 'Your Staycation'),
      subhead: inPlace(
        c,
        'A calm stay in {place}, ready when you are.',
        'A calm stay, ready when you are.'
      ),
      tagline: 'Unwind. Recharge. Just like home.',
      cta: 'Book your stay',
      badge: 'Book direct',
      listTitle: 'Perfect for',
    }),
  (c) =>
    set({
      eyebrow: 'Weekend away',
      headline: c.name,
      accent: 'Slow days start here',
      subhead: 'Pack light and settle in.',
      tagline: 'Your home away from home.',
      cta: 'Plan your stay',
      badge: 'Book direct',
      listTitle: 'What you get',
    }),
  (c) =>
    set({
      eyebrow: 'Take a breather',
      headline: 'Stay a while',
      accent: inPlace(c, 'Rest in {place}', 'Rest easy'),
      subhead: 'Good sleep, good company, no rush.',
      tagline: 'Slow down. You earned it.',
      cta: 'See dates',
      badge: 'Book direct',
      listTitle: 'Perfect for',
    }),
  (c) =>
    set({
      eyebrow: 'Tara, pahinga muna',
      headline: c.name,
      accent: 'Bakasyon vibes',
      subhead: 'Walang stress, puro chill lang.',
      tagline: 'Dito ka na mag-relax.',
      cta: 'Book na',
      badge: 'Book direct',
      listTitle: 'Para sa inyo',
    }),
  (c) =>
    set({
      eyebrow: 'Barkada or family',
      headline: 'Room for everyone',
      accent: 'Good times ahead',
      subhead: inPlace(c, 'Your base in {place}.', 'Your base for the weekend.'),
      tagline: 'Make it a weekend to remember.',
      cta: 'Check availability',
      badge: 'Book direct',
      listTitle: 'Perfect for',
    }),
  (c) =>
    set({
      eyebrow: 'Quiet mornings',
      headline: c.name,
      accent: 'Home, but better',
      subhead: 'Coffee, a good view, nowhere to be.',
      tagline: 'Just you and the quiet.',
      cta: 'Book your stay',
      badge: 'Book direct',
      listTitle: 'Perfect for',
    }),
];

const PROMO: Builder[] = [
  (c) =>
    set({
      eyebrow: 'Book direct',
      headline: c.rate ? `From ${c.rate} a night` : 'Book direct with us',
      accent: 'Stay with us',
      subhead: 'Message us for dates and the best way to book.',
      tagline: 'Simple booking, no middlemen.',
      cta: 'Book your stay',
      badge: c.rate ? `${c.rate} a night` : 'Book direct',
      listTitle: 'Included',
    }),
  (c) =>
    set({
      eyebrow: 'Open for booking',
      headline: c.rate ? `${c.rate} a night` : 'Dates are open',
      accent: 'Come stay',
      subhead: inPlace(
        c,
        'Your stay in {place} is a message away.',
        'Your stay is a message away.'
      ),
      tagline: 'Ask us about your dates.',
      cta: 'Message us',
      badge: 'Dates open',
      listTitle: 'Included',
    }),
  () =>
    set({
      eyebrow: 'Plan the getaway',
      headline: 'Book your dates',
      accent: 'Before they go',
      subhead: 'Weekends fill up first.',
      tagline: 'Reserve now, relax later.',
      cta: 'Reserve now',
      badge: 'Book direct',
      listTitle: 'Included',
    }),
  (c) =>
    set({
      eyebrow: 'Mag-book na',
      headline: c.rate ? `${c.rate} kada gabi` : 'Bukas ang dates',
      accent: 'Tara na',
      subhead: 'Message lang para sa available dates.',
      tagline: 'Direct booking, madali lang.',
      cta: 'Mag-book na',
      badge: 'Book direct',
      listTitle: 'Kasama',
    }),
  (c) =>
    set({
      eyebrow: 'Your weekend, sorted',
      headline: 'Stay with us',
      accent: inPlace(c, 'Escape to {place}', 'Escape the routine'),
      subhead: 'Pick your dates and settle in.',
      tagline: 'Book direct, stay easy.',
      cta: 'See availability',
      badge: 'Book direct',
      listTitle: 'Included',
    }),
  (c) =>
    set({
      eyebrow: 'Ready when you are',
      headline: c.name,
      accent: 'Dates now open',
      subhead: 'Tell us when and we will take it from there.',
      tagline: 'Booking is one message away.',
      cta: 'Message us',
      badge: 'Dates open',
      listTitle: 'Included',
    }),
];

const AMENITY: Builder[] = [
  (c) =>
    set({
      eyebrow: 'Everything you need',
      headline: c.name,
      accent: 'Made for slow days',
      subhead: 'The comforts are covered.',
      tagline: 'Just bring yourself.',
      cta: 'Book your stay',
      badge: c.amenity ? `${c.amenity} for your stay` : 'Book direct',
      listTitle: 'Perfect for',
    }),
  () =>
    set({
      eyebrow: 'What is inside',
      headline: 'All set for you',
      accent: 'Comfort covered',
      subhead: 'Settle in. We have the rest.',
      tagline: 'Everything within reach.',
      cta: 'See dates',
      badge: 'Book direct',
      listTitle: 'What you get',
    }),
  (c) =>
    set({
      eyebrow: 'Your stay includes',
      headline: c.name,
      accent: 'The good stuff',
      subhead: 'Comforts that make it feel like home.',
      tagline: 'Home comforts, away from home.',
      cta: 'Plan your stay',
      badge: 'Book direct',
      listTitle: 'Includes',
    }),
  (c) =>
    set({
      eyebrow: 'Kumpleto dito',
      headline: c.name,
      accent: 'Comfy na comfy',
      subhead: 'Pasok na lahat ng kailangan mo.',
      tagline: 'Dalhin mo lang ang sarili mo.',
      cta: 'Book na',
      badge: 'Book direct',
      listTitle: 'Kasama',
    }),
  () =>
    set({
      eyebrow: 'Pack light',
      headline: 'We have the basics',
      accent: 'And a little more',
      subhead: 'Arrive, unpack, unwind.',
      tagline: 'Less packing. More resting.',
      cta: 'Book your stay',
      badge: 'Book direct',
      listTitle: 'Includes',
    }),
  (c) =>
    set({
      eyebrow: 'Comfort first',
      headline: c.name,
      accent: 'Thoughtfully stocked',
      subhead: 'Small things that add up.',
      tagline: 'Settle in and stay a while.',
      cta: 'Check availability',
      badge: 'Book direct',
      listTitle: 'Perfect for',
    }),
];

const FEATURE: Builder[] = [
  (c) =>
    set({
      eyebrow: 'Level up your stay',
      headline: c.amenity ? `${c.amenity} included` : c.name,
      accent: 'Good vibes only',
      subhead: 'A little extra for your getaway.',
      tagline: 'Make it a stay to remember.',
      cta: 'Book your stay',
      badge: c.amenity ? `${c.amenity} for your stay` : 'Book direct',
      listTitle: 'Also included',
    }),
  (c) =>
    set({
      eyebrow: 'The highlight',
      headline: c.amenity ?? c.name,
      accent: 'Worth the trip',
      subhead: inPlace(c, 'The favorite spot at our place in {place}.', 'A guest favorite.'),
      tagline: 'You will want to stay longer.',
      cta: 'See dates',
      badge: 'Guest favorite',
      listTitle: 'Also included',
    }),
  (c) =>
    set({
      eyebrow: 'Why guests love it',
      headline: c.amenity ? `${c.amenity} time` : 'Make yourself at home',
      accent: 'Yes, really',
      subhead: 'Some places just do it right.',
      tagline: 'Come see for yourself.',
      cta: 'Plan your stay',
      badge: 'Guest favorite',
      listTitle: 'Also included',
    }),
  (c) =>
    set({
      eyebrow: 'Sulit ang stay',
      headline: c.amenity ? `May ${c.amenity}` : c.name,
      accent: 'Good vibes lang',
      subhead: 'Extra comfort para sa bakasyon mo.',
      tagline: 'Dito ka na mag-stay.',
      cta: 'Book na',
      badge: 'Guest favorite',
      listTitle: 'Kasama pa',
    }),
  (c) =>
    set({
      eyebrow: 'A little extra',
      headline: c.amenity ? `Enjoy the ${c.amenity}` : 'Treat yourself',
      accent: 'You deserve it',
      subhead: 'Because a break should feel like one.',
      tagline: 'Take the weekend slow.',
      cta: 'Book your stay',
      badge: 'Book direct',
      listTitle: 'Also included',
    }),
  (c) =>
    set({
      eyebrow: 'Stand-out feature',
      headline: c.amenity ?? c.name,
      accent: 'Our guests agree',
      subhead: 'Ask what makes our place different.',
      tagline: 'Come for the stay, keep the memories.',
      cta: 'Message us',
      badge: 'Guest favorite',
      listTitle: 'Also included',
    }),
];

const STAY_INFO: Builder[] = [
  (c) =>
    set({
      eyebrow: 'Plan your stay',
      headline: c.name,
      accent: inPlace(c, '{place} Staycation', 'Your Staycation'),
      subhead: timesLine(c),
      tagline: 'See you soon.',
      cta: 'Book your stay',
      badge: 'Book direct',
      listTitle: 'Good to know',
    }),
  (c) =>
    set({
      eyebrow: 'Before you arrive',
      headline: 'Check-in guide',
      accent: 'Easy arrival',
      subhead: timesLine(c),
      tagline: 'Message us if plans change.',
      cta: 'Message us',
      badge: 'Good to know',
      listTitle: 'Good to know',
    }),
  (c) =>
    set({
      eyebrow: 'Your stay, step by step',
      headline: 'Arrive and unwind',
      accent: 'We will be ready',
      subhead: timesLine(c),
      tagline: 'Safe travels.',
      cta: 'Book your stay',
      badge: 'Good to know',
      listTitle: 'Good to know',
    }),
  (c) =>
    set({
      eyebrow: 'Bago ka dumating',
      headline: 'Check-in guide',
      accent: 'Handa na kami',
      subhead: timesLine(c),
      tagline: 'Ingat sa biyahe.',
      cta: 'Mag-message',
      badge: 'Good to know',
      listTitle: 'Dapat malaman',
    }),
  (c) =>
    set({
      eyebrow: 'Stay details',
      headline: c.name,
      accent: 'All in one place',
      subhead: timesLine(c),
      tagline: 'Everything you need to arrive.',
      cta: 'Plan your stay',
      badge: 'Good to know',
      listTitle: 'Good to know',
    }),
  (c) =>
    set({
      eyebrow: 'Arriving soon?',
      headline: 'Here is the plan',
      accent: 'Easy as that',
      subhead: timesLine(c),
      tagline: 'We cannot wait to host you.',
      cta: 'Message us',
      badge: 'Good to know',
      listTitle: 'Good to know',
    }),
];

/** Times come from the listing only; with neither time the line stays generic. */
function timesLine(c: CopyContext): string {
  if (c.checkIn && c.checkOut) return `Check-in ${c.checkIn}. Check-out ${c.checkOut}.`;
  if (c.checkIn) return `Check-in from ${c.checkIn}.`;
  if (c.checkOut) return `Check-out by ${c.checkOut}.`;
  return 'Ask us about check-in and check-out.';
}

/**
 * Promo copy built around the host's offer. The offer text is the headline, printed
 * verbatim; the date and code come from the form; nothing else claims a saving.
 */
const OFFER_PROMO: Builder[] = [
  (c) =>
    set({
      eyebrow: c.offer?.validUntil ? 'Limited offer' : 'Book direct',
      headline: c.offer!.text,
      accent: 'Stay with us',
      subhead: offerDetailLine(c.offer!) ?? 'Message us to book your dates.',
      tagline: 'Book direct, no middlemen.',
      cta: c.offer?.code ? `Use code ${c.offer.code}` : 'Book your stay',
      badge: c.offer!.text,
      listTitle: 'Included',
    }),
  (c) =>
    set({
      eyebrow: 'Special offer',
      headline: c.offer!.text,
      accent: 'Come stay',
      subhead: inPlace(
        c,
        'Your stay in {place} is a message away.',
        'Your stay is a message away.'
      ),
      tagline: offerDetailLine(c.offer!) ?? 'Ask us about your dates.',
      cta: 'Message us',
      badge: c.offer!.validUntil ? (offerDetailLine(c.offer!) ?? 'Book direct') : 'Book direct',
      listTitle: 'Included',
    }),
  (c) =>
    set({
      eyebrow: 'Mag-book na',
      headline: c.offer!.text,
      accent: 'Book direct',
      subhead: offerDetailLine(c.offer!) ?? 'Message us para sa dates.',
      tagline: 'Simple booking, direct sa amin.',
      cta: c.offer?.code ? `Use code ${c.offer.code}` : 'Message us',
      badge: 'Direct booking',
      listTitle: 'Included',
    }),
  (c) =>
    set({
      eyebrow: 'Plan the getaway',
      headline: c.offer!.text,
      accent: 'Before dates fill up',
      subhead: c.rate ? `From ${c.rate} a night.` : 'Weekends fill up first.',
      tagline: offerDetailLine(c.offer!) ?? 'Reserve now, relax later.',
      cta: 'Reserve now',
      badge: 'Book direct',
      listTitle: 'Included',
    }),
];

export const POSTER_COPY_LIBRARY: Record<PosterGoal, Builder[]> = {
  vibe: VIBE,
  promo: PROMO,
  'amenity-spotlight': AMENITY,
  'feature-spotlight': FEATURE,
  'stay-info': STAY_INFO,
};

function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Copy for variant `index` of a batch. The listing name seeds a stable starting point
 * and the variants walk the library with a stride that is coprime with its size, so
 * four variants never share a set (and so never share a tagline), yet the same
 * listing always gets the same posts.
 */
export function pickPosterCopy(goal: PosterGoal, ctx: CopyContext, index: number): PosterCopySet {
  if (goal === 'promo' && ctx.offer) {
    // Four offer sets, one per variant: the offer itself never changes between them.
    return OFFER_PROMO[Math.max(0, index) % OFFER_PROMO.length]!(ctx);
  }
  const builders = POSTER_COPY_LIBRARY[goal];
  const start = seedFrom(`${ctx.name}|${goal}`) % builders.length;
  const stride = 5; // coprime with 6
  const slot = (start + ((Math.max(0, index) * stride) % builders.length)) % builders.length;
  return builders[slot]!(ctx);
}
