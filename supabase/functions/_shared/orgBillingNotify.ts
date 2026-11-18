/**
 * Delivers an org billing message: email to the owner (and the billing email when set) plus an
 * in-app notification (which fans out to web push). Copy lives in orgBillingMessages.ts.
 * `notifyOrgBillingOnce` adds the send-once guard used by the cron and webhook paths.
 */

import { buildEmailCtaHtml, renderBrandedEmailShell } from './brandedEmailShell.ts';
import { loadAuthUserProfile } from './authUserProfile.ts';
import { createNotification } from './notificationService.ts';
import { createServiceClient } from './orgAuth.ts';
import {
  buildOrgBillingMessage,
  type OrgBillingMessageKind,
  type OrgBillingMessageParams,
} from './orgBillingMessages.ts';
import { sendBillingNotificationOnce } from './orgBillingNotifications.ts';
import { PLATFORM_BRAND_NAME } from './platformBrand.ts';
import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';
import { escapeHtml } from './renderEmailHtml.ts';
import { sendResendEmail } from './sendResendEmail.ts';

const BODY_P = 'margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;';

/** Kinds that also appear in the in-app notification list (and push). */
const IN_APP_KINDS = new Set<OrgBillingMessageKind>([
  'change_applied',
  'plan_ended',
  'renewal_link',
  'renewal_due_tomorrow',
  'past_due',
  'grace_ending',
  'suspended',
  'reactivated',
  'renewed_from_credit',
  'payment_credited',
  'payment_failed',
  'trial_ending',
  'price_change',
]);

export type OrgBillingOrgContext = {
  organizationId: string;
  orgName: string;
  orgSlug: string;
  ownerId: string | null;
  billingEmail: string | null;
};

export async function loadOrgBillingOrgContext(
  organizationId: string
): Promise<OrgBillingOrgContext> {
  const sb = createServiceClient();
  const { data: org, error } = await sb
    .from('organizations')
    .select('id, name, slug, owner_id')
    .eq('id', organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!org) throw new Error('Organization not found');
  const { data: details } = await sb
    .from('org_billing_details')
    .select('billing_email')
    .eq('organization_id', organizationId)
    .maybeSingle();
  const billingEmail =
    typeof details?.billing_email === 'string' && details.billing_email.trim()
      ? details.billing_email.trim()
      : null;
  return {
    organizationId,
    orgName: String(org.name ?? 'Organization'),
    orgSlug: String(org.slug ?? ''),
    ownerId: (org.owner_id as string | null) ?? null,
    billingEmail,
  };
}

export function orgPlansPageUrl(orgSlug: string): string {
  return `${resolvePublicGuestAppOrigin(null)}/org/${orgSlug}/plans?tab=billing`;
}

async function sendEmail(
  ctx: OrgBillingOrgContext,
  message: ReturnType<typeof buildOrgBillingMessage>
): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  if (!resendKey || !fromEmail) {
    console.warn('[orgBillingNotify] RESEND missing - skip email');
    return;
  }

  const recipients = new Set<string>();
  let ownerName = 'there';
  if (ctx.ownerId) {
    const owner = await loadAuthUserProfile(createServiceClient(), ctx.ownerId);
    if (owner.email?.trim()) recipients.add(owner.email.trim().toLowerCase());
    if (owner.name?.trim()) ownerName = owner.name.trim();
  }
  if (ctx.billingEmail) recipients.add(ctx.billingEmail.toLowerCase());
  if (recipients.size === 0) {
    console.warn('[orgBillingNotify] no recipient email - skip');
    return;
  }

  const ctaUrl =
    !message.ctaTarget || message.ctaTarget === 'plans'
      ? orgPlansPageUrl(ctx.orgSlug)
      : message.ctaTarget;
  const ctaBlock = message.ctaLabel ? buildEmailCtaHtml(message.ctaLabel, ctaUrl, null) : '';
  const bodyHtml = `<p style="${BODY_P}">Hi ${escapeHtml(ownerName)},</p>
${message.paragraphs.map((line) => `<p style="${BODY_P}">${escapeHtml(line)}</p>`).join('\n')}
${ctaBlock}`;

  const brandName = ctx.orgName || PLATFORM_BRAND_NAME || 'Billing';
  const html = await renderBrandedEmailShell({
    brandName,
    unitLabel: brandName,
    emailTitle: message.headline,
    bodyHtml,
    brandColor: null,
  });
  await sendResendEmail({
    from: `${brandName} <${fromEmail}>`,
    to: [...recipients],
    subject: message.subject,
    html,
    errorLabel: 'email',
  });
}

export async function notifyOrgBilling(input: {
  organizationId: string;
  kind: OrgBillingMessageKind;
  params?: Omit<OrgBillingMessageParams, 'orgName'>;
  /** Used to dedupe the in-app row. */
  periodKey?: string;
  context?: OrgBillingOrgContext;
}): Promise<void> {
  const ctx = input.context ?? (await loadOrgBillingOrgContext(input.organizationId));
  const message = buildOrgBillingMessage(input.kind, { ...input.params, orgName: ctx.orgName });

  await sendEmail(ctx, message);

  if (IN_APP_KINDS.has(input.kind)) {
    await createNotification({
      organizationId: input.organizationId,
      type: 'billing_notice',
      title: message.headline,
      body: message.paragraphs[0] ?? null,
      metadata: { kind: input.kind },
      dedupeKey: input.periodKey
        ? `billing:${input.organizationId}:${input.kind}:${input.periodKey}`
        : null,
    });
  }
}

/** Email + in-app, once per (org, kind, periodKey). A failed send releases the claim for a retry. */
export async function notifyOrgBillingOnce(input: {
  organizationId: string;
  orgSubscriptionId?: string | null;
  kind: OrgBillingMessageKind;
  periodKey: string;
  params?: Omit<OrgBillingMessageParams, 'orgName'>;
}): Promise<'sent' | 'duplicate' | 'failed'> {
  return await sendBillingNotificationOnce({
    organizationId: input.organizationId,
    orgSubscriptionId: input.orgSubscriptionId,
    kind: input.kind,
    periodKey: input.periodKey,
    send: () =>
      notifyOrgBilling({
        organizationId: input.organizationId,
        kind: input.kind,
        params: input.params,
        periodKey: input.periodKey,
      }),
  });
}

/** Best-effort variant for host-initiated events (no dedupe, never throws). */
export async function notifyOrgBillingSafe(
  input: Parameters<typeof notifyOrgBilling>[0]
): Promise<void> {
  try {
    await notifyOrgBilling(input);
  } catch (err) {
    console.error('[orgBillingNotify] notify failed', input.kind, err);
  }
}
