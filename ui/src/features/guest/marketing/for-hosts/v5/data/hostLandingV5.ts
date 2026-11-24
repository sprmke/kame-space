import {
  BarChart3,
  BedDouble,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  CornerUpRight,
  FileSpreadsheet,
  Globe,
  Headphones,
  Home,
  ImagePlus,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  PhoneCall,
  PlugZap,
  Receipt,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import type { KameMascotPose } from '@/components/branding/kameMascotAssets';

/**
 * Copy and sample data for the `/for-hosts` landing page. Every section reads from here so
 * the words can be reviewed in one place. Guest names and amounts are sample data.
 * Claims follow `docs/product-positioning.md` (claim guardrails).
 */

export const V5_SIGNUP_CTA = { label: 'Start free', to: '/for-hosts/login' } as const;
export const V5_PRICING_CTA = { label: 'See plans', to: '/for-hosts/pricing' } as const;

/* ---------------------------------------------------------------- *
 * Hero
 * ---------------------------------------------------------------- */

export type V5JobId = 'ai' | 'marketing' | 'messages' | 'pricing';

export interface V5Job {
  id: V5JobId;
  label: string;
  icon: LucideIcon;
  /** Mascot pose shown while this job is selected. */
  pose: KameMascotPose;
  /** One line under the selector. */
  line: string;
}

export const v5Hero = {
  /** Two lines; the second carries the teal accent. */
  headline: ['Hosting made easy', 'and affordable.'],
  /** `brand` is set in bold teal inside the sentence. */
  lead: {
    before: 'Let ',
    brand: 'Kame AI',
    after:
      ' handle the manual tasks while you focus on growing your business. Get all the core features for a very affordable fixed monthly price.',
  },
  tourCta: {
    label: 'Watch the tour',
    dialog: {
      title: 'Product tour',
      description: 'A narrated tour of the host dashboard.',
      closeLabel: 'Close tour',
    },
  },
  facts: ['Free to start', 'No card needed', 'No cut per booking'],
  selectorLabel: 'What you get',
  mascotLabel: 'Next',
  jobs: [
    {
      id: 'ai',
      label: 'AI',
      icon: Sparkles,
      pose: 'ai-assistant',
      line: 'Ask a question or give a task. AI answers and gets the work ready.',
    },
    {
      id: 'marketing',
      label: 'Marketing',
      icon: Megaphone,
      pose: 'marketing-studio',
      line: 'Design posts, videos, and calendars, or let AI Studio make them for you.',
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageCircle,
      pose: 'guest-inbox',
      line: 'Web chat, Facebook, and Instagram chats in one inbox. AI answers when you are away.',
    },
    {
      id: 'pricing',
      label: 'Earn more',
      icon: Wallet,
      pose: 'finance-ledger',
      line: 'No cut per booking, so you keep more or charge guests less.',
    },
  ] as V5Job[],
  cards: {
    ai: {
      tag: 'Ask or tell AI',
      question: 'Aircon in 12F is leaking. Log the ₱2,500 repair.',
      /** What the assistant proposes. Both are real proposal tools the host approves. */
      items: [
        { id: 'maintenance', module: 'Maintenance', detail: 'Aircon fix' },
        { id: 'finance', module: 'Finance', detail: '−₱2,500' },
      ] as { id: 'maintenance' | 'finance'; module: string; detail: string }[],
      result: 'Ready to approve',
    },
    studio: {
      tag: 'Marketing Studio',
      calendarLegend: 'Open',
      /** One scene per studio tab, played on a loop. */
      scenes: [
        { id: 'post', label: 'Photo editor', detail: 'Post', text: 'Weekend open' },
        { id: 'video', label: 'Video editor', detail: '15s reel', text: 'Your weekend at 12F' },
        { id: 'calendar', label: 'Calendar', detail: 'Open nights', text: 'December' },
        { id: 'ai', label: 'AI Studio', detail: 'From a prompt', text: 'Cozy weekend promo' },
      ] as {
        id: 'post' | 'video' | 'calendar' | 'ai';
        label: string;
        detail: string;
        text: string;
      }[],
    },
    inbox: {
      title: 'Messages',
      channels: [
        { id: 'web', label: 'Web chat' },
        { id: 'facebook', label: 'Facebook' },
        { id: 'instagram', label: 'Instagram' },
      ] as { id: 'web' | 'facebook' | 'instagram'; label: string }[],
      /** A dates-and-price inquiry: the receptionist answers it from live availability and rates. */
      question: 'Is Dec 12 to 14 free? How much?',
      answer: 'Yes, both nights are open. ₱7,000 total.',
      answerTag: 'AI receptionist',
    },
    fee: {
      /** Same nights and rate as the savings section defaults (`v5BookingFees`). */
      title: (nights: number, rate: string) => `${nights} nights a month at ${rate}`,
      airbnbLabel: 'Airbnb payout',
      kameLabel: (plan: string) => `With Kame ${plan}`,
      gain: (amount: string) => `+${amount} a month for you`,
    },
  },
} as const;

/* ---------------------------------------------------------------- *
 * Fees
 * ---------------------------------------------------------------- */

export interface V5FeePlan {
  /** Plan code in the pricing catalog. `growth` is sold as Pro and `pro` as Business. */
  code: 'starter' | 'growth' | 'pro';
  label: string;
  /**
   * List price per property a month. Shown only if the live catalog cannot load; a unit test
   * keeps it equal to the plan catalog.
   */
  listPhp: number;
  pose: KameMascotPose;
}

/**
 * A per-booking fee next to a flat plan. The fee is Airbnb's single host service fee: "most
 * hosts pay 15.5%" (airbnb.com/help/article/1857, checked 2026-11-23). Check it again before
 * changing the number or naming another platform.
 */
export const v5Fees = {
  title: 'One flat plan. No cut per booking.',
  lead: 'Most Airbnb hosts pay 15.5% of every booking. Kame is one flat monthly price.',
  feePercent: 15.5,
  feeLabel: 'Airbnb fee, 15.5%',
  planLabel: 'Kame plan',
  perMonth: '/mo',
  plans: [
    { code: 'starter', label: 'Starter', listPhp: 499, pose: 'plan-starter' },
    { code: 'growth', label: 'Pro', listPhp: 999, pose: 'plan-pro' },
    { code: 'pro', label: 'Business', listPhp: 1799, pose: 'plan-business' },
  ] as V5FeePlan[],
  /** Index into `plans`. */
  initialPlan: 1,
  rate: { label: 'Nightly rate', min: 1000, max: 15000, step: 100, initial: 3500 },
  nights: { label: 'Direct nights a month', min: 1, max: 30, step: 1, initial: 12 },
  /** Pose shown when the plan costs more than the fee at the chosen volume. */
  lowVolumePose: 'thinking' as KameMascotPose,
  planRow: (plan: string) => `Kame ${plan}, flat`,
  keepLabel: 'You keep each month',
  perYear: (amount: string) => `${amount} a year`,
  keepTip: 'Keep it, or give guests a lower direct rate.',
  lowVolumeLabel: 'At this volume, the plan costs more by',
  lowVolumeTip: 'You can start on Free.',
  covers: (nights: number, plan: string) =>
    `The fee on ${nights} ${nights === 1 ? 'night' : 'nights'} covers ${plan}.`,
  paysOffAt: (nights: number, plan: string) => `${plan} pays off at ${nights} nights a month.`,
  note: 'Airbnb fee from the Airbnb Help Center, November 2026. Kame price is per property. Bank or e-wallet fees may apply.',
} as const;

/**
 * Night-count version of the fee section (`V5BookingFees`), trialled in place of `V5Fees`.
 * One plan (Pro), one rate slider, and one card per night booked. To go back, render `V5Fees`
 * again in `ForHostsPage`. Same fee source as `v5Fees`.
 */
export const v5BookingFees = {
  title: 'Keep more of every booking.',
  lead: 'Most Airbnb hosts pay 15.5% of every booking. With Kame Pro, you pay one monthly price and keep the full booking amount.',
  feePercent: v5Fees.feePercent,
  plan: v5Fees.plans[1],
  rate: { label: 'Set your nightly rate', min: 1000, max: 30000, step: 500, initial: 3500 },
  perNight: '/ night',
  perNightText: (amount: string) => `${amount} per night`,
  nights: { min: 1, max: 15, initial: 10 },
  pays: (count: number, plan: string) =>
    count === 1
      ? `1 night of Airbnb fees pays for Kame ${plan}.`
      : `${count} nights of Airbnb fees pay for Kame ${plan}.`,
  nightsLabel: 'Nights booked this month',
  chipCovers: (plan: string) => `Pays for ${plan}`,
  chipKeep: 'You keep',
  addNight: 'Add night',
  removeNight: (night: number) => `Remove night ${night}`,
  airbnb: 'Airbnb',
  kame: (plan: string) => `Kame ${plan}`,
  guestsPay: 'Guests pay',
  fees: 'Fees',
  youGet: 'You get',
  saveLabel: (plan: string) => `You save with Kame ${plan}`,
  perMonth: '/month',
  lowVolumeLabel: (plan: string) => `At this volume, ${plan} costs more by`,
  lowVolumeTip: 'You can start on Free.',
} as const;

/* ---------------------------------------------------------------- *
 * Why direct
 * ---------------------------------------------------------------- */

export type V5HubModuleId = 'calendar' | 'bookings' | 'inbox' | 'money';

export interface V5Channel {
  id: string;
  name: string;
  /** Small line under the name on the channel button. */
  status: string;
  icon: LucideIcon;
  /** Built but not offered to hosts yet. */
  soon?: boolean;
  /** The workspace parts this channel keeps up to date. */
  feeds: V5HubModuleId[];
}

/**
 * Channels connect into one workspace. Claims follow `docs/product-positioning.md`: Airbnb is
 * the only live calendar sync (availability + reservations, not rates, payouts, or messages);
 * Agoda and Booking.com are built but not offered yet, so they read as Soon.
 */
export const v5Channels = {
  /** The newline keeps each sentence on its own line. */
  title: 'Keep every channel.\nRun them from one place.',
  lead: 'Stay on Facebook, Airbnb, and the sites you already use. Kame connects them to stay in sync in one workspace.',
  /** Screen-reader name for the channel picker; not shown. */
  channelsLabel: 'Where guests find you',
  hubName: 'Kame',
  hubLine: 'Kept in sync',
  modules: [
    {
      id: 'calendar',
      name: 'Calendar',
      line: 'One calendar for every channel',
      icon: CalendarDays,
    },
    { id: 'bookings', name: 'Bookings', line: 'Every stay on one board', icon: ClipboardList },
    { id: 'inbox', name: 'Inbox', line: 'Guest chats in one place', icon: MessagesSquare },
    { id: 'money', name: 'Finance', line: 'Income and costs together', icon: Wallet },
  ] as { id: V5HubModuleId; name: string; line: string; icon: LucideIcon }[],
  /** Airbnb first: it is the live sync and the clearest example. */
  defaultChannel: 1,
  channels: [
    {
      id: 'meta',
      name: 'FB, IG, TikTok',
      status: 'Chats and links',
      icon: MessageCircle,
      feeds: ['inbox', 'bookings'],
    },
    {
      id: 'airbnb',
      name: 'Airbnb',
      status: 'Two-way sync',
      icon: Home,
      feeds: ['calendar', 'bookings'],
    },
    {
      id: 'agoda',
      name: 'Agoda',
      status: 'Calendar sync',
      icon: Building2,
      soon: true,
      feeds: ['calendar', 'bookings'],
    },
    {
      id: 'booking',
      name: 'Booking.com',
      status: 'Calendar sync',
      icon: BedDouble,
      soon: true,
      feeds: ['calendar', 'bookings'],
    },
    {
      id: 'direct',
      name: 'Your booking page',
      status: 'Direct',
      icon: Globe,
      feeds: ['calendar', 'bookings', 'inbox', 'money'],
    },
  ] as V5Channel[],
} as const;

/* ---------------------------------------------------------------- *
 * AI jobs
 * ---------------------------------------------------------------- */

export interface V5AiActionMode {
  label: string;
  /** Shown once the host taps this mode. */
  done: string;
}

/**
 * The host's tap. With `alt`, the button label rolls between the two modes (for example Send
 * and Auto-send) to show the host can approve each time or let AI do it.
 */
export interface V5AiAction extends V5AiActionMode {
  alt?: V5AiActionMode;
}

export interface V5AiJob {
  id: string;
  /** Short label on the picker button. */
  label: string;
  /** Feature name in the stage header. */
  name: string;
  icon: LucideIcon;
  pose: KameMascotPose;
  donePose?: KameMascotPose;
  /** One plain line on what this AI job does. */
  summary: string;
  /** What arrives for AI to work on. */
  input: string;
  /** What AI produced. */
  title: string;
  rows: { label: string; value: string }[];
  /** The one tap left for the host. */
  action?: V5AiAction;
  /** Shown instead of an action when nothing waits on the host. */
  handled?: string;
}

/**
 * The AI jobs, each as the same three steps: something comes in, AI does the work, and the
 * host approves (or has nothing to do). Wording follows the approved claim in
 * `docs/product-positioning.md`: AI reviews, drafts, suggests, and prepares; the host decides.
 */
export const v5Ai = {
  title: 'AI-first property management.',
  lead: 'Most of this runs on its own. Anything sensitive, like payments, rates, or posts, waits for your approval.',
  pickerLabel: 'AI jobs',
  steps: { input: 'When', ai: 'AI does', you: 'You' },
  /** Kame's pose once the host approves. */
  donePose: 'v5-ai-done-stamp' as KameMascotPose,
  jobs: [
    {
      id: 'assistant',
      label: 'Assistant',
      name: 'AI assistant',
      icon: Sparkles,
      pose: 'v5-ai-assistant',
      summary: 'Ask in plain words and it makes the change',
      input: 'You ask: Raise December weekends by 10%',
      title: 'Change ready',
      rows: [
        { label: 'Nights', value: '8 weekend nights' },
        { label: 'Rate', value: '₱3,499 to ₱3,849' },
      ],
      action: { label: 'Confirm', done: '8 nights updated' },
    },
    {
      id: 'receptionist',
      label: 'Receptionist',
      name: 'AI receptionist',
      icon: PhoneCall,
      pose: 'v5-ai-receptionist',
      summary: 'Answers guest questions day and night',
      input: 'A guest asks: Where do I park?',
      title: 'Answered from your stay info',
      rows: [
        { label: 'Reply', value: 'Slot B-14. Show your stay pass at the gate.' },
        { label: 'If unsure', value: 'It asks you first' },
      ],
      handled: 'Nothing to do',
    },
    {
      id: 'receipts',
      label: 'Receipts',
      name: 'Receipt check',
      icon: Receipt,
      pose: 'v5-ai-receipts',
      summary: 'Checks each payment receipt against the booking',
      input: 'GCash receipt from Bea',
      title: 'Receipt matches',
      rows: [
        { label: 'Amount', value: '₱10,497, same as the booking' },
        { label: 'Reference', value: 'Found' },
      ],
      action: { label: 'Accept', done: 'Booking accepted' },
    },
    {
      id: 'import',
      label: 'Import',
      name: 'Booking import',
      icon: FileSpreadsheet,
      pose: 'v5-ai-import',
      donePose: 'v5-ai-done-celebrate',
      summary: 'Moves your old bookings in from a sheet',
      input: 'Your booking sheet',
      title: 'Columns mapped',
      rows: [
        { label: 'Found', value: '128 bookings' },
        { label: 'Matched', value: 'Guest, dates, amount' },
      ],
      action: { label: 'Import', done: '128 bookings added' },
    },
    {
      id: 'pricing',
      label: 'Pricing',
      name: 'Smart Pricing',
      icon: TrendingUp,
      pose: 'v5-ai-pricing',
      summary: 'Suggests the right rate for each night',
      input: 'Demand for Saturday, Dec 12',
      title: 'Rate suggested',
      rows: [
        { label: 'Rate', value: '₱3,499 to ₱3,849' },
        { label: 'Why', value: 'Weekend, filling up early' },
      ],
      action: { label: 'Apply', done: 'Rate applied' },
    },
    {
      id: 'analytics',
      label: 'Analytics',
      name: 'Analytics review',
      icon: BarChart3,
      pose: 'v5-ai-analytics',
      summary: 'Explains your numbers in plain words',
      input: 'Your November numbers',
      title: 'Review written',
      rows: [
        { label: 'Occupancy', value: '78%, up 6 points' },
        { label: 'To try', value: 'A midweek deal' },
      ],
      handled: 'Read it when you like',
    },
    {
      id: 'replies',
      label: 'Replies',
      name: 'Reply suggestions',
      icon: MessagesSquare,
      pose: 'v5-ai-replies',
      donePose: 'v5-ai-done-celebrate',
      summary: 'Drafts replies to guest messages',
      input: 'Bea on Messenger: Can we check in at 1 PM?',
      title: 'Reply drafted',
      rows: [
        { label: 'Reply', value: 'Hi Bea! Early check-in at 1 PM works.' },
        { label: 'Auto-reply', value: 'Optional, for usual questions' },
      ],
      action: {
        label: 'Send',
        done: 'Reply sent',
        alt: { label: 'Auto-send', done: 'Auto-send on' },
      },
    },
    {
      id: 'marketing',
      label: 'Marketing',
      name: 'AI posts',
      icon: ImagePlus,
      pose: 'v5-ai-marketing',
      donePose: 'v5-ai-done-celebrate',
      summary: 'Turns your photos into ready posts',
      input: 'Three photos of Unit 12F',
      title: 'Post made',
      rows: [
        { label: 'Caption', value: 'Weekend open at Unit 12F. Book direct.' },
        { label: 'Channels', value: 'Facebook, Instagram' },
      ],
      action: {
        label: 'Approve',
        done: 'Post approved',
        alt: { label: 'Auto-post', done: 'Auto-post on' },
      },
    },
  ] as V5AiJob[],
} as const;

/* ---------------------------------------------------------------- *
 * Workflow (stages and scenes come from the v3 data file)
 * ---------------------------------------------------------------- */

export interface V5WorkflowStage {
  status: string;
  title: string;
  body: string;
  /** The one step that waits for the host. */
  needsYou?: boolean;
}

/** Same order as the v3 scenes, which are picked by index. */
export const v5Workflow = {
  title: 'From booking to checkout, handled.',
  lead: 'Every booking moves through the same six steps. Kame sends the forms, collects the approvals, and emails your guest. You step in once, to accept.',
  stages: [
    {
      status: 'Pending review',
      title: 'Review',
      body: 'Form, ID, and receipt on one card. AI checks the payment. You accept.',
      needsYou: true,
    },
    {
      status: 'Pending documents',
      title: 'Documents',
      body: 'GAF and pet requests go to your building admin. Approved copies come back and attach to the booking.',
    },
    {
      status: 'Ready for check-in',
      title: 'Check-in',
      body: 'The guest gets check-in details and the stay guide, with the approved GAF, parking, and pet forms attached.',
    },
    {
      status: 'Ready for check-out',
      title: 'Stay',
      body: 'Before check-out, the guest gets the checklist and refund form.',
    },
    {
      status: 'Pending SD refund',
      title: 'Deposit',
      body: 'A reminder keeps the deposit refund on time.',
    },
    {
      status: 'Completed',
      title: 'Done',
      body: 'Income posts to finance. The guest gets a review request and a voucher.',
    },
  ] as V5WorkflowStage[],
} as const;

/* ---------------------------------------------------------------- *
 * Guest side
 * ---------------------------------------------------------------- */

export const v5Guests = {
  title: 'What your guests see',
  lead: 'All in the browser. No app to install.',
  screens: [
    { key: 'book', title: 'Book direct', body: 'Pick dates and reserve.' },
    { key: 'guide', title: 'Stay guide', body: 'Wi-Fi, door code, and directions.' },
    { key: 'trip', title: 'Trip page', body: 'Status and a line to you.' },
  ],
} as const;

export interface V5AskQuestion {
  /** Short label on the one-line chip row. */
  chip: string;
  /** What the guest or host typed, shown in the thread. */
  question: string;
  answer: string;
  /** Optional compact list under the answer (name and value). */
  rows?: { label: string; value: string }[];
  /** The safety step: the AI hands off to the host, or waits for the host to confirm. */
  note?: string;
}

export interface V5AskMode {
  id: 'receptionist' | 'assistant';
  label: string;
  icon: LucideIcon;
  placeholder: string;
  noteIcon: LucideIcon;
  questions: V5AskQuestion[];
}

/**
 * Two AI helpers in one window. Claims follow `docs/product-positioning.md`: the receptionist
 * answers supported guest questions and hands the rest to the host; the dashboard assistant
 * answers from live data and asks for Confirm before it changes anything.
 */
export const v5Ask = {
  title: 'Answers for guests.\nAnswers for you.',
  lead: 'The AI receptionist covers the usual guest questions. The dashboard assistant reads your bookings and asks before it changes anything.',
  modesLabel: 'AI helper',
  promptLabel: 'Try a question',
  modes: [
    {
      id: 'receptionist',
      label: 'AI receptionist',
      icon: Headphones,
      placeholder: 'Guest asks about the stay',
      noteIcon: CornerUpRight,
      questions: [
        {
          chip: "What's the Wi-Fi?",
          question: "What's the Wi-Fi?",
          answer: 'Kame_12F, password stay2026.',
        },
        {
          chip: 'Where do I park?',
          question: 'Where do I park?',
          answer: 'Slot B-14. Show your stay pass at the gate.',
        },
        {
          chip: 'Early check-in?',
          question: 'Can we check in early?',
          answer: "I've asked Mika, your host. The reply will show up here.",
          note: 'Sent to host',
        },
      ],
    },
    {
      id: 'assistant',
      label: 'AI assistant',
      icon: Sparkles,
      placeholder: 'Ask about your bookings',
      noteIcon: ShieldCheck,
      questions: [
        {
          chip: 'Check-ins today',
          question: "Who's checking in today?",
          answer: 'Two check-ins today.',
          rows: [
            { label: 'Bea Villareal', value: '12F · 2 PM' },
            { label: 'Carlo Reyes', value: '8B · 3 PM' },
          ],
        },
        {
          chip: 'Occupancy',
          question: "What's my occupancy this month?",
          answer: '78% booked, up 6 points. Two weekends are still open.',
        },
        {
          chip: 'Move a booking',
          question: 'Move Bea to Ready for check-in',
          answer: 'Ready to move Bea Villareal. Her check-in email goes out when you confirm.',
          note: 'Waits for your OK',
        },
      ],
    },
  ] as V5AskMode[],
} as const;

/* ---------------------------------------------------------------- *
 * Tour, setup, FAQ, closing
 * ---------------------------------------------------------------- */

export const v5Tour = {
  title: 'See it all in three minutes',
  lead: 'A narrated dashboard tour of all the features we have',
} as const;

export interface V5SetupStep {
  title: string;
  body: string;
  icon: LucideIcon;
  /** Kame's pose while this step is active. */
  pose: KameMascotPose;
}

export const v5Setup = {
  title: 'Set it up once. Then it runs.',
  lead: 'Four short steps. Start on the free plan, no card needed.',
  steps: [
    {
      title: 'Add your listings',
      body: 'Create a listing, or upload your booking sheet.',
      icon: FileSpreadsheet,
      pose: 'importing',
    },
    {
      title: 'Set your rules',
      body: 'Rates, deposits, and forms.',
      icon: SlidersHorizontal,
      pose: 'workspace-settings',
    },
    {
      title: 'Connect channels',
      body: 'Airbnb, Facebook, Instagram, Telegram.',
      icon: PlugZap,
      pose: 'announcement',
    },
    {
      title: 'Let it run',
      body: 'AI does the routine. You approve.',
      icon: CalendarClock,
      pose: 'beach-chair',
    },
  ] as V5SetupStep[],
} as const;

export const v5Faq = {
  title: 'Clear answers before you start.',
  contact: { label: 'Talk to us', to: '/contact' },
  items: [
    {
      question: 'Does Kame replace Airbnb or my Facebook page?',
      answer:
        'No. Keep them for reach and take direct bookings on your page. On Pro and above, Airbnb bookings sync in. Other channels do not sync yet.',
    },
    {
      question: 'What does it cost?',
      answer:
        'There is a free plan, and no card to start. Paid plans are per property, on one bill. Cancel anytime.',
    },
    {
      question: 'Does Kame take a commission?',
      answer:
        'Not on property bookings with an active plan. Payment and channel fees still apply. Parking is priced separately.',
    },
    {
      question: 'Will AI reply to every guest message?',
      answer:
        'It answers supported questions from your stay info. Anything it is unsure about goes to you. It depends on your plan and setup.',
    },
    {
      question: 'Can I bring my existing bookings?',
      answer: 'Yes. Upload your sheet and AI maps the columns. You review before anything saves.',
    },
    {
      question: 'Can I run it from my phone?',
      answer: 'Yes. The full dashboard works on your phone, and teammates get their own access.',
    },
  ],
} as const;

export const v5Closing = {
  title: 'List your place. Take bookings directly.',
  facts: ['Free to start', 'No card needed', 'Cancel anytime'],
} as const;
