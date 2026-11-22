/**
 * Planner item status copy and the single next action. Pure, unit-tested.
 * Host-facing labels stay short. Internal status keys stay full for the API.
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

/** Collapsed host lifecycle for progress and filters. */
export type PlanItemHostPhase = 'todo' | 'doing' | 'done' | 'blocked' | 'missed' | 'skipped';

export type PlanItemStatusView = {
  label: string;
  action: PlanItemAction;
  actionLabel: string | null;
  tone: 'neutral' | 'positive' | 'warning' | 'danger';
  phase: PlanItemHostPhase;
};

const VIEWS: Record<PlanItemStatus, PlanItemStatusView> = {
  suggested: {
    label: 'To do',
    action: 'create',
    actionLabel: 'Make this',
    tone: 'neutral',
    phase: 'todo',
  },
  planned: {
    label: 'To do',
    action: 'create',
    actionLabel: 'Make this',
    tone: 'neutral',
    phase: 'todo',
  },
  preparing: {
    label: 'In progress',
    action: 'review',
    actionLabel: 'Continue',
    tone: 'neutral',
    phase: 'doing',
  },
  ready: {
    label: 'Ready',
    action: 'review',
    actionLabel: 'Open',
    tone: 'positive',
    phase: 'doing',
  },
  // Meta schedule/publish is not host-ready yet; keep API keys but show a calm label.
  scheduled: {
    label: 'Ready',
    action: 'review',
    actionLabel: 'Open',
    tone: 'positive',
    phase: 'doing',
  },
  publishing: {
    label: 'In progress',
    action: 'none',
    actionLabel: null,
    tone: 'neutral',
    phase: 'doing',
  },
  published: {
    label: 'Done',
    action: 'none',
    actionLabel: null,
    tone: 'positive',
    phase: 'done',
  },
  posted_manually: {
    label: 'Done',
    action: 'none',
    actionLabel: null,
    tone: 'positive',
    phase: 'done',
  },
  held: {
    label: 'Needs update',
    action: 'fix',
    actionLabel: 'Update',
    tone: 'warning',
    phase: 'blocked',
  },
  stale: {
    label: 'Needs update',
    action: 'fix',
    actionLabel: 'Update',
    tone: 'warning',
    phase: 'blocked',
  },
  skipped: {
    label: 'Skipped',
    action: 'none',
    actionLabel: null,
    tone: 'neutral',
    phase: 'skipped',
  },
  expired: {
    label: 'Missed',
    action: 'create',
    actionLabel: 'Make this',
    tone: 'neutral',
    phase: 'missed',
  },
  failed: {
    label: 'Needs update',
    action: 'fix',
    actionLabel: 'Retry',
    tone: 'danger',
    phase: 'blocked',
  },
};

export function planItemStatusView(status: string): PlanItemStatusView {
  return VIEWS[status as PlanItemStatus] ?? VIEWS.planned;
}

export function isOpenStatus(status: string): boolean {
  return !['published', 'posted_manually', 'skipped', 'expired'].includes(status);
}

export function planItemHostPhase(status: string): PlanItemHostPhase {
  return planItemStatusView(status).phase;
}

/** Done count for the Suggest → Make → Share loop. */
export function countPlanProgress(items: ReadonlyArray<{ status: string }>): {
  done: number;
  open: number;
  total: number;
} {
  let done = 0;
  let open = 0;
  for (const item of items) {
    const phase = planItemHostPhase(item.status);
    if (phase === 'done') done += 1;
    else if (phase !== 'skipped') open += 1;
  }
  return { done, open, total: done + open };
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
