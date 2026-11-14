/**
 * Weekly plan mode: rules or AI.
 *
 * The AI plan is opt-in and budgeted. This is the pure gate the cron consults before it
 * spends a credit, so the decision is testable without a database.
 */

export type WeeklyPlanMode = 'rules' | 'ai';

export const DEFAULT_WEEKLY_AI_CREDIT_CAP = 20;

export type AiPlanGateInput = {
  /** Stored `auto_plan_mode`. Anything other than `ai` means rules. */
  mode: unknown;
  /** Stored `weekly_ai_credit_cap`. 0 or missing disables AI planning. */
  cap: unknown;
  /** Credits already spent on plans for this property in the rolling 7 days. */
  spent: number;
  /** Whether the org still holds `aiMarketingPlanner`. */
  entitled: boolean;
};

export function shouldUseAiPlan(input: AiPlanGateInput): boolean {
  if (input.mode !== 'ai') return false;
  const cap = Number(input.cap);
  if (!Number.isFinite(cap) || cap <= 0) return false;
  if (!input.entitled) return false;
  const spent = Number.isFinite(input.spent) && input.spent > 0 ? input.spent : 0;
  return spent < cap;
}

/** Cap to store when a host turns the AI plan on. Never above the schema's ceiling. */
export function normaliseAiCap(value: unknown): number {
  const cap = Number(value);
  if (!Number.isFinite(cap) || cap <= 0) return 0;
  return Math.min(1000, Math.round(cap));
}
