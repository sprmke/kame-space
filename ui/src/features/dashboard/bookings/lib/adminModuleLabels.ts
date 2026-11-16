/**
 * User-facing host dashboard module names (sidebar, bottom tabs, page titles, RBAC
 * categories). Route segments and permission ids stay `pricing` / `inbox`.
 */
export const ADMIN_MODULE_PRICING_LABEL = 'Pricing & availability';
export const ADMIN_MODULE_INBOX_LABEL = 'Messages';

export const ADMIN_MODULE_LABEL = {
  pricing: ADMIN_MODULE_PRICING_LABEL,
  inbox: ADMIN_MODULE_INBOX_LABEL,
} as const;
