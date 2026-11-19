/**
 * Guest-facing review emails (request / reminder / published).
 * Host-side alerts go through Notification Center, not email, in v1.
 */

import { buildEmailCtaHtml, renderBrandedEmailShell } from './brandedEmailShell.ts';
import { isEmailSuppressed } from './emailSuppression.ts';
import { mintGuestBookingAccessToken } from './guestBookingAccessToken.ts';
import { guestGuestReviewPath } from './publicGuestPaths.ts';
import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';
import { escapeHtml, loadEmailTemplate, replacePlaceholders } from './renderEmailHtml.ts';
import { createServiceClient } from './orgAuth.ts';
import { sendResendEmail } from './sendResendEmail.ts';
import { resolveAppSettings } from './appSettings.ts';
import {
  buildBookingPlaceholderVars,
  renderPropertyTemplateSendEmail,
  resolvePropertyTemplateSubject,
} from './propertyTemplateEmail.ts';
import { formatResendFromAddress, loadPropertyEmailBranding } from './propertyEmailBranding.ts';
import { getBuiltinPropertyTemplate } from './propertyTemplates.ts';

async function sendReviewNotice(opts: {
  to: string | null | undefined;
  guestName: string;
  propertyName: string;
  brandColor: string | null;
  subject: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}): Promise<boolean> {
  const to = opts.to?.trim();
  if (!to) return false;
  if (await isEmailSuppressed(to)) return false;

  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  if (!resendKey || !fromEmail) {
    console.warn('[reviewEmails] RESEND missing - skip');
    return false;
  }

  const bodyTemplate = await loadEmailTemplate('review-notice');
  const bodyHtml = replacePlaceholders(bodyTemplate, {
    guest_name: escapeHtml(opts.guestName || 'there'),
    body: escapeHtml(opts.body),
    cta: buildEmailCtaHtml(opts.ctaLabel, opts.ctaUrl, opts.brandColor),
  });
  const html = await renderBrandedEmailShell({
    brandName: opts.propertyName,
    unitLabel: opts.propertyName,
    emailTitle: opts.headline,
    bodyHtml,
    brandColor: opts.brandColor,
  });

  await sendResendEmail({
    from: fromEmail,
    to: [to],
    subject: opts.subject,
    html,
    errorLabel: 'email',
  });

  return true;
}

async function loadPropertyEmailBits(propertyId: string): Promise<{
  name: string;
  slug: string;
  brandColor: string | null;
}> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('properties')
    .select('name, slug, app_settings(brand_color)')
    .eq('id', propertyId)
    .maybeSingle();
  const settingsRaw = data?.app_settings as
    { brand_color?: string | null } | { brand_color?: string | null }[] | null;
  const settings = Array.isArray(settingsRaw) ? settingsRaw[0] : settingsRaw;
  return {
    name: (data?.name as string | undefined)?.trim() || 'your stay',
    slug: (data?.slug as string | undefined)?.trim() || '',
    brandColor: settings?.brand_color ?? null,
  };
}

/**
 * Tokenized `/guest-review` link. Guests open these from email on a fresh
 * device, so the link must carry its own booking access token or it fails
 * once `GUEST_BOOKING_ACCESS_ENFORCE` is on.
 */
async function guestReviewLink(
  propertySlug: string,
  bookingId: string,
  accessToken?: string | null
): Promise<string> {
  const token = accessToken?.trim() || (await mintGuestBookingAccessToken(bookingId));
  return guestGuestReviewPath(resolvePublicGuestAppOrigin(null), propertySlug, bookingId, token);
}

