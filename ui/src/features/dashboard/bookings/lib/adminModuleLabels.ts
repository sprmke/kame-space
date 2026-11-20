/**
 * User-facing host dashboard module names (sidebar, bottom tabs, page titles, RBAC
 * categories). Permission ids stay `pricing` / `inbox`. Messages uses URL `/messages`.
 */
export const ADMIN_MODULE_PRICING_LABEL = 'Pricing & availability';
export const ADMIN_MODULE_INBOX_LABEL = 'Messages';

export const ADMIN_MODULE_LABEL = {
  pricing: ADMIN_MODULE_PRICING_LABEL,
  inbox: ADMIN_MODULE_INBOX_LABEL,
} as const;
