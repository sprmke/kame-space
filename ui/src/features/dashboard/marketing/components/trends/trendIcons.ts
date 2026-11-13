import {
  CalendarDays,
  Cpu,
  Gamepad2,
  LucideIcon,
  Music,
  Plane,
  Sparkles,
  Star,
  Tag,
  Trophy,
  Tv,
  UtensilsCrossed,
} from 'lucide-react';

import type { TrendCategory } from '../../lib/trends/trendTypes';

/** One icon per category. Lucide only, already bundled. */
export const TREND_CATEGORY_ICONS: Record<TrendCategory, LucideIcon> = {
  tv_film: Tv,
  music: Music,
  celebrity: Star,
  sports: Trophy,
  food: UtensilsCrossed,
  travel: Plane,
  holiday_event: CalendarDays,
  lifestyle: Sparkles,
  gaming: Gamepad2,
  tech: Cpu,
  other: Tag,
};
