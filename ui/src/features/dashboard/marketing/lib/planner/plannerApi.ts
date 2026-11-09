/**
 * Marketing Planner client API. Thin fetch wrapper around the `marketing-planner`
 * edge function; no state lives here.
 */

import { parseEdgeJsonOrQuota } from '@/features/dashboard/org/lib/aiQuotaToast';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';
import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import type { PlannerRange } from '@/features/dashboard/marketing/lib/planner/plannerRange';

export type PlannerClaimsDto = {
  openNights?: string[];
  nightsLeftInMonth?: number;
  rateFrom?: number;
  rating?: { avg: number; count: number };
  reviewId?: string;
  fullyBookedWindow?: { from: string; to: string };
};

export type PlannerBriefDto = {
  hook?: string;
  message?: string;
  cta?: string;
  why?: string;
};

export type PlannerItemDto = {
  id: string;
  shortCode: string;
  opportunityType: string | null;
  title: string;
  pillar: string | null;
  channelKind: string;
  manualTargets: string[];
  format: string;
  scheduledFor: string | null;
  postBy: string | null;
  targetFrom: string | null;
  targetTo: string | null;
  claims: PlannerClaimsDto;
  brief: PlannerBriefDto;
  status: string;
  statusReason: string | null;
  trackedUrl: string | null;
  postedUrl: string | null;
  trackedVisits: number;
};

export type PlannerPlanDto = {
  id: string;
  horizonStart: string;
  horizonEnd: string;
  mode: string;
  summary: string | null;
  createdAt: string;
};

export type PlannerPlanResponse = {
  range: PlannerRange;
  from: string;
  to: string;
  plan: PlannerPlanDto | null;
  items: PlannerItemDto[];
  summary: string | null;
};

