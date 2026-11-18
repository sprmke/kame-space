/**
 * Send-once billing notifications. A row in org_billing_notifications is claimed before sending
 * (unique on org + kind + period), so overlapping cron runs and retries never double-send. If
 * the send fails the claim is released so the next run tries again.
 */

import { createServiceClient } from './orgAuth.ts';

export async function sendBillingNotificationOnce(input: {
  organizationId: string;
  orgSubscriptionId?: string | null;
  kind: string;
  periodKey: string;
  send: () => Promise<void>;
}): Promise<'sent' | 'duplicate' | 'failed'> {
  const sb = createServiceClient();
  const { data: claim, error: claimError } = await sb
    .from('org_billing_notifications')
    .insert({
      organization_id: input.organizationId,
      org_subscription_id: input.orgSubscriptionId ?? null,
      kind: input.kind,
      period_key: input.periodKey,
    })
    .select('id')
    .single();

  if (claimError) {
    if (claimError.code === '23505') return 'duplicate';
    console.error('[orgBillingNotifications] claim failed', claimError.message);
    return 'failed';
  }

  try {
    await input.send();
    await sb
      .from('org_billing_notifications')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', claim.id as string);
    return 'sent';
  } catch (err) {
    console.error('[orgBillingNotifications] send failed, releasing claim', input.kind, err);
    await sb
      .from('org_billing_notifications')
      .delete()
      .eq('id', claim.id as string);
    return 'failed';
  }
}
