/**
 * Per-property document requirement lists for PENDING_DOCUMENTS sub-steps.
 * Override on app_settings; residence-type default on developments.settings.workflowDefaults.
 */

import { createClient } from './supabaseJs.ts';
import { trimOrEmpty } from './stringUtils.ts';

export type DocumentApprovalSource = 'manual' | 'email-listener' | 'none';
export type DocumentTriggerCondition = 'always' | 'has_pets' | 'need_parking';

export type DocumentRequirement = {
  id: string;
  label: string;
  order: number;
  pdfTemplateId: string | null;
  approvalSource: DocumentApprovalSource;
  triggerCondition: DocumentTriggerCondition;
  calendarIcon: string | null;
};

export type DocumentRequirementCompletion = {
  completedAt: string | null;
  approvedPdfUrl: string | null;
  /** Host rejected the received file. Cleared when a new file is accepted. */
  rejectedAt?: string | null;
  rejectedReason?: string | null;
  rejectedNote?: string | null;
  rejectedBy?: string | null;
};

/** Reasons offered when a host rejects an approved GAF / pet file. */
export const DOC_REJECTION_REASON_IDS = [
  'wrong_document',
  'wrong_guest',
  'wrong_unit',
  'expired',
  'unreadable',
  'other',
] as const;

export type DocRejectionReason = (typeof DOC_REJECTION_REASON_IDS)[number];

export function parseDocRejectionReason(value: unknown): DocRejectionReason {
  const raw = String(value ?? '').trim();
  if ((DOC_REJECTION_REASON_IDS as readonly string[]).includes(raw)) {
    return raw as DocRejectionReason;
  }
  throw new Error('Select a rejection reason');
}

const APPROVAL_SOURCES: DocumentApprovalSource[] = ['manual', 'email-listener', 'none'];
const TRIGGER_CONDITIONS: DocumentTriggerCondition[] = ['always', 'has_pets', 'need_parking'];

export const DEFAULT_DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  {
    id: 'gaf',
    label: 'GAF Request',
    order: 1,
    pdfTemplateId: 'gaf',
    approvalSource: 'email-listener',
    triggerCondition: 'always',
    calendarIcon: null,
  },
  {
    id: 'pet',
    label: 'Pet Approval',
    order: 2,
    pdfTemplateId: 'pet',
    approvalSource: 'email-listener',
    triggerCondition: 'has_pets',
    calendarIcon: '🐶',
  },
];

function isApprovalSource(value: unknown): value is DocumentApprovalSource {
  return typeof value === 'string' && APPROVAL_SOURCES.includes(value as DocumentApprovalSource);
}

function isTriggerCondition(value: unknown): value is DocumentTriggerCondition {
  return (
    typeof value === 'string' && TRIGGER_CONDITIONS.includes(value as DocumentTriggerCondition)
  );
}

function parseOptionalStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : null;
}

function parseRequirementEntry(raw: unknown): DocumentRequirement | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;

  const id = typeof entry.id === 'string' ? entry.id.trim() : '';
  if (!id) return null;

  const label = typeof entry.label === 'string' ? entry.label.trim() : '';
  if (!label) return null;

  const order =
    typeof entry.order === 'number' && Number.isFinite(entry.order) ? entry.order : null;
  if (order === null) return null;

  if (!isApprovalSource(entry.approvalSource)) return null;
  if (!isTriggerCondition(entry.triggerCondition)) return null;

  return {
    id,
    label,
    order,
    pdfTemplateId: parseOptionalStringOrNull(entry.pdfTemplateId),
    approvalSource: entry.approvalSource,
    triggerCondition: entry.triggerCondition,
    calendarIcon: parseOptionalStringOrNull(entry.calendarIcon),
  };
}

export function parseDocumentRequirements(raw: unknown): DocumentRequirement[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .map(parseRequirementEntry)
    .filter((req): req is DocumentRequirement => req !== null)
    .sort((a, b) => a.order - b.order);
}

/**
 * A residence with no explicit list has no building approval steps. Never falls back to
 * Azure's GAF and pet steps: a new residence must not inherit another building's rules.
 * Existing rows keep their list from the development record (Phase 0 seeded it).
 */
export function mergeDocumentRequirements(raw: unknown): DocumentRequirement[] {
  if (raw === null || raw === undefined) return [];
  return parseDocumentRequirements(raw) ?? [];
}

function bookingFlagTrue(value: unknown): boolean {
  return value === true || value === 'true';
}

export function requirementApplies(
  req: DocumentRequirement,
  booking: { has_pets?: unknown; need_parking?: unknown }
): boolean {
  switch (req.triggerCondition) {
    case 'always':
      return true;
    case 'has_pets':
      return bookingFlagTrue(booking.has_pets);
    case 'need_parking':
      return bookingFlagTrue(booking.need_parking);
    default:
      return false;
  }
}