type RawItem = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableStr(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function mapItem(row: RawItem): PlannerItemDto {
  return {
    id: str(row.id),
    shortCode: str(row.short_code),
    opportunityType: nullableStr(row.opportunity_type),
    title: str(row.title),
    pillar: nullableStr(row.pillar),
    channelKind: str(row.channel_kind),
    manualTargets: Array.isArray(row.manual_targets)
      ? (row.manual_targets as unknown[]).filter((item): item is string => typeof item === 'string')
      : [],
    format: str(row.format) || 'post',
    scheduledFor: nullableStr(row.scheduled_for),
    postBy: nullableStr(row.post_by),
    targetFrom: nullableStr(row.target_from),
    targetTo: nullableStr(row.target_to),
    claims: (row.claims && typeof row.claims === 'object' ? row.claims : {}) as PlannerClaimsDto,
    brief: (row.brief && typeof row.brief === 'object' ? row.brief : {}) as PlannerBriefDto,
    status: str(row.status) || 'planned',
    statusReason: nullableStr(row.status_reason),
    trackedUrl: nullableStr(row.tracked_url),
    postedUrl: nullableStr(row.posted_url),
    trackedVisits:
      row.results && typeof row.results === 'object'
        ? Number((row.results as Record<string, unknown>).trackedVisits ?? 0) || 0
        : 0,
  };
}

function mapPlan(row: RawItem | null | undefined): PlannerPlanDto | null {
  if (!row || typeof row !== 'object') return null;
  return {
    id: str(row.id),
    horizonStart: str(row.horizon_start),
    horizonEnd: str(row.horizon_end),
    mode: str(row.mode) || 'rules',
    summary: nullableStr(row.summary),
    createdAt: str(row.created_at),
  };
}

async function authorizedFetch(path: string, propertyId: string | null, init: RequestInit) {
  const jwt = await getSessionJwt();
  const url = new URL(scopedFunctionsUrl(path, propertyId));
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

export async function fetchMarketingPlan(
  propertyId: string | null,
  range: PlannerRange
): Promise<PlannerPlanResponse> {
  const res = await authorizedFetch(`marketing-planner?range=${range}`, propertyId, {
    method: 'GET',
  });
  const data = await parseEdgeJsonOrQuota<{
    range?: string;
    from: string;
    to: string;
    plan?: RawItem | null;
    items?: RawItem[];
    summary?: string | null;
  }>(res);
  return {
    range,
    from: data.from,
    to: data.to,
    plan: mapPlan(data.plan),
    items: (data.items ?? []).map(mapItem),
    summary: data.summary ?? null,
  };
}

export async function generateMarketingPlan(propertyId: string | null): Promise<{
  created: number;
  skipped: number;
}> {
  const res = await authorizedFetch('marketing-planner', propertyId, {
    method: 'POST',
    body: JSON.stringify({ action: 'generate', mode: 'rules' }),
  });
  const data = await parseEdgeJsonOrQuota<{ created: number; skipped: number }>(res);
  return { created: data.created ?? 0, skipped: data.skipped ?? 0 };
}

export async function updatePlannerItem(
  propertyId: string | null,
  input: {
    itemId: string;
    scheduledFor?: string;
    format?: string;
    title?: string;
    brief?: Record<string, unknown>;
  }
): Promise<void> {
  const res = await authorizedFetch('marketing-planner', propertyId, {
    method: 'POST',
    body: JSON.stringify({ action: 'update_item', ...input }),
  });
  await parseEdgeJsonOrQuota(res);
}

export async function skipPlannerItem(
  propertyId: string | null,
  itemId: string,
  reason: string
): Promise<void> {
  const res = await authorizedFetch('marketing-planner', propertyId, {
    method: 'POST',
    body: JSON.stringify({ action: 'skip', itemId, reason }),
  });
  await parseEdgeJsonOrQuota(res);
}

export type RefreshInstruction = 'shorter' | 'playful' | 'taglish';

export async function refreshPlannerBrief(
  propertyId: string | null,
  itemId: string,
  instruction: RefreshInstruction
): Promise<PlannerItemDto> {
  const res = await authorizedFetch('marketing-planner', propertyId, {
    method: 'POST',
    body: JSON.stringify({ action: 'refresh_brief', itemId, instruction }),
  });
  const data = await parseEdgeJsonOrQuota<{ item: RawItem }>(res);
  return mapItem(data.item);
}

export async function markPlannerItemPosted(
  propertyId: string | null,
  itemId: string,
  postedUrl?: string
): Promise<void> {
  const res = await authorizedFetch('marketing-planner', propertyId, {
    method: 'POST',
    body: JSON.stringify({ action: 'mark_posted', itemId, postedUrl }),
  });
  await parseEdgeJsonOrQuota(res);
}

export type PlannerSettingsDto = {
  propertyId: string;
  goals: string[];
  cadencePreset: string;
  channels: unknown[];
  language: string;
  onboardedAt: string | null;
};

export async function fetchPlannerSettings(
  propertyId: string | null
): Promise<PlannerSettingsDto | null> {
  const res = await authorizedFetch('marketing-planner?view=settings', propertyId, {
    method: 'GET',
  });
  const data = await parseEdgeJsonOrQuota<{ settings: RawItem | null }>(res);
  if (!data.settings) return null;
  const row = data.settings;
  return {
    propertyId: str(row.property_id),
    goals: Array.isArray(row.goals)
      ? (row.goals as unknown[]).filter((item): item is string => typeof item === 'string')
      : [],
    cadencePreset: str(row.cadence_preset) || 'steady',
    channels: Array.isArray(row.channels) ? row.channels : [],
    language: str(row.language) || 'en',
    onboardedAt: nullableStr(row.onboarded_at),
  };
}

export async function savePlannerSettings(
  propertyId: string | null,
  patch: Record<string, unknown>
): Promise<void> {
  const res = await authorizedFetch('marketing-planner', propertyId, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  await parseEdgeJsonOrQuota(res);
}
