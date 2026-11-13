/**
 * Marketing Trends — the evergreen fallback.
 *
 * When the daily pipeline has nothing usable (the cron failed, the list is older
 * than 72 h, or the property turned Trends on before the first run), the host
 * still gets ideas. These are Philippine seasonal ideas, not trends: the UI says
 * "Seasonal ideas" instead of "Trending today" so nobody mistakes one for the
 * other.
 *
 * The client keeps a mirrored copy in
 * `ui/src/features/dashboard/marketing/lib/trends/evergreenIdeas.ts`; a unit test
 * asserts the two stay identical.
 *
 * Plan: docs/workflow/in-progress/marketing-trending-topics.md
 */

import type { TrendAngle, TrendCategory } from './types.ts';

export type EvergreenIdea = {
  key: string;
  title: string;
  summary: string;
  category: TrendCategory;
  angles: TrendAngle[];
  captionIdea: string;
  hashtags: string[];
};

type IdeaSeed = {
  key: string;
  title: string;
  summary: string;
  category: TrendCategory;
  captionIdea: string;
  hashtags: string[];
  angles: Array<Pick<TrendAngle, 'title' | 'hook' | 'output' | 'goal' | 'format' | 'prompt'>>;
};

/** Angle shapes reused across ideas so the sheet always looks the same. */
const WATCH_PARTY: IdeaSeed['angles'][number] = {
  title: 'Watch party staycation',
  hook: 'Big night on screen, better from a proper stay.',
  output: 'post',
  goal: 'vibe',
  format: 'instagram-portrait',
  prompt:
    'A cozy staycation post about a watch party: the TV on, snacks out, lights low. Warm and welcoming, no logos, no real people.',
};

const WEEKEND: IdeaSeed['angles'][number] = {
  title: 'Long weekend getaway',
  hook: 'Three days off is a good reason to book a room.',
  output: 'post',
  goal: 'promo',
  format: 'instagram-portrait',
  prompt:
    'A long weekend getaway post: a relaxed balcony or pool scene, an open calendar and a short stay. Inviting, not pushy.',
};

const CELEBRATION: IdeaSeed['angles'][number] = {
  title: 'Celebration stay',
  hook: 'Bring the whole group and stay the night.',
  output: 'post',
  goal: 'promo',
  format: 'instagram-square',
  prompt:
    'A celebration stay post: a group-friendly living room with extra space, a birthday table, warm evening light. No brand names.',
};

const NEIGHBOURHOOD: IdeaSeed['angles'][number] = {
  title: 'Stay local',
  hook: 'The good part of the city is a short drive away.',
  output: 'post',
  goal: 'feature-spotlight',
  format: 'instagram-portrait',
  prompt:
    'A staycation post about staying local: a neighbourhood morning, a market walk, a quiet balcony. Simple and true to the area.',
};

const HOLIDAY_FOOD: IdeaSeed['angles'][number] = {
  title: 'Holiday table',
  hook: 'The best part of the season is eating well.',
  output: 'post',
  goal: 'amenity-spotlight',
  format: 'instagram-square',
  prompt:
    'A holiday food post set in a bright kitchen or dining area of a rental: a long table, home cooking, warm colours. No brand logos.',
};

const CLIP: IdeaSeed['angles'][number] = {
  title: 'Slow morning clip',
  hook: 'Nothing to do, and that is the point.',
  output: 'video',
  goal: 'vibe',
  format: '9:16',
  prompt:
    'A slow vertical clip of a morning in a stay: curtains opening, light moving across the floor, a cup on the table. No people, no text.',
};