export type RequestPdfTemplateId = 'gaf' | 'pet';

export function requirementMatchesPdfTemplate(
  req: DocumentRequirement,
  templateId: RequestPdfTemplateId
): boolean {
  return req.pdfTemplateId === templateId || req.id === templateId;
}

/** True when an applicable requirement uses the GAF or pet PDF template (id or pdfTemplateId). */
export function hasApplicableDocumentPdfTemplate(
  requirements: DocumentRequirement[],
  booking: { has_pets?: unknown; need_parking?: unknown },
  templateId: RequestPdfTemplateId
): boolean {
  return requirements.some(
    (req) => requirementApplies(req, booking) && requirementMatchesPdfTemplate(req, templateId)
  );
}

export type RequirementDocKind = 'gaf' | 'pet' | 'other';

export function requirementDocKind(
  requirement: DocumentRequirement | undefined,
  sub?: string
): RequirementDocKind {
  const subKey = (sub ?? requirement?.id ?? '').trim().toLowerCase();
  if (subKey === 'gaf' || subKey === 'pending_gaf') return 'gaf';
  if (subKey === 'pet' || subKey === 'pending_pet_request') return 'pet';
  if (!requirement) return 'other';
  if (requirementMatchesPdfTemplate(requirement, 'gaf')) return 'gaf';
  if (requirementMatchesPdfTemplate(requirement, 'pet')) return 'pet';
  const label = requirement.label.trim().toLowerCase();
  if (label.includes('gaf')) return 'gaf';
  if (label.includes('pet')) return 'pet';
  return 'other';
}

/** GAF/pet substeps need an approved PDF on file before mark-complete or proceed. */
export function requirementNeedsApprovedPdf(req: DocumentRequirement): boolean {
  return requirementDocKind(req) !== 'other';
}

async function loadDocumentRequirementsOverride(propertyId: string): Promise<unknown> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const { data, error } = await supabase
    .from('app_settings')
    .select('document_requirements_override')
    .eq('property_id', propertyId)
    .maybeSingle();

  if (error) {
    console.warn('[documentRequirements] override load failed:', error.message);
    return null;
  }

  return data?.document_requirements_override ?? null;
}

type RequirementSourceLoad<T> = { ok: true; value: T } | { ok: false; message: string };

async function loadPropertyResidenceName(
  propertyId: string
): Promise<RequirementSourceLoad<string>> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const { data, error } = await supabase
    .from('properties')
    .select('residence_name')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) {
    console.warn('[documentRequirements] residence load failed:', error.message);
    return { ok: false, message: error.message };
  }

  return { ok: true, value: trimOrEmpty(data?.residence_name as string | null | undefined) };
}

/**
 * `ok: true, value: undefined` means the residence simply has no list (not an error).
 * `ok: false` means the read failed and the caller must not treat it as "no steps".
 */
async function loadDevelopmentDocumentRequirements(
  residenceName: string
): Promise<RequirementSourceLoad<unknown>> {
  const name = trimOrEmpty(residenceName);
  if (!name) return { ok: true, value: undefined };

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const { data, error } = await supabase
    .from('developments')
    .select('settings')
    .eq('name', name)
    .maybeSingle();

  if (error) {
    console.warn('[documentRequirements] development load failed:', error.message);
    return { ok: false, message: error.message };
  }

  const settings = data?.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { ok: true, value: undefined };
  }

  const workflowDefaults = (settings as Record<string, unknown>).workflowDefaults;
  if (
    !workflowDefaults ||
    typeof workflowDefaults !== 'object' ||
    Array.isArray(workflowDefaults)
  ) {
    return { ok: true, value: undefined };
  }

  return { ok: true, value: (workflowDefaults as Record<string, unknown>).documentRequirements };
}

/**
 * Residence default — ignores the per-property override.
 *
 * No list means no building approval steps. A read error throws so a transition fails and
 * retries instead of silently skipping a live booking's GAF.
 */
export async function resolveResidenceDefaultDocumentRequirements(
  propertyId: string
): Promise<DocumentRequirement[]> {
  const residence = await loadPropertyResidenceName(propertyId);
  if (!residence.ok) {
    throw new Error("Could not load this property's residence. Try again.");
  }

  const development = await loadDevelopmentDocumentRequirements(residence.value);
  if (!development.ok) {
    throw new Error("Could not load this residence's approval steps. Try again.");
  }

  return mergeDocumentRequirements(development.value);
}

export async function resolveDocumentRequirements(
  propertyId: string
): Promise<DocumentRequirement[]> {
  const override = await loadDocumentRequirementsOverride(propertyId);
  if (override !== null && override !== undefined && Array.isArray(override)) {
    const parsed = parseDocumentRequirements(override);
    return parsed ?? [];
  }

  return resolveResidenceDefaultDocumentRequirements(propertyId);
}
