/**
 * Marketing Planner rules-mode copy.
 *
 * Used when AI is off, out of credits, or when the AI brief fails the truth guard.
 * Every template is short, plain, and placeholder-driven: the engine fills facts,
 * never the model, so a rules-mode plan can never invent a date or a price.
 *
 * Fix a typo here and both the rules plan and the AI fallback change.
 */

import type { MarketingOpportunityType } from './marketingPlaybook.ts';

export type PlannerLanguage = 'en' | 'fil' | 'taglish';

export type CopyTemplate = {
  title: string;
  hook: string;
  message: string;
  cta: string;
};

export type CopyVars = {
  propertyName?: string;
  dates?: string;
  nightsLeft?: string;
  rate?: string;
  rating?: string;
  reviewCount?: string;
  eventName?: string;
  amenity?: string;
  area?: string;
};

const EN: Record<MarketingOpportunityType, CopyTemplate> = {
  tonight_tomorrow: {
    title: 'Open tonight',
    hook: 'Tonight is still open.',
    message: '{{propertyName}} has {{dates}} free. Same day check-in works.',
    cta: 'Message us to book',
  },
  weekend_open: {
    title: 'Open this weekend',
    hook: '{{nightsLeft}} left this weekend.',
    message: '{{dates}} are still open at {{propertyName}}.',
    cta: 'Book the weekend',
  },
  gap_nights: {
    title: 'Short gap, good price',
    hook: '{{nightsLeft}} in the middle of the calendar.',
    message: '{{dates}} just opened at {{propertyName}}. Good fit for a quick trip.',
    cta: 'Message us',
  },
  last_slots_month: {
    title: 'Few dates left',
    hook: '{{nightsLeft}} left this month.',
    message: 'Open dates at {{propertyName}}: {{dates}}.',
    cta: 'See the dates',
  },
  long_weekend: {
    title: '{{eventName}} is coming',
    hook: '{{eventName}} weekend is open.',
    message: 'Plan around {{eventName}}. {{dates}} are still free at {{propertyName}}.',
    cta: 'Book before it fills',
  },
  seasonal_moment: {
    title: '{{eventName}} season',
    hook: '{{eventName}} is here.',
    message: 'Slow mornings, {{area}}, and a place to come back to.',
    cta: 'Plan your stay',
  },
  freed_dates: {
    title: 'Dates just opened',
    hook: '{{dates}} just became free.',
    message: 'A cancellation opened {{dates}} at {{propertyName}}.',
    cta: 'Message us fast',
  },
  rate_live_drop: {
    title: 'Lower rate, open dates',
    hook: 'From {{rate}} a night.',
    message: '{{dates}} are open at {{rate}} a night at {{propertyName}}.',
    cta: 'Check the dates',
  },
  fully_booked: {
    title: 'Fully booked',
    hook: 'We are full for {{dates}}.',
    message: 'Thank you to everyone who booked. Next open dates: {{dates}}.',
    cta: 'Ask about the waitlist',
  },
  new_review: {
    title: 'Guest review',
    hook: '{{rating}} stars from a recent guest.',
    message: 'A guest just rated {{propertyName}} {{rating}} out of 5.',
    cta: 'Read it and book',
  },
  rating_milestone: {
    title: '{{rating}} from {{reviewCount}} guests',
    hook: '{{rating}} stars across {{reviewCount}} stays.',
    message: '{{reviewCount}} guests have rated {{propertyName}} {{rating}} on average.',
    cta: 'Book with confidence',
  },
  amenity_spotlight: {
    title: '{{amenity}}',
    hook: 'The part guests keep mentioning.',
    message: '{{amenity}} at {{propertyName}}, in {{area}}.',
    cta: 'See the place',
  },
  audience_fit: {
    title: 'Built for your group',
    hook: 'Plenty of room for the whole group.',
    message: '{{propertyName}} fits the people you travel with.',
    cta: 'Check the space',
  },
  direct_booking_push: {
    title: 'Book direct',
    hook: 'Book direct and skip the fees.',
    message: 'Message {{propertyName}} directly for the best rate on {{dates}}.',
    cta: 'Message us',
  },
  local_event: {
    title: '{{eventName}} nearby',
    hook: '{{eventName}} is close by.',
    message: 'Staying at {{propertyName}} puts you near {{eventName}}.',
    cta: 'Plan around it',
  },
  content_refresh: {
    title: 'New photos',
    hook: 'New photos, same place.',
    message: 'A fresh look at {{propertyName}} in {{area}}.',
    cta: 'See the photos',
  },
  cadence_gap: {
    title: 'Quiet morning',
    hook: 'A quiet morning at {{propertyName}}.',
    message: 'Slow start, good coffee, nowhere to be.',
    cta: 'Book a slow stay',
  },
  payday_weekend: {
    title: 'Payday weekend',
    hook: 'Payday, and {{dates}} are open.',
    message: '{{dates}} are free at {{propertyName}}.',
    cta: 'Message us',
  },
};