/** Year-round ideas, shown in every month. */
const YEAR_ROUND: IdeaSeed[] = [
  {
    key: 'weekend-getaway',
    title: 'Weekend getaway',
    summary: 'A short break is a good reason to book a room.',
    category: 'travel',
    captionIdea:
      'Two nights, one good playlist, zero laundry. Where is your weekend going?',
    hashtags: ['#Staycation', '#WeekendGetaway', '#TravelPH'],
    angles: [WEEKEND, NEIGHBOURHOOD, CLIP],
  },
  {
    key: 'celebration-stay',
    title: 'Celebration stay',
    summary: 'Room for the whole group, and a table for the cake.',
    category: 'lifestyle',
    captionIdea: 'The whole group, one address, and nobody has to drive home.',
    hashtags: ['#CelebrationStay', '#GroupStay', '#Staycation'],
    angles: [CELEBRATION, WATCH_PARTY, CLIP],
  },
];

/** Per-month ideas. `null` means the month has no seasonal note. */
const MONTHLY: Record<number, IdeaSeed[]> = {
  1: [
    {
      key: 'new-year-stay',
      title: 'New Year stay',
      summary: 'The calendar turned over. A fresh room is part of it.',
      category: 'holiday_event',
      captionIdea: 'New year, new place to wake up in.',
      hashtags: ['#NewYear', '#Staycation', '#PH'],
      angles: [CELEBRATION, WATCH_PARTY, CLIP],
    },
    {
      key: 'binibining-marikudo',
      title: 'Marikudo festival',
      summary: 'Nijik and Ibalong, the harvest festival of Negros Oriental.',
      category: 'holiday_event',
      captionIdea: 'Colour, drums and a long table. Festival season in Negros.',
      hashtags: ['#Marikudo', '#NijikFestival', '#NegrosOriental'],
      angles: [HOLIDAY_FOOD, NEIGHBOURHOOD, CLIP],
    },
  ],
  2: [
    {
      key: 'chinese-new-year',
      title: 'Chinese New Year',
      summary: 'Lunar New Year: reunion dinners and a few days off.',
      category: 'holiday_event',
      captionIdea: 'Reunion dinner, red packets, and one more night in the city.',
      hashtags: ['#ChineseNewYear', '#LunarNewYear', '#Staycation'],
      angles: [HOLIDAY_FOOD, CELEBRATION, CLIP],
    },
    {
      key: 'sinulog',
      title: 'Sinulog season',
      summary: 'Ati-Atihan and the Cebu festival season.',
      category: 'holiday_event',
      captionIdea: 'Devotion, drums and festival season in Cebu.',
      hashtags: ['#Sinulog', '#AtiAtihan', '#Cebu'],
      angles: [NEIGHBOURHOOD, HOLIDAY_FOOD, CLIP],
    },
  ],
  3: [
    {
      key: 'summer-opening',
      title: 'Summer stay',
      summary: 'The hot season starts. Pool weather is on.',
      category: 'holiday_event',
      captionIdea: 'Summer is here. So is the pool.',
      hashtags: ['#SummerPH', '#PoolStay', '#Staycation'],
      angles: [WEEKEND, CLIP, NEIGHBOURHOOD],
    },
    {
      key: 'metro-manila-festival',
      title: 'Metro Manila Festival',
      summary: 'The season of malls, plays and late nights in the city.',
      category: 'lifestyle',
      captionIdea: 'City nights are better when the drive home is short.',
      hashtags: ['#MetroManilaFestival', '#CityStay', '#Manila'],
      angles: [WEEKEND, NEIGHBOURHOOD, CLIP],
    },
  ],
  4: [
    {
      key: 'holy-week',
      title: 'Holy Week',
      summary: 'Semana Santa: processions, retreats and a long weekend.',
      category: 'holiday_event',
      captionIdea: 'Holy Week, a quiet stay, and time to think.',
      hashtags: ['#HolyWeek', '#SemanaSanta', '#Staycation'],
      angles: [NEIGHBOURHOOD, CLIP, WEEKEND],
    },
    {
      key: 'summer-escape',
      title: 'Summer escape',
      summary: 'Mid heat. A room with air conditioning and a slow plan.',
      category: 'travel',
      captionIdea: 'Too hot to wander. Perfect for staying in.',
      hashtags: ['#SummerPH', '#Staycation', '#TravelPH'],
      angles: [WEEKEND, CLIP, NEIGHBOURHOOD],
    },
  ],
  5: [
    {
      key: 'labor-day',
      title: 'Long weekend',
      summary: 'Five days off for three days of work.',
      category: 'holiday_event',
      captionIdea: 'Long weekend, short drive, longer stay.',
      hashtags: ['#LongWeekend', '#Staycation', '#TravelPH'],
      angles: [WEEKEND, NEIGHBOURHOOD, CLIP],
    },
    {
      key: 'summer-night',
      title: 'Summer nights',
      summary: 'Warm evenings, cold drinks, an early night in.',
      category: 'lifestyle',
      captionIdea: 'Summer nights are for the balcony.',
      hashtags: ['#SummerNight', '#Staycation', '#PH'],
      angles: [WATCH_PARTY, CLIP, NEIGHBOURHOOD],
    },
  ],
  6: [
    {
      key: 'independence-day',
      title: 'Independence Day',
      summary: 'June 12: flag raised, family around, a free day.',
      category: 'holiday_event',
      captionIdea: 'Freedom. Family. One more night in the city.',
      hashtags: ['#IndependenceDay', '#PhilippineFlag', '#Staycation'],
      angles: [CELEBRATION, HOLIDAY_FOOD, CLIP],
    },
    {
      key: 'school-holidays',
      title: 'School holidays',
      summary: 'Summer break for the kids, a staycation for everyone else.',
      category: 'travel',
      captionIdea: 'School holidays, and a pool the kids will not leave.',
      hashtags: ['#SchoolHolidays', '#FamilyStay', '#Staycation'],
      angles: [CELEBRATION, WEEKEND, CLIP],
    },
  ],
  7: [
    {
      key: 'rainy-season',
      title: 'Rainy season',
      summary: 'It rains every afternoon. Plan around it.',
      category: 'lifestyle',
      captionIdea: 'Rainy season, warm food, nowhere to rush.',
      hashtags: ['#RainySeason', '#Staycation', '#PH'],
      angles: [HOLIDAY_FOOD, CLIP, NEIGHBOURHOOD],
    },
    {
      key: 'budget-travel',
      title: 'Budget city break',
      summary: 'A short stay in the city without spending much.',
      category: 'travel',
      captionIdea: 'A city break that costs less than a weekend out.',
      hashtags: ['#BudgetTravel', '#CityBreak', '#TravelPH'],
      angles: [WEEKEND, NEIGHBOURHOOD, CLIP],
    },
  ],
  8: [
    {
      key: 'ninoy-day',
      title: 'Ninoy Aquino Day',
      summary: 'August 21, and a day off to remember.',
      category: 'holiday_event',
      captionIdea: 'A quiet August. A day worth sitting down for.',
      hashtags: ['#NinoyAquinoDay', '#Philippines', '#Staycation'],
      angles: [NEIGHBOURHOOD, CLIP, WEEKEND],
    },
    {
      key: 'heritage-month',
      title: 'Heritage month',
      summary: 'August is heritage month: museums, food and old streets.',
      category: 'travel',
      captionIdea: 'Old streets, old food, a room near the middle of it all.',
      hashtags: ['#HeritageMonth', '#TravelPH', '#Staycation'],
      angles: [NEIGHBOURHOOD, HOLIDAY_FOOD, CLIP],
    },
  ],
  9: [
    {
      key: 'bomba-season',
      title: 'Bomba season',
      summary: 'Rain early, party late. Both are part of the month.',
      category: 'lifestyle',
      captionIdea: 'Bomba season: rain in the afternoon, plan in the evening.',
      hashtags: ['#BombaSeason', '#Staycation', '#Manila'],
      angles: [WATCH_PARTY, CLIP, NEIGHBOURHOOD],
    },
    {
      key: 'ber-months',
      title: 'Ber months',
      summary: 'The Christmas season starts: lights, gifts and long tables.',
      category: 'holiday_event',
      captionIdea: 'Ber months. The lights are up early this year.',
      hashtags: ['#BerMonths', '#ChristmasPH', '#Staycation'],
      angles: [HOLIDAY_FOOD, CELEBRATION, CLIP],
    },
  ],
  10: [
    {
      key: 'filipino-heroes-day',
      title: 'Filipino Heroes Day',
      summary: 'The last Monday of October, and a longer weekend.',
      category: 'holiday_event',
      captionIdea: 'A long weekend and a short trip.',
      hashtags: ['#FilipinoHeroesDay', '#LongWeekend', '#Staycation'],
      angles: [WEEKEND, NEIGHBOURHOOD, CLIP],
    },
    {
      key: 'halloween',
      title: 'Halloween',
      summary: 'Costumes, ghost stories and a party at home.',
      category: 'lifestyle',
      captionIdea: 'Costume optional. The stay is not.',
      hashtags: ['#Halloween', '#Staycation', '#PH'],
      angles: [CELEBRATION, WATCH_PARTY, CLIP],
    },
  ],
  11: [
    {
      key: 'bonifacio-day',
      title: 'Bonifacio Day',
      summary: 'November 30, and the month where the lights come on.',
      category: 'holiday_event',
      captionIdea: 'November 30, and the Christmas lists are already out.',
      hashtags: ['#BonifacioDay', '#ChristmasPH', '#Staycation'],
      angles: [HOLIDAY_FOOD, CELEBRATION, CLIP],
    },
    {
      key: 'all-saints',
      title: 'All Saints and All Souls',
      summary: 'November 1 and 2: cemetery visits and family food.',
      category: 'holiday_event',
      captionIdea: 'The long table is set for everyone.',
      hashtags: ['#AllSaintsDay', '#FamilyTime', '#PH'],
      angles: [HOLIDAY_FOOD, NEIGHBOURHOOD, CLIP],
    },
  ],
  12: [
    {
      key: 'christmas-stay',
      title: 'Christmas stay',
      summary: 'The biggest staycation of the year.',
      category: 'holiday_event',
      captionIdea: 'This year, stay in and make it a whole thing.',
      hashtags: ['#Christmas', '#MerryChristmas', '#Staycation'],
      angles: [CELEBRATION, HOLIDAY_FOOD, WATCH_PARTY],
    },
    {
      key: 'new-year-eve',
      title: 'New Year Eve',
      summary: 'Countdown, confetti, one more night.',
      category: 'holiday_event',
      captionIdea: 'Countdown from the balcony, sleep from the bedroom.',
      hashtags: ['#NewYearEve', '#NewYear', '#Staycation'],
      angles: [CELEBRATION, CLIP, WATCH_PARTY],
    },
    {
      key: 'mmff',
      title: 'Metro Manila Film Festival',
      summary: 'December 25 to January: a month of films.',
      category: 'lifestyle',
      captionIdea: 'Festival season, one film a week.',
      hashtags: ['#MMFF', '#MetroManilaFestival', '#Manila'],
      angles: [WATCH_PARTY, NEIGHBOURHOOD, CLIP],
    },
  ],
};

/** The ideas for a given month (1 to 12), year-round ideas first. */
export function evergreenIdeasForMonth(month: number): EvergreenIdea[] {
  const safeMonth = Number.isFinite(month) ? ((Math.trunc(month) - 1 + 12) % 12) + 1 : 1;
  const seeds = [...YEAR_ROUND, ...(MONTHLY[safeMonth] ?? [])];
  return seeds.map((seed) => ({
    key: seed.key,
    title: seed.title,
    summary: seed.summary,
    category: seed.category,
    angles: seed.angles.map((angle) => ({ ...angle })),
    captionIdea: seed.captionIdea,
    hashtags: [...seed.hashtags],
  }));
}

/** Every idea in the list, for tests and the admin page. */
export function allEvergreenIdeas(): EvergreenIdea[] {
  const seen = new Map<string, EvergreenIdea>();
  for (let month = 1; month <= 12; month += 1) {
    for (const idea of evergreenIdeasForMonth(month)) seen.set(idea.key, idea);
  }
  return [...seen.values()];
}
