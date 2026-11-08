import {
  ArrowLeftRight,
  BookOpenText,
  CalendarCheck,
  Gift,
  type LucideIcon,
  MessageCircle,
  Route,
  Search,
} from 'lucide-react';

export type GuestShowcaseChapterId =
  'search' | 'book' | 'chat' | 'trip' | 'guide' | 'perks' | 'compare';

export interface GuestShowcaseChapter {
  id: GuestShowcaseChapterId;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Time on screen during autoplay; long enough for the scene's story to finish. */
  durationMs: number;
}

/** Ordered like a real trip: find, book, ask, prepare, stay, come back. */
export const GUEST_SHOWCASE_CHAPTERS: readonly GuestShowcaseChapter[] = [
  {
    id: 'search',
    label: 'Search',
    title: 'Search the way you talk',
    description: 'Type “beach condo for 4” and get stays, parking and buildings that fit.',
    icon: Search,
    durationMs: 6500,
  },
  {
    id: 'book',
    label: 'Book',
    title: 'Book straight with the host',
    description: 'Pick your dates, see the full price, and pay a down payment to lock it in.',
    icon: CalendarCheck,
    durationMs: 6000,
  },
  {
    id: 'chat',
    label: 'Chat',
    title: 'Ask before you book',
    description: 'Message the host, or talk to the AI receptionist on places that have it.',
    icon: MessageCircle,
    durationMs: 9500,
  },
  {
    id: 'trip',
    label: 'Trip',
    title: 'One page for your whole trip',
    description: 'Status, documents, parking and balance, all in one place.',
    icon: Route,
    durationMs: 5500,
  },
  {
    id: 'guide',
    label: 'Guide',
    title: 'Check-in without the guesswork',
    description: 'Wi-Fi, house rules and check-in steps, ready when you arrive.',
    icon: BookOpenText,
    durationMs: 6500,
  },
  {
    id: 'perks',
    label: 'Perks',
    title: 'Come back for less',
    description: 'Spin for a voucher on your next stay, and see your deposit come back.',
    icon: Gift,
    durationMs: 7500,
  },
  {
    id: 'compare',
    label: 'Compare',
    title: 'Same trip, less chasing',
    description:
      'Other apps scatter your trip across inboxes and calls. Here every step lands on one page.',
    icon: ArrowLeftRight,
    durationMs: 9500,
  },
] as const;
