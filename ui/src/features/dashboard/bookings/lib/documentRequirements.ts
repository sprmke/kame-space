/**
 * Client mirror of `supabase/functions/_shared/documentRequirements.ts` (types, parser and
 * helpers). No async resolve here: the UI receives the resolved list from the payload.
 *
 * ⚠️ Keep in sync with the server file when either changes.
 */

export type DocumentApprovalSource = 'manual' | 'email-listener' | 'none';
export type DocumentTriggerCondition = 'always' | 'has_pets' | 'need_parking';

/** Display strings for one step. A residence may relabel any of them. */
export type DocumentRequirementLabels = {
  /** Host rail: "GAF Request". */
  step: string;
  /** Chips, calendar and email subject: "GAF". */
  short: string;
  /** Guest-facing: "Guest Advise Form". */
  guest: string;
  /** Stay guide: "Approved GAF". */
  approved: string;
};

/** What the step produces. `none` is a checklist tick only. */
export type DocumentRequirementOutput =
  | { type: 'none' }
  | { type: 'generated_pdf'; pdfTemplateId: string };

/**
 * A booking approval step (Document Requirements v2).
 *
 * Behavior comes from fields, never from the id or the label (F4). `legacyKind` is the one
 * place the old names survive: it only drives the dual-write to `gaf_*` / `pet_*` columns
 * for Azure's two steps, which keep their historical ids.
 *
 * The v1 fields (`label`, `pdfTemplateId`, `approvalSource`) stay on the type as aliases the
 * parser derives from the v2 fields, so stored rows and every existing caller keep working.
 */
export type DocumentRequirement = {
  id: string;
  order: number;
  /** Retired steps stay in the list but never apply to a booking. */
  active: boolean;
  /** A step that blocks check-in must be complete before READY_FOR_CHECKIN. */
  blocksCheckIn: boolean;
  triggerCondition: DocumentTriggerCondition;
  labels: DocumentRequirementLabels;
  output: DocumentRequirementOutput;
  approval: {
    source: DocumentApprovalSource;
    /** Needs an approved file on record before the step can be completed. */
    requiresApprovedFile: boolean;
  };
  calendarIcon: string | null;
  legacyKind: 'gaf' | 'pet' | null;

  /** @deprecated v1 alias of `labels.step`, derived by the parser. */
  label: string;
  /** @deprecated v1 alias of `output.pdfTemplateId`, derived by the parser. */
  pdfTemplateId: string | null;
  /** @deprecated v1 alias of `approval.source`, derived by the parser. */
  approvalSource: DocumentApprovalSource;
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
  buildDocumentRequirement({
    id: 'gaf',
    label: 'GAF Request',
    order: 1,
    pdfTemplateId: 'gaf',
    approvalSource: 'email-listener',
    triggerCondition: 'always',
    calendarIcon: null,
  }),
  buildDocumentRequirement({
    id: 'pet',
    label: 'Pet Approval',
    order: 2,
    pdfTemplateId: 'pet',
    approvalSource: 'email-listener',
    triggerCondition: 'has_pets',
    calendarIcon: '🐶',
  }),
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

function stripRequestSuffix(value: string): string {
  return value.replace(/\s*(request|approval)\s*$/i, '').trim();
}

/**
 * Labels a v1 row implies. Azure's two steps keep their exact strings; anything else is
 * derived from its label, which is what the UI rendered before the v2 model existed.
 */
function deriveLabels(id: string, label: string): DocumentRequirementLabels {
  if (id === 'gaf') {
    return { step: label, short: 'GAF', guest: 'Guest Advise Form', approved: 'Approved GAF' };
  }
  if (id === 'pet') {
    return {
      step: label,
      short: 'Pet',
      guest: 'Pet registration form',
      approved: 'Approved pet form',
    };
  }
  const short = stripRequestSuffix(label) || label;
  return { step: label, short, guest: label, approved: short };
}

function parseLabels(raw: unknown, id: string, label: string): DocumentRequirementLabels {
  const derived = deriveLabels(id, label);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return derived;
  const record = raw as Record<string, unknown>;
  const read = (key: keyof DocumentRequirementLabels): string => {
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value.trim() : derived[key];
  };
  return {
    step: read('step'),
    short: read('short'),
    guest: read('guest'),
    approved: read('approved'),
  };
}

function parseOutput(raw: unknown, pdfTemplateId: string | null): DocumentRequirementOutput {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    if (record.type === 'none') return { type: 'none' };
    if (record.type === 'generated_pdf') {
      const templateId = typeof record.pdfTemplateId === 'string' ? record.pdfTemplateId.trim() : '';
      if (templateId) return { type: 'generated_pdf', pdfTemplateId: templateId };
    }
  }
  return pdfTemplateId
    ? { type: 'generated_pdf', pdfTemplateId }
    : { type: 'none' };
}

function parseLegacyKind(raw: unknown, id: string): 'gaf' | 'pet' | null {
  if (raw === 'gaf' || raw === 'pet') return raw;
  // Only the historical ids dual-write the `gaf_*` / `pet_*` columns. A custom step that
  // happens to use the GAF template is not the GAF step.
  if (id === 'gaf' || id === 'pet') return id;
  return null;
}