const FIL: Record<MarketingOpportunityType, CopyTemplate> = {
  tonight_tomorrow: {
    title: 'Bukas ngayong gabi',
    hook: 'Bakante pa ngayong gabi.',
    message: 'May available na {{dates}} sa {{propertyName}}. Puwede ang same day check-in.',
    cta: 'Message para mag-book',
  },
  weekend_open: {
    title: 'Bakante ngayong weekend',
    hook: '{{nightsLeft}} pa ang bakante ngayong weekend.',
    message: 'Available pa ang {{dates}} sa {{propertyName}}.',
    cta: 'I-book ang weekend',
  },
  gap_nights: {
    title: 'Maliit na bakante',
    hook: '{{nightsLeft}} sa gitna ng kalendaryo.',
    message: 'Bagong bukas ang {{dates}} sa {{propertyName}}. Bagay sa quick trip.',
    cta: 'Message kami',
  },
  last_slots_month: {
    title: 'Konti na lang',
    hook: '{{nightsLeft}} na lang ang natitira ngayong buwan.',
    message: 'Mga bakanteng petsa sa {{propertyName}}: {{dates}}.',
    cta: 'Tingnan ang petsa',
  },
  long_weekend: {
    title: 'Malapit na ang {{eventName}}',
    hook: 'Bakante pa ang {{eventName}} weekend.',
    message: 'Magplano para sa {{eventName}}. Available pa ang {{dates}} sa {{propertyName}}.',
    cta: 'Book bago mapuno',
  },
  seasonal_moment: {
    title: 'Panahon ng {{eventName}}',
    hook: 'Narito na ang {{eventName}}.',
    message: 'Mahiming na umaga, {{area}}, at uuwian mo.',
    cta: 'Planuhin ang stay',
  },
  freed_dates: {
    title: 'Bagong bukas na petsa',
    hook: 'Bagong bakante ang {{dates}}.',
    message: 'May nag-cancel, kaya bukas ang {{dates}} sa {{propertyName}}.',
    cta: 'Message agad',
  },
  rate_live_drop: {
    title: 'Mas mababang rate',
    hook: 'Mula {{rate}} kada gabi.',
    message: 'Available ang {{dates}} sa {{rate}} kada gabi sa {{propertyName}}.',
    cta: 'Tingnan ang petsa',
  },
  fully_booked: {
    title: 'Puno na',
    hook: 'Puno kami sa {{dates}}.',
    message: 'Salamat sa lahat ng nag-book. Susunod na bakante: {{dates}}.',
    cta: 'Magtanong sa waitlist',
  },
  new_review: {
    title: 'Review ng guest',
    hook: '{{rating}} stars mula sa bagong guest.',
    message: 'Rating ng guest sa {{propertyName}}: {{rating}} sa 5.',
    cta: 'Basahin at mag-book',
  },
  rating_milestone: {
    title: '{{rating}} mula sa {{reviewCount}} guests',
    hook: '{{rating}} stars sa {{reviewCount}} stay.',
    message: '{{reviewCount}} guests ang nag-rate sa {{propertyName}} ng {{rating}} sa average.',
    cta: 'Mag-book nang sigurado',
  },
  amenity_spotlight: {
    title: '{{amenity}}',
    hook: 'Ito ang laging nababanggit ng guests.',
    message: '{{amenity}} sa {{propertyName}}, sa {{area}}.',
    cta: 'Tingnan ang lugar',
  },
  audience_fit: {
    title: 'Kasya ang buong grupo',
    hook: 'Malawak para sa buong barkada.',
    message: 'Kasya sa {{propertyName}} ang mga kasama mo sa biyahe.',
    cta: 'Tingnan ang space',
  },
  direct_booking_push: {
    title: 'Direct booking',
    hook: 'Mag-book direct, walang extra fees.',
    message: 'Message sa {{propertyName}} para sa pinakamurang rate sa {{dates}}.',
    cta: 'Message kami',
  },
  local_event: {
    title: 'Malapit ang {{eventName}}',
    hook: 'Malapit lang ang {{eventName}}.',
    message: 'Kapag sa {{propertyName}} ka nag-stay, malapit ka sa {{eventName}}.',
    cta: 'Planuhin ito',
  },
  content_refresh: {
    title: 'Bagong litrato',
    hook: 'Bagong litrato, parehong lugar.',
    message: 'Bagong tingin sa {{propertyName}} sa {{area}}.',
    cta: 'Tingnan ang litrato',
  },
  cadence_gap: {
    title: 'Mahiming na umaga',
    hook: 'Mahiming na umaga sa {{propertyName}}.',
    message: 'Slow start, masarap na kape, walang hinahabol.',
    cta: 'Mag-book ng slow stay',
  },
  payday_weekend: {
    title: 'Payday weekend',
    hook: 'Payday, at bukas ang {{dates}}.',
    message: 'Available ang {{dates}} sa {{propertyName}}.',
    cta: 'Message kami',
  },
};

