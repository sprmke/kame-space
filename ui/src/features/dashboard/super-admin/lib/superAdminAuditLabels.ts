/**
 * Operator-facing names for audit actions and target types.
 *
 * The audit table stores snake_case keys (`pricing_plan_updated`, `help_center.faq_updated`).
 * Those are support vocabulary for the expanded details, not row copy: an operator reading
 * the log should never have to translate table names.
 */

const ACTION_LABELS: Record<string, string> = {
  ai_limit_profile_assigned: 'AI limit profile assigned',
  development_updated: 'Development updated',
  feature_availability_updated: 'Feature availability updated',
  'help_center.faq_updated': 'FAQ updated',
  'host_playbook.article_updated': 'Playbook article updated',
  host_verification_approved: 'Host verification approved',
  listing_authorization_approved: 'Listing approved',
  'ops_report.generate': 'Operations report generated',
  org_subscription_changed: 'Organization plan changed',
  payout_marked_sent: 'Payout marked sent',
  platform_settings_updated: 'Platform settings updated',
  pricing_plan_updated: 'Pricing plan updated',
  support_ticket_replied: 'Support ticket replied',
};

const TARGET_LABELS: Record<string, string> = {
  help_center_faq: 'FAQ',
  host_playbook_article: 'Playbook article',
  ops_report: 'Operations report',
  organization: 'Organization',
  platform: 'Platform',
  pricing_plan: 'Pricing plan',
  property: 'Property',
  support_ticket: 'Support ticket',
};

function humanizeKey(value: string): string {
  const words = value.replace(/[._-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? humanizeKey(action);
}

export function auditTargetLabel(targetType: string | null): string | null {
  if (!targetType) return null;
  return TARGET_LABELS[targetType] ?? humanizeKey(targetType);
}
