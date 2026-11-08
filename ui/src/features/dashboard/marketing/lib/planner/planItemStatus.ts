/**
 * Planner item status copy and the single next action. Pure, unit-tested.
 * Every string is host-facing: short, plain, no em dash.
 */

export type PlanItemStatus =
  | 'suggested'
  | 'planned'
  | 'preparing'
  | 'ready'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'posted_manually'
  | 'held'
  | 'stale'
  | 'skipped'
  | 'expired'
  | 'failed';

export type PlanItemAction = 'create' | 'review' | 'publish' | 'share' | 'fix' | 'none';

export type PlanItemStatusView = {
  label: string;
  action: PlanItemAction;
  actionLabel: string | null;
  tone: 'neutral' | 'positive' | 'warning' | 'danger';
};

const VIEWS: Record<PlanItemStatus, PlanItemStatusView> = {
  suggested: {
    label: 'Suggested',
    action: 'create',
    actionLabel: 'Create',
    tone: 'neutral',
  },
  planned: { label: 'To do', action: 'create', actionLabel: 'Create', tone: 'neutral' },
  preparing: {
    label: 'Preparing',
    action: 'none',
    actionLabel: null,
    tone: 'neutral',
  },
  ready: { label: 'Ready', action: 'review', actionLabel: 'Review', tone: 'positive' },
  scheduled: {
    label: 'Scheduled',
    action: 'review',
    actionLabel: 'Review',
    tone: 'positive',
  },
  publishing: { label: 'Publishing', action: 'none', actionLabel: null, tone: 'neutral' },
  published: { label: 'Published', action: 'none', actionLabel: null, tone: 'positive' },
  posted_manually: { label: 'Posted', action: 'none', actionLabel: null, tone: 'positive' },
  held: { label: 'On hold', action: 'fix', actionLabel: 'Update', tone: 'warning' },
  stale: { label: 'Needs update', action: 'fix', actionLabel: 'Update', tone: 'warning' },
  skipped: { label: 'Skipped', action: 'none', actionLabel: null, tone: 'neutral' },
  expired: { label: 'Missed', action: 'none', actionLabel: null, tone: 'neutral' },
  failed: { label: 'Failed', action: 'fix', actionLabel: 'Retry', tone: 'danger' },
};

export function planItemStatusView(status: string): PlanItemStatusView {
  return VIEWS[status as PlanItemStatus] ?? VIEWS.planned;
}

export function isOpenStatus(status: string): boolean {
  return !['published', 'posted_manually', 'skipped', 'expired'].includes(status);
}

export const FORMAT_LABELS: Record<string, string> = {
  post: 'Post',
  carousel: 'Carousel',
  story: 'Story',
  reel: 'Reel',
  calendar: 'Calendar',
};

export function formatLabel(format: string): string {
  return FORMAT_LABELS[format] ?? 'Post';
}

export const CHANNEL_LABELS: Record<string, string> = {
  facebook_page: 'Facebook',
  instagram: 'Instagram',
  facebook_group: 'Facebook groups',
  tiktok: 'TikTok',
  messenger: 'Messenger',
  viber: 'Viber',
  whatsapp: 'WhatsApp',
  google_business: 'Google Business',
  other: 'Other',
};

export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? 'Another channel';
}

/** Manual channels cannot be published to from the app. */
export function isManualChannel(channel: string): boolean {
  return !['facebook_page', 'instagram'].includes(channel);
}