const TAGLISH: Record<MarketingOpportunityType, CopyTemplate> = {
  tonight_tomorrow: {
    title: 'Open tonight',
    hook: 'Open pa tonight.',
    message: 'May free na {{dates}} sa {{propertyName}}. Puwede same day check-in.',
    cta: 'Message us to book',
  },
  weekend_open: {
    title: 'Open this weekend',
    hook: '{{nightsLeft}} pa this weekend.',
    message: 'Open pa ang {{dates}} sa {{propertyName}}.',
    cta: 'Book the weekend',
  },
  gap_nights: {
    title: 'Quick gap',
    hook: '{{nightsLeft}} sa gitna ng calendar.',
    message: 'Bagong open ang {{dates}} sa {{propertyName}}. Sakto sa quick trip.',
    cta: 'Message us',
  },
  last_slots_month: {
    title: 'Konti na lang',
    hook: '{{nightsLeft}} na lang this month.',
    message: 'Open dates sa {{propertyName}}: {{dates}}.',
    cta: 'See the dates',
  },
  long_weekend: {
    title: '{{eventName}} is coming',
    hook: 'Open pa ang {{eventName}} weekend.',
    message: 'Plan around {{eventName}}. Open pa ang {{dates}} sa {{propertyName}}.',
    cta: 'Book before it fills',
  },
  seasonal_moment: {
    title: '{{eventName}} season',
    hook: '{{eventName}} na.',
    message: 'Slow mornings, {{area}}, at uuwian mo.',
    cta: 'Plan your stay',
  },
  freed_dates: {
    title: 'Bagong open na dates',
    hook: 'Bagong open ang {{dates}}.',
    message: 'May nag-cancel, kaya open ang {{dates}} sa {{propertyName}}.',
    cta: 'Message us fast',
  },
  rate_live_drop: {
    title: 'Lower rate',
    hook: 'From {{rate}} per night.',
    message: 'Open ang {{dates}} at {{rate}} per night sa {{propertyName}}.',
    cta: 'Check the dates',
  },
  fully_booked: {
    title: 'Fully booked',
    hook: 'Full na kami sa {{dates}}.',
    message: 'Salamat sa lahat ng nag-book. Next open dates: {{dates}}.',
    cta: 'Ask about the waitlist',
  },
  new_review: {
    title: 'Guest review',
    hook: '{{rating}} stars from a recent guest.',
    message: 'Bagong rating sa {{propertyName}}: {{rating}} out of 5.',
    cta: 'Read it and book',
  },
  rating_milestone: {
    title: '{{rating}} from {{reviewCount}} guests',
    hook: '{{rating}} stars across {{reviewCount}} stays.',
    message: '{{reviewCount}} guests na ang nag-rate sa {{propertyName}} ng {{rating}} on average.',
    cta: 'Book with confidence',
  },
  amenity_spotlight: {
    title: '{{amenity}}',
    hook: 'Ito ang laging nababanggit ng guests.',
    message: '{{amenity}} sa {{propertyName}}, sa {{area}}.',
    cta: 'See the place',
  },
  audience_fit: {
    title: 'Kasya ang group',
    hook: 'Kasya ang buong barkada.',
    message: 'Sakto ang {{propertyName}} sa mga kasama mo.',
    cta: 'Check the space',
  },
  direct_booking_push: {
    title: 'Book direct',
    hook: 'Book direct, walang extra fees.',
    message: 'Message {{propertyName}} directly for the best rate sa {{dates}}.',
    cta: 'Message us',
  },
  local_event: {
    title: 'Malapit ang {{eventName}}',
    hook: 'Malapit lang ang {{eventName}}.',
    message: 'Kapag sa {{propertyName}} ka nag-stay, malapit ka sa {{eventName}}.',
    cta: 'Plan around it',
  },
  content_refresh: {
    title: 'Bagong photos',
    hook: 'Bagong photos, same place.',
    message: 'Fresh look sa {{propertyName}} in {{area}}.',
    cta: 'See the photos',
  },
  cadence_gap: {
    title: 'Quiet morning',
    hook: 'Quiet morning sa {{propertyName}}.',
    message: 'Slow start, good coffee, walang hinahabol.',
    cta: 'Book a slow stay',
  },
  payday_weekend: {
    title: 'Payday weekend',
    hook: 'Payday, at open ang {{dates}}.',
    message: 'Open ang {{dates}} sa {{propertyName}}.',
    cta: 'Message us',
  },
};

export const COPY_LIBRARY: Record<PlannerLanguage, Record<MarketingOpportunityType, CopyTemplate>> =
  {
    en: EN,
    fil: FIL,
    taglish: TAGLISH,
  };

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

/**
 * Fill a template. A missing variable becomes an empty string and never leaves a
 * literal `{{name}}` in host-visible copy.
 */
export function fillCopy(template: string, vars: CopyVars): string {
  return template.replace(PLACEHOLDER_RE, (_match, key: string) => {
    const value = vars[key as keyof CopyVars];
    return typeof value === 'string' ? value : '';
  }).replace(/\s{2,}/g, ' ').trim();
}

export function resolveCopyTemplate(
  type: MarketingOpportunityType,
  language: PlannerLanguage
): CopyTemplate {
  return COPY_LIBRARY[language][type];
}

export function fillTemplate(template: CopyTemplate, vars: CopyVars): CopyTemplate {
  return {
    title: fillCopy(template.title, vars),
    hook: fillCopy(template.hook, vars),
    message: fillCopy(template.message, vars),
    cta: fillCopy(template.cta, vars),
  };
}
