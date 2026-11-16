import {
  BadgeCheck,
  Bot,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  ConciergeBell,
  FileCheck2,
  Megaphone,
  LineChart,
  MessageSquare,
  Receipt,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export const V4_SIGNUP_CTA = { label: 'Start free', to: '/for-hosts/login' } as const;
export const V4_PRICING_CTA = { label: 'See plans', to: '/for-hosts/pricing' } as const;

export const v4ProofPoints = [
  {
    value: '0%',
    label: 'Kame commission on property bookings',
    note: 'Active property plans use a subscription, not a cut of every booking.',
  },
  {
    value: 'One',
    label: 'workflow for every stay',
    note: 'Direct, Airbnb, and manually added bookings can be managed together.',
  },
  {
    value: '24/7',
    label: 'AI guest support',
    note: 'Supported questions can be answered from your property information.',
  },
] as const;

export interface V4Outcome {
  id: string;
  number: string;
  kicker: string;
  title: string;
  body: string;
  detail: string;
  icon: LucideIcon;
  scene: 'earn' | 'operate' | 'serve' | 'grow';
}

export const v4Outcomes: V4Outcome[] = [
  {
    id: 'earn',
    number: '01',
    kicker: 'Earn on your terms',
    title: 'Keep more room in every direct booking.',
    body: 'Set rates with more freedom when your platform is not taking a percentage from each property booking.',
    detail: 'Your own booking page, your own guest relationship, your own pricing decisions.',
    icon: CircleDollarSign,
    scene: 'earn',
  },
  {
    id: 'operate',
    number: '02',
    kicker: 'Run one operation',
    title: 'Move every stay through the same clear workflow.',
    body: 'Bookings, documents, payment proof, check-in, check-out, and deposit refunds stay connected.',
    detail: 'Less tab switching. Fewer missed steps. A cleaner handoff for your team.',
    icon: ClipboardCheck,
    scene: 'operate',
  },
  {
    id: 'serve',
    number: '03',
    kicker: 'Respond without hovering',
    title: 'Give guests useful answers while you are busy.',
    body: 'The AI receptionist uses your property information to handle supported questions and routes the rest back to you.',
    detail:
      'Guests also get one trip page for arrival details, house rules, payments, and stay information.',
    icon: ConciergeBell,
    scene: 'serve',
  },
  {
    id: 'grow',
    number: '04',
    kicker: 'Build beyond one stay',
    title: 'Turn a completed booking into the next direct relationship.',
    body: 'Create social content, offer host-funded vouchers, collect reviews, and bring past guests back to your own page.',
    detail: 'Marketplaces can help guests discover you. Kame helps you keep the relationship.',
    icon: LineChart,
    scene: 'grow',
  },
];

export interface V4CapabilityGroup {
  title: string;
  description: string;
  icon: LucideIcon;
  features: Array<{ label: string; icon: LucideIcon }>;
}

export const v4CapabilityGroups: V4CapabilityGroup[] = [
  {
    title: 'Operate every stay',
    description: 'From the first request to the security deposit refund.',
    icon: ClipboardCheck,
    features: [
      { label: 'Booking workflow', icon: CalendarDays },
      { label: 'Documents and approvals', icon: FileCheck2 },
      { label: 'Maintenance tracking', icon: Wrench },
    ],
  },
  {
    title: 'Know the numbers',
    description: 'See income, expenses, receipts, rates, and booking performance together.',
    icon: Receipt,
    features: [
      { label: 'Finance workspace', icon: CircleDollarSign },
      { label: 'Smart pricing tools', icon: Sparkles },
      { label: 'Property analytics', icon: LineChart },
    ],
  },
  {
    title: 'Serve guests faster',
    description: 'Keep conversations and property knowledge close to each booking.',
    icon: MessageSquare,
    features: [
      { label: 'Unified guest inbox', icon: MessageSquare },
      { label: 'AI receptionist', icon: Bot },
      { label: 'Guest trip and stay guide', icon: ConciergeBell },
    ],
  },
  {
    title: 'Grow your channel',
    description: 'Give guests a reason to book direct and come back.',
    icon: Megaphone,
    features: [
      { label: 'Public listing pages', icon: BadgeCheck },
      { label: 'Marketing studio', icon: Megaphone },
      { label: 'Reviews and vouchers', icon: Sparkles },
    ],
  },
  {
    title: 'Stay in control',
    description: 'Give the right people access and keep a record of important actions.',
    icon: ShieldCheck,
    features: [
      { label: 'Team roles and permissions', icon: UsersRound },
      { label: 'Activity history', icon: ShieldCheck },
      { label: 'Airbnb availability sync', icon: CalendarDays },
    ],
  },
];

export const v4FaqItems = [
  {
    question: 'Does Kame replace Airbnb or Agoda?',
    answer:
      'Kame gives you a direct booking channel and the operating tools behind it. You can still use marketplaces for discovery. Airbnb availability and reservations can sync into Kame today, while other channel connections are not yet available.',
  },
  {
    question: 'Does Kame charge a commission on property bookings?',
    answer:
      'Active property plans use a subscription and do not charge a Kame percentage on each property booking. Parking has a separate fee model. Payment provider charges or fees from other channels may still apply.',
  },
  {
    question: 'Will AI reply to every guest message?',
    answer:
      'The AI receptionist answers supported questions using the information you provide. Safeguards and host handoff keep sensitive or uncertain questions with you. Availability depends on your plan and setup.',
  },
  {
    question: 'Can my team use the same workspace?',
    answer:
      'Yes. Invite teammates, assign roles and property access, and keep an activity history for important actions.',
  },
  {
    question: 'Can I manage Kame from my phone?',
    answer:
      'Yes. Kame is responsive and can be installed as a web app. Supported workflows also include offline and push-notification capabilities.',
  },
  {
    question: 'How do you build trust with guests?',
    answer:
      'Hosts submit identity and listing-rights information for review before going live. Guests also get clear booking, payment, policy, and stay details in one place. Verification reduces risk, but no platform can promise that fraud is impossible.',
  },
] as const;
