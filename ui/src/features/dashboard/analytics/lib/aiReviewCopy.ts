import type { AnalyticsAiReviewItem, AnalyticsAiReviewRecord } from '@/features/dashboard/analytics/lib/aiReviewTypes';

/**
 * The AI review is model output stored as-is, so it can carry server vocabulary (state ids),
 * ISO dates, and raw `PHP 12000` amounts. This turns those into the same plain language the
 * rest of the page uses, for both the card and the PDF export (which reads the same record).
 *
 * Deterministic and idempotent: safe to run on old stored reviews and on new ones.
 */

const STATE_LABELS: Record<string, string> = {
  at_risk: 'at risk',
  attention_needed: 'needs attention',
  fully_booked: 'fully booked',
};

const MONEY_WHOLE = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const MONEY_CENTS = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  const sameYear = year === new Date().getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function humanizeReviewText(input: string): string {
  let text = input;

  // 2026-11-21 -> Nov 21 (with the year only when it is not the current one).
  text = text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (whole, y: string, m: string, d: string) => {
    const formatted = formatIsoDate(Number(y), Number(m), Number(d));
    return formatted ?? whole;
  });

  // 'at_risk' / attention_needed -> plain words.
  text = text.replace(
    /(['"]?)\b(at_risk|attention_needed|fully_booked)\b\1/g,
    (whole, _quote: string, token: string) => STATE_LABELS[token] ?? whole
  );
  text = text.replace(/\bstate at at risk\b/gi, 'state at risk');
  text = text.replace(/\bstate is needs attention\b/gi, 'state needs attention');

  // PHP 16500 / PHP 3,500.00 -> ₱16,500.
  text = text.replace(
    /\bPHP\s*([0-9][0-9]*(?:,[0-9]{3})*(?:\.[0-9]+)?)/gi,
    (whole, amount: string) => {
      const value = Number(amount.replace(/,/g, ''));
      if (!Number.isFinite(value)) return whole;
      return Number.isInteger(value) ? MONEY_WHOLE.format(value) : MONEY_CENTS.format(value);
    }
  );

  // Internal metric short names -> the labels the page uses.
  text = text.replace(/\bRevPAR\b/g, 'revenue per night');
  text = text.replace(/\bADR\b/g, 'average nightly rate');

  return text;
}

function humanizeItem(item: AnalyticsAiReviewItem): AnalyticsAiReviewItem {
  const next: AnalyticsAiReviewItem = { ...item, title: humanizeReviewText(item.title) };
  // Only rewrite keys the model actually sent: adding `evidence: undefined` makes
  // consumers think the field exists and hides the `why` fallback.
  if (item.why !== undefined) next.why = humanizeReviewText(item.why);
  if (item.evidence !== undefined) next.evidence = humanizeReviewText(item.evidence);
  if (item.action !== undefined) next.action = humanizeReviewText(item.action);
  if (item.expectedImpact !== undefined) {
    next.expectedImpact = humanizeReviewText(item.expectedImpact);
  }
  return next;
}

export function humanizeAiReview(
  record: AnalyticsAiReviewRecord | null | undefined
): AnalyticsAiReviewRecord | null {
  if (!record) return null;
  return {
    ...record,
    headline: humanizeReviewText(record.headline),
    payload: {
      ...record.payload,
      strengths: record.payload.strengths.map((item) => ({
        ...item,
        title: humanizeReviewText(item.title),
        evidence: humanizeReviewText(item.evidence),
      })),
      improvements: record.payload.improvements.map(humanizeItem),
      avoid: record.payload.avoid.map(humanizeItem),
    },
  };
}
