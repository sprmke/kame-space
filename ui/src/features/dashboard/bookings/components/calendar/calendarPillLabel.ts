import { formatMoneyCompact } from '@/utils/format/currency';

/** How much identity text a stay bar can carry without ellipsis. */
export type OccupancyPillLabelMode = 'full' | 'first' | 'initials' | 'single';

/**
 * Approximate character budget for a month-grid stay bar.
 * Phone cells are tighter; longer spans unlock more text.
 */
export function occupancyPillCharBudget(opts: {
  isBelowLg: boolean;
  /** Inclusive column count for this week fragment (1–7). */
  spanCols: number;
}): number {
  const cols = Math.max(1, Math.min(7, Math.floor(opts.spanCols)));

  if (opts.isBelowLg) {
    // ~50px cells at 375px. 1–2 cols fit two initials once the status dot is dropped.
    if (cols <= 2) return 2;
    if (cols === 3) return 5;
    if (cols === 4) return 8;
    return 4 + cols * 2;
  }

  // lg+ month cells are wider (still no ellipsis — pick a mode that fits).
  // Dashboard mini uses the same viewport budget — mini ≠ phone-narrow.
  if (cols === 1) return 3;
  if (cols === 2) return 5;
  if (cols === 3) return 8;
  if (cols === 4) return 12;
  return 10 + cols;
}

/**
 * Pick the richest identity that fits the bar: full name → first name →
 * two-letter initials → single letter.
 */
export function resolveOccupancyPillLabelMode(opts: {
  isBelowLg: boolean;
  spanCols: number;
  label: string;
  kind: 'name' | 'price';
}): OccupancyPillLabelMode {
  // Price uses resolveOccupancyPricePillPresentation — this path is name-only.
  if (opts.kind === 'price') return 'full';

  const full = opts.label.trim();
  if (!full) return 'single';

  const budget = occupancyPillCharBudget({
    isBelowLg: opts.isBelowLg,
    spanCols: opts.spanCols,
  });
  const first = guestFirstName(full);

  if (full.length <= budget) return 'full';
  if (first.length <= budget) return 'first';
  if (budget >= 2) return 'initials';
  return 'single';
}

export function guestFirstName(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  return parts[0] || label.trim() || 'Guest';
}

/** Two-letter identity for narrow stay bars (never an ellipsis). */
export function guestInitials(label: string): string {
  const cleaned = label.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0];
    const b = parts[1]?.[0];
    if (a && b) return `${a}${b}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

/** Single letter for very narrow phone cells. */
export function guestSingleInitial(label: string): string {
  const cleaned = label.trim();
  if (!cleaned) return '?';
  return cleaned[0]!.toUpperCase();
}

export function occupancyPillDisplayLabel(
  label: string,
  mode: OccupancyPillLabelMode
): string | null {
  const cleaned = label.trim();
  if (!cleaned) return null;
  if (mode === 'full') return cleaned;
  if (mode === 'first') return guestFirstName(cleaned);
  if (mode === 'initials') return guestInitials(cleaned);
  return guestSingleInitial(cleaned);
}

/**
 * Keep the status dot unless the bar is already on initials/single and the
 * viewport is phone-narrow with no spare character for the dot.
 * Mini/compact is layout density only — width comes from `isBelowLg`.
 */
export function occupancyPillShowStatusDot(opts: {
  isBelowLg: boolean;
  spanCols: number;
  labelMode: OccupancyPillLabelMode;
}): boolean {
  if (opts.labelMode !== 'initials' && opts.labelMode !== 'single') return true;
  if (!opts.isBelowLg) return true;

  const budget = occupancyPillCharBudget({
    isBelowLg: true,
    spanCols: opts.spanCols,
  });
  const labelChars = opts.labelMode === 'initials' ? 2 : 1;
  // Dot ≈ 1 character; only drop it when text already fills the budget.
  return budget > labelChars;
}

/** Thousands shorthand without currency: 7000 → 7k, 10500 → 10.5k. */
export function formatOccupancyPillAmountK(amount: number): string {
  const abs = Math.abs(amount);
  if (abs < 1000) {
    return String(Math.round(amount));
  }
  const thousands = amount / 1000;
  const rounded = Math.round(thousands * 10) / 10;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(/\.0$/, '');
  return `${text}k`;
}

export type OccupancyPricePillPresentation = {
  label: string | null;
  showStatusDot: boolean;
};

/**
 * Price ladder for month-grid stay bars (never ellipsis):
 * ₱7,000 → ₱7k → 7k (with dot) → 7k (no dot) → hidden on the tightest phone cells.
 *
 * Width comes from `isBelowLg` only. Dashboard mini is often wide on desktop;
 * `compact` must not force the phone ladder.
 */
export function resolveOccupancyPricePillPresentation(opts: {
  isBelowLg: boolean;
  spanCols: number;
  amount: number | null | undefined;
}): OccupancyPricePillPresentation {
  if (opts.amount === null || opts.amount === undefined || Number.isNaN(opts.amount)) {
    return { label: '-', showStatusDot: true };
  }

  const cols = Math.max(1, Math.min(7, Math.floor(opts.spanCols)));

  // Phone one-day cells only: status color, no amount text.
  if (opts.isBelowLg && cols <= 1) {
    return { label: null, showStatusDot: false };
  }

  const budget = occupancyPillCharBudget({
    isBelowLg: opts.isBelowLg,
    spanCols: cols,
  });

  const full = formatMoneyCompact(opts.amount);
  const kPeso = `₱${formatOccupancyPillAmountK(opts.amount)}`;
  const kPlain = formatOccupancyPillAmountK(opts.amount);

  if (full.length <= budget) {
    return { label: full, showStatusDot: true };
  }
  if (kPeso.length <= budget) {
    return { label: kPeso, showStatusDot: true };
  }
  // Plain k with room for the dot.
  if (kPlain.length < budget) {
    return { label: kPlain, showStatusDot: true };
  }
  // Plain k fills the budget: drop the dot.
  if (kPlain.length <= budget) {
    return { label: kPlain, showStatusDot: false };
  }
  // Dropping the dot frees ~1 character.
  if (kPlain.length <= budget + 1) {
    return { label: kPlain, showStatusDot: false };
  }

  return { label: null, showStatusDot: false };
}