function parseApproval(
  raw: unknown,
  approvalSource: DocumentApprovalSource,
  legacyKind: 'gaf' | 'pet' | null
): DocumentRequirement['approval'] {
  const fallback = { source: approvalSource, requiresApprovedFile: legacyKind !== null };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
  const record = raw as Record<string, unknown>;
  return {
    source: isApprovalSource(record.source) ? record.source : fallback.source,
    requiresApprovedFile:
      typeof record.requiresApprovedFile === 'boolean'
        ? record.requiresApprovedFile
        : fallback.requiresApprovedFile,
  };
}

/**
 * Build a requirement from either shape. Total: v1 input upgrades in memory, v2 passes
 * through. Exported so callers that construct a step (the editor's "Add step") get the
 * derived fields without hand-writing them.
 */
export function buildDocumentRequirement(input: {
  id: string;
  label: string;
  order: number;
  pdfTemplateId: string | null;
  approvalSource: DocumentApprovalSource;
  triggerCondition: DocumentTriggerCondition;
  calendarIcon: string | null;
  active?: boolean;
  blocksCheckIn?: boolean;
  labels?: DocumentRequirementLabels;
  output?: DocumentRequirementOutput;
  approval?: DocumentRequirement['approval'];
  legacyKind?: 'gaf' | 'pet' | null;
}): DocumentRequirement {
  const legacyKind = input.legacyKind ?? parseLegacyKind(undefined, input.id);
  const labels = input.labels ?? deriveLabels(input.id, input.label);
  const output = input.output ?? parseOutput({ pdfTemplateId: input.pdfTemplateId }, input.pdfTemplateId);
  const approval =
    input.approval ?? parseApproval(undefined, input.approvalSource, legacyKind);

  return {
    id: input.id,
    order: input.order,
    active: input.active ?? true,
    blocksCheckIn: input.blocksCheckIn ?? true,
    triggerCondition: input.triggerCondition,
    labels,
    output,
    approval,
    calendarIcon: input.calendarIcon,
    legacyKind,
    // v1 aliases
    label: labels.step,
    pdfTemplateId: output.type === 'generated_pdf' ? output.pdfTemplateId : null,
    approvalSource: approval.source,
  };
}

function parseRequirementEntry(raw: unknown): DocumentRequirement | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;

  const id = typeof entry.id === 'string' ? entry.id.trim() : '';
  if (!id) return null;

  const label = typeof entry.label === 'string' ? entry.label.trim() : '';
  // A v2 row may only carry `labels`.
  const v2Labels = entry.labels;
  const stepFromLabels =
    v2Labels && typeof v2Labels === 'object' && !Array.isArray(v2Labels)
      ? String((v2Labels as Record<string, unknown>).step ?? '').trim()
      : '';
  const resolvedLabel = label || stepFromLabels;
  if (!resolvedLabel) return null;

  const order =
    typeof entry.order === 'number' && Number.isFinite(entry.order) ? entry.order : null;
  if (order === null) return null;

  if (!isApprovalSource(entry.approvalSource)) {
    const v2Source =
      entry.approval && typeof entry.approval === 'object' && !Array.isArray(entry.approval)
        ? (entry.approval as Record<string, unknown>).source
        : undefined;
    if (!isApprovalSource(v2Source)) return null;
    entry.approvalSource = v2Source;
  }
  if (!isTriggerCondition(entry.triggerCondition)) return null;

  const pdfTemplateId = parseOptionalStringOrNull(entry.pdfTemplateId);
  const legacyKind = parseLegacyKind(entry.legacyKind, id);

  return buildDocumentRequirement({
    id,
    label: resolvedLabel,
    order,
    pdfTemplateId,
    approvalSource: entry.approvalSource as DocumentApprovalSource,
    triggerCondition: entry.triggerCondition,
    calendarIcon: parseOptionalStringOrNull(entry.calendarIcon),
    active: entry.active === false ? false : true,
    blocksCheckIn: entry.blocksCheckIn === false ? false : true,
    labels: parseLabels(v2Labels, id, resolvedLabel),
    output: parseOutput(entry.output, pdfTemplateId),
    approval: parseApproval(entry.approval, entry.approvalSource as DocumentApprovalSource, legacyKind),
    legacyKind,
  });
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
  if (!req.active) return false;
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

/** True when this step generates the given request PDF. */
export function requirementMatchesPdfTemplate(
  req: DocumentRequirement,
  templateId: RequestPdfTemplateId
): boolean {
  if (req.output.type === 'generated_pdf' && req.output.pdfTemplateId === templateId) return true;
  // Azure's two steps keep their historical ids, so the id still identifies the template.
  return req.legacyKind === templateId;
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

/**
 * Which historical document this step is, for the `gaf_*` / `pet_*` dual-write and the
 * legacy nested status ids. Reads `legacyKind` only: a step is never classified from its
 * label or from a coincidentally matching PDF template (F4).
 */
export function requirementDocKind(
  requirement: DocumentRequirement | undefined,
  sub?: string
): RequirementDocKind {
  const subKey = (sub ?? requirement?.id ?? '').trim().toLowerCase();
  if (subKey === 'gaf' || subKey === 'pending_gaf') return 'gaf';
  if (subKey === 'pet' || subKey === 'pending_pet_request') return 'pet';
  return requirement?.legacyKind ?? 'other';
}

/** GAF/pet substeps need an approved PDF on file before mark-complete or proceed. */
export function requirementNeedsApprovedPdf(req: DocumentRequirement): boolean {
  return req.approval.requiresApprovedFile;
}
