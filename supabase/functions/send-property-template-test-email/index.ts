/**
 * send-property-template-test-email — Admin POST: render a template draft and mail it to the
 * caller's own address. Never sends to a guest, so it is ungated by the automation switches.
 *
 * POST { templateKey, category, content, subject?, name? }
 */

import { isEmailSuppressed } from '../_shared/emailSuppression.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  formatResendFromAddress,
  loadPropertyEmailBranding,
} from '../_shared/propertyEmailBranding.ts';
import { renderPropertyTemplatePreview } from '../_shared/propertyTemplatePreview.ts';
import {
  isBuiltinPropertyTemplateKey,
  isCustomTemplateKey,
  validateTemplateContent,
  type PropertyTemplateCategory,
} from '../_shared/propertyTemplates.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { sendResendEmail } from '../_shared/sendResendEmail.ts';
import type { TeamPermissionId } from '../_shared/propertyTeamPermissions.ts';

const SEND_LIMIT_PER_HOUR = 10;

function parseCategory(value: unknown): PropertyTemplateCategory | null {
  if (value === 'standard' || value === 'email' || value === 'message' || value === 'custom') {
    return value;
  }
  return null;
}

function editPermission(templateKey: string, category: PropertyTemplateCategory): TeamPermissionId {
  if (isCustomTemplateKey(templateKey)) return 'templates.custom:edit';
  if (category === 'email') return 'templates.email:edit';
  return 'templates.standard:edit';
}

serveAuthenticated('send-property-template-test-email', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const body = await readJsonBody(req);
  const templateKey = typeof body.templateKey === 'string' ? body.templateKey.trim() : '';
  const content = typeof body.content === 'string' ? body.content : '';
  const category = parseCategory(body.category);
  const name = typeof body.name === 'string' ? body.name : undefined;
  const subject =
    body.subject === null || typeof body.subject === 'string' ? body.subject : undefined;

  if (!templateKey) return jsonError(req, 'templateKey is required', 400);
  if (!category) return jsonError(req, 'category is required', 400);
  if (!isBuiltinPropertyTemplateKey(templateKey) && !isCustomTemplateKey(templateKey)) {
    return jsonError(req, 'Unknown template key', 400);
  }

  const contentErr = validateTemplateContent(content);
  if (contentErr) return jsonError(req, contentErr, 400);

  const { property } = await resolveScopedPropertyAccess(
    req,
    editPermission(templateKey, category)
  );

  const limited = await rateLimitGate(req, {
    scope: 'property_template_test_email',
    identity: user.id,
    limit: SEND_LIMIT_PER_HOUR,
    windowSec: 3600,
  });
  if (limited) return limited;

  const to = String(user.email ?? '').trim();
  if (!to) return jsonError(req, 'Your account has no email address', 400);
  if (await isEmailSuppressed(to)) {
    return jsonError(req, 'That address is on the email suppression list', 400);
  }

  const preview = await renderPropertyTemplatePreview({
    propertyId: property.id,
    templateKey,
    category,
    content,
    name,
    subject,
  });

  const branding = await loadPropertyEmailBranding(property.id);
  await sendResendEmail({
    from: formatResendFromAddress(
      `${branding.unitLabel} - ${branding.organizationName}`,
      branding.fromEmail
    ),
    to: [to],
    subject: `[Test] ${preview.subject || name || 'Template preview'}`,
    html: preview.html,
    errorLabel: 'email',
  });

  return jsonSuccess(req, { sentTo: to });
});