async function sendReviewWindowEmail(input: {
  templateKey: 'email-review-request' | 'email-review-reminder';
  bookingId: string;
  propertyId: string;
  guestEmail: string | null;
  guestName: string;
  accessToken?: string | null;
}): Promise<boolean> {
  const to = input.guestEmail?.trim();
  if (!to) return false;
  if (await isEmailSuppressed(to)) return false;

  const property = await loadPropertyEmailBits(input.propertyId);
  const url = await guestReviewLink(property.slug, input.bookingId, input.accessToken);

  const { data: booking } = await createServiceClient()
    .from('guest_submissions')
    .select('*')
    .eq('id', input.bookingId)
    .eq('property_id', input.propertyId)
    .maybeSingle();
  if (!booking) return false;

  const settings = await resolveAppSettings(input.propertyId);
  const branding = await loadPropertyEmailBranding(input.propertyId);
  const placeholderVars = buildBookingPlaceholderVars(
    booking as never,
    settings,
    { review_url: url, property_slug: property.slug },
    branding
  );
  placeholderVars.review_url = escapeHtml(url);

  const html = await renderPropertyTemplateSendEmail({
    propertyId: input.propertyId,
    templateKey: input.templateKey,
    emailTitle: getBuiltinPropertyTemplate(input.templateKey)?.label ?? 'Review',
    branding,
    placeholderVars,
    booking: booking as never,
  });
  const subject = await resolvePropertyTemplateSubject({
    propertyId: input.propertyId,
    templateKey: input.templateKey,
    vars: placeholderVars,
    fallback:
      input.templateKey === 'email-review-request'
        ? `How was your stay at ${property.name}?`
        : `Reminder: review ${property.name}`,
  });

  await sendResendEmail({
    from: formatResendFromAddress(
      `${branding.unitLabel} - ${branding.organizationName}`,
      branding.fromEmail
    ),
    to: [to],
    reply_to: settings.emailReplyTo,
    subject,
    html,
    errorLabel: 'email',
  });
  return true;
}

export async function sendReviewRequestEmail(input: {
  bookingId: string;
  propertyId: string;
  guestEmail: string | null;
  guestName: string;
  accessToken?: string | null;
}): Promise<boolean> {
  return sendReviewWindowEmail({ ...input, templateKey: 'email-review-request' });
}

export async function sendReviewReportDecisionEmail(input: {
  to: string | null | undefined;
  name: string;
  propertyId: string;
  upheld: boolean;
}): Promise<boolean> {
  const property = await loadPropertyEmailBits(input.propertyId);
  const origin = resolvePublicGuestAppOrigin(null);
  return sendReviewNotice({
    to: input.to,
    guestName: input.name,
    propertyName: property.name,
    brandColor: property.brandColor,
    subject: input.upheld ? 'A review was removed' : 'A review report was closed',
    headline: input.upheld ? 'A review was removed' : 'A review report was closed',
    body: input.upheld
      ? 'A reported review was removed after review.'
      : 'A reported review was kept after review.',
    ctaLabel: 'View stay',
    ctaUrl: origin,
  });
}

export async function sendReviewPublishedEmail(input: {
  bookingId: string;
  propertyId: string;
  guestEmail: string | null;
  guestName: string;
  accessToken?: string | null;
  hostReviewed: boolean;
}): Promise<boolean> {
  const property = await loadPropertyEmailBits(input.propertyId);
  const url = await guestReviewLink(property.slug, input.bookingId, input.accessToken);
  return sendReviewNotice({
    to: input.guestEmail,
    guestName: input.guestName,
    propertyName: property.name,
    brandColor: property.brandColor,
    subject: `Your review of ${property.name} is live`,
    headline: 'Your review is live',
    body: input.hostReviewed
      ? 'Your review is published. You can also read what the host wrote about you.'
      : 'Your review is published. The host can now read it.',
    ctaLabel: 'View review',
    ctaUrl: url,
  });
}

export async function sendReviewResponseEmail(input: {
  bookingId: string;
  propertyId: string;
  guestEmail: string | null;
  guestName: string;
  accessToken?: string | null;
}): Promise<boolean> {
  const property = await loadPropertyEmailBits(input.propertyId);
  const url = await guestReviewLink(property.slug, input.bookingId, input.accessToken);
  return sendReviewNotice({
    to: input.guestEmail,
    guestName: input.guestName,
    propertyName: property.name,
    brandColor: property.brandColor,
    subject: `${property.name} responded to your review`,
    headline: `${property.name} responded to your review`,
    body: 'The host posted a public response under your review.',
    ctaLabel: 'Read response',
    ctaUrl: url,
  });
}

export async function sendReviewReminderEmail(input: {
  bookingId: string;
  propertyId: string;
  guestEmail: string | null;
  guestName: string;
  accessToken?: string | null;
}): Promise<boolean> {
  return sendReviewWindowEmail({ ...input, templateKey: 'email-review-reminder' });
}
