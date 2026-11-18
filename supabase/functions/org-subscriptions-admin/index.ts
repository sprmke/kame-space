/**
 * org-subscriptions-admin — Super-admin list/search org subscriptions + manual assign/override.
 * Billing is org-level only — see planEntitlements.ts.
 */

import {
  changeOrgSubscription,
  createOrgSubscription,
  getActiveOrgSubscription,
  writeOrgSubscriptionEvent,
} from '../_shared/planEntitlements.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  adminAdjustOrgCredit,
  adminExtendOrgSubscription,
  runPlatformBillingCycle,
} from '../_shared/subscriptionOrchestrator.ts';
import { billingErrorResponse } from '../_shared/billingHttp.ts';
import { listBillablePropertyIds } from '../_shared/orgBillableProperties.ts';
import { getLedgerBalancePhp, addLedgerEntry } from '../_shared/orgBillingLedger.ts';
import {
  applyScheduledPlan,
  cancelOrgSubscriptionNow,
  clearOrgScheduledChange,
  scheduleOrgCancel,
} from '../_shared/orgBillingLifecycle.ts';
import { applyPaidTransaction } from '../_shared/orgPaymentFulfillment.ts';
import { expireAllPendingOrgCheckouts } from '../_shared/orgPaymentReconcile.ts';
import { cancelOrgSubscriptionToFree } from '../_shared/planEntitlements.ts';
import { revokeHostVerificationReward } from '../_shared/hostVerificationReward.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
  parsePageLimit,
} from '../_shared/httpResponse.ts';
import { postgrestOrIlikeValue } from '../_shared/publicSearch.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { requireSuperAdminStepUp } from '../_shared/superAdminVerification.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';

// Statuses that count as an org's current ("live") subscription — mirrors the partial unique
// index (org_subscriptions_one_live_per_org_idx) plus 'suspended', which can still be the
// most-recent active assignment.
const LIVE_ORG_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due', 'suspended'];

async function enrolledPropertyIds(
  supabase: ReturnType<typeof createServiceClient>,
  orgSubscriptionId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('org_subscription_properties')
    .select('property_id')
    .eq('org_subscription_id', orgSubscriptionId);
  return (data ?? []).map((r) => r.property_id as string);
}

serveSuperAdmin('org-subscriptions-admin', async (req, admin) => {
  const stepUp = await requireSuperAdminStepUp(req, admin, 'org_subscription');
  if (stepUp) return stepUp;

  const supabase = createServiceClient();
  const url = new URL(req.url);
  const organizationIdParam = url.searchParams.get('organizationId')?.trim() || null;
  const summaryRequested = url.searchParams.get('summary') === 'true';

  if (req.method === 'GET') {
    if (summaryRequested) {
      const [totalRes, assignedRes, activeRes, propertiesRes] = await Promise.all([
        supabase.from('organizations').select('id', { count: 'exact', head: true }),
        supabase
          .from('organizations')
          .select('id, org_subscriptions!inner(id)', { count: 'exact', head: true })
          .in('org_subscriptions.status', LIVE_ORG_SUBSCRIPTION_STATUSES),
        supabase
          .from('org_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase.from('properties').select('id', { count: 'exact', head: true }),
      ]);

      const queryError =
        totalRes.error ?? assignedRes.error ?? activeRes.error ?? propertiesRes.error ?? null;
      if (queryError) return jsonError(req, queryError.message, 500);

      const total = totalRes.count ?? 0;
      const assigned = assignedRes.count ?? 0;

      return jsonSuccess(req, {
        summary: {
          total,
          assigned,
          unassigned: total - assigned,
          activeSubscriptions: activeRes.count ?? 0,
          properties: propertiesRes.count ?? 0,
        },
      });
    }

    if (url.searchParams.get('rewards') === 'true') {
      const { data, error } = await supabase
        .from('org_subscriptions')
        .select(
          `
          id,
          organization_id,
          status,
          current_period_start,
          current_period_end,
          created_at,
          organizations ( id, name, slug ),
          pricing_plans!org_subscriptions_plan_id_fkey ( code, name )
        `
        )
        .eq('source', 'reward')
        .in('status', ['trialing', 'active'])
        .order('current_period_end', { ascending: true })
        .limit(50);
      if (error) return jsonError(req, error.message, 500);

      const grants = (data ?? []).map((row) => {
        const org = row.organizations as Record<string, unknown> | null | undefined;
        const plan = row.pricing_plans as Record<string, unknown> | null | undefined;
        return {
          orgSubscriptionId: row.id as string,
          organizationId: row.organization_id as string,
          organizationName: (org?.name as string | undefined) ?? 'Unknown org',
          organizationSlug: (org?.slug as string | undefined) ?? null,
          status: row.status as string,
          planCode: (plan?.code as string | undefined) ?? null,
          planName: (plan?.name as string | undefined) ?? null,
          periodStart: (row.current_period_start as string | null) ?? null,
          periodEnd: (row.current_period_end as string | null) ?? null,
          createdAt: row.created_at as string,
        };
      });

      return jsonSuccess(req, { grants });
    }

    if (organizationIdParam) {
      const subscription = await getActiveOrgSubscription(organizationIdParam);
      const events = subscription
        ? await supabase
            .from('org_subscription_events')
            .select('*')
            .eq('org_subscription_id', subscription.id)
            .order('created_at', { ascending: false })
            .limit(40)
        : { data: [] };

      const { data: transactions } = await supabase
        .from('org_payment_transactions')
        .select(
          'id, plan_id, amount, currency, status, created_at, paid_at, checkout_url, purpose, applied, review_reason, receipt_number, payment_method_type, period_start, period_end'
        )
        .eq('organization_id', organizationIdParam)
        .order('created_at', { ascending: false })
        .limit(30);

      const { data: ledger } = await supabase
        .from('org_billing_ledger')
        .select('id, amount_php, kind, note, transaction_id, created_at')
        .eq('organization_id', organizationIdParam)
        .order('created_at', { ascending: false })
        .limit(30);

      return jsonSuccess(req, {
        subscription,
        enrolledPropertyIds: subscription
          ? await enrolledPropertyIds(supabase, subscription.id)
          : [],
        recentEvents: events.data ?? [],
        transactions: transactions ?? [],
        ledger: ledger ?? [],
        ledgerBalancePhp: await getLedgerBalancePhp(organizationIdParam),
      });
    }

    const search = url.searchParams.get('search')?.trim() || '';
    const planCode = url.searchParams.get('planCode')?.trim() || '';
    const hasPlanCodeFilter = Boolean(planCode) && planCode !== 'all';
    const { page, limit } = parsePageLimit(url.searchParams);
    const fromIdx = (page - 1) * limit;
    const toIdx = fromIdx + limit - 1;

    // planCode filters on the org's *live* subscription's plan code, which lives two joins deep
    // (org_subscriptions -> pricing_plans). PostgREST only lets us filter an embedded resource
    // with `!inner`, so the join shape — and therefore which subscriptions/plans are embedded per
    // row — differs depending on whether a plan filter is active.
    const subscriptionsSelect = hasPlanCodeFilter
      ? `org_subscriptions!inner (
          id,
          plan_id,
          pricing_model,
          status,
          price_php_snapshot,
          updated_at,
          pricing_plans!org_subscriptions_plan_id_fkey!inner ( code, name )
        )`
      : `org_subscriptions (
          id,
          plan_id,
          pricing_model,
          status,
          price_php_snapshot,
          updated_at,
          pricing_plans!org_subscriptions_plan_id_fkey ( code, name )
        )`;

    let query = supabase
      .from('organizations')
      .select(
        `
        id,
        name,
        slug,
        properties ( id ),
        ${subscriptionsSelect}
      `,
        { count: 'exact' }
      )
      .order('name', { ascending: true });

    if (search) {
      const pattern = postgrestOrIlikeValue(search);
      query = query.or(`name.ilike.${pattern},slug.ilike.${pattern}`);
    }

    if (hasPlanCodeFilter) {
      query = query
        .in('org_subscriptions.status', LIVE_ORG_SUBSCRIPTION_STATUSES)
        .eq('org_subscriptions.pricing_plans.code', planCode);
    }

    const { data, error, count } = await query.range(fromIdx, toIdx);
    if (error) return jsonError(req, error.message, 500);

    const rows = (data ?? []).map((row) => {
      const properties = ((row as Record<string, unknown>).properties ?? []) as Record<
        string,
        unknown
      >[];
      const subs = ((row as Record<string, unknown>).org_subscriptions ?? []) as Record<
        string,
        unknown
      >[];
      const live = subs.find((s) =>
        LIVE_ORG_SUBSCRIPTION_STATUSES.includes(String(s.status ?? ''))
      );
      const planJoin = live?.pricing_plans as Record<string, unknown> | undefined;

      return {
        organizationId: row.id as string,
        organizationName: row.name as string,
        organizationSlug: row.slug as string,
        propertyCount: properties.length,
        subscription: live
          ? {
              id: live.id as string,
              planId: live.plan_id as string,
              planCode: (planJoin?.code as string | undefined) ?? null,
              planName: (planJoin?.name as string | undefined) ?? null,
              pricingModel: live.pricing_model as string,
              status: live.status as string,
              pricePhpSnapshot:
                live.price_php_snapshot == null ? null : Number(live.price_php_snapshot),
              updatedAt: live.updated_at as string,
            }
          : null,
      };
    });

    return jsonSuccess(req, { organizations: rows, total: count ?? 0, page, limit });
  }

  if (req.method === 'POST') {
    requireHttpMethod(req, 'POST');
    const body = await readJsonBody(req);

    const organizationId =
      typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
    const planId = typeof body.planId === 'string' ? body.planId.trim() : '';
    if (!organizationId || !planId) {
      return jsonError(req, 'organizationId and planId are required');
    }

    // propertyIds is optional — defaults to every property the org owns, since the admin table's
    // one-click "assign" doesn't offer a per-property picker (that's the host-facing org Plans
    // page's job). Pass propertyIds explicitly to enroll only a subset.
    let propertyIds = Array.isArray(body.propertyIds)
      ? body.propertyIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];
    if (propertyIds.length === 0) {
      propertyIds = await listBillablePropertyIds(organizationId);
    }
    if (propertyIds.length === 0) {
      return jsonError(req, 'Organization has no properties to enroll');
    }

    // Manual assign/override price — bypasses the rate x count x discount formula for
    // sales-assisted tiers (e.g. Managed) that don't have a self-serve checkout.
    const overridePricePhp =
      typeof body.overridePricePhp === 'number' && Number.isFinite(body.overridePricePhp)
        ? body.overridePricePhp
        : null;

    const existing = await getActiveOrgSubscription(organizationId);
    let orgSubscriptionId: string;
    if (!existing) {
      const created = await createOrgSubscription(organizationId, planId, propertyIds, admin.id);
      orgSubscriptionId = created.orgSubscriptionId;
    } else {
      orgSubscriptionId = existing.id;
      await changeOrgSubscription(orgSubscriptionId, planId, propertyIds, admin.id);
    }

    const planChanged = !existing || existing.planId !== planId;
    if (planChanged) {
      await capturePostHogEvent('org_plan_changed', {
        logPrefix: 'org-subscriptions-admin',
        request: req,
        distinctId: admin.id,
        groups: { organization: organizationId },
        properties: {
          from_plan: existing ? existing.planId : 'free',
          to_plan: planId,
          cause: 'admin',
        },
      });
    }

    // An admin override is stored as price_override_php so property changes and renewals keep it
    // (they never recompute a sales-assisted price). Clearing it returns to the formula.
    if (overridePricePhp != null) {
      const { error: overrideError } = await supabase
        .from('org_subscriptions')
        .update({
          price_override_php: overridePricePhp,
          price_php_snapshot: overridePricePhp,
          ...(existing ? {} : { source: 'admin' }),
        })
        .eq('id', orgSubscriptionId);
      if (overrideError) return jsonError(req, overrideError.message, 500);
    } else if (!existing) {
      await supabase
        .from('org_subscriptions')
        .update({ source: 'admin' })
        .eq('id', orgSubscriptionId);
    }

    const subscription = await getActiveOrgSubscription(organizationId);
    const events = await supabase
      .from('org_subscription_events')
      .select('*')
      .eq('org_subscription_id', orgSubscriptionId)
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: orgRow } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();
    const { data: planRow } = await supabase
      .from('pricing_plans')
      .select('name')
      .eq('id', planId)
      .maybeSingle();
    const planName = typeof planRow?.name === 'string' ? planRow.name : null;
    await logSuperAdminAction(admin, {
      action: 'org_subscription.assign',
      targetType: 'organization',
      targetId: organizationId,
      summary: `Assigned plan to ${orgRow?.name ?? organizationId}${
        overridePricePhp != null ? ` (override ₱${overridePricePhp})` : ''
      }`,
      metadata: {
        planId,
        propertyCount: propertyIds.length,
        overridePricePhp,
        note: typeof body.note === 'string' ? body.note : undefined,
      },
      mirrorToOrgActivity: {
        organizationId,
        action: 'billing.plan_overridden_by_platform',
        targetType: 'subscription',
        targetId: organizationId,
        targetLabel: orgRow?.name ?? 'the organization',
        metadata: {
          to_plan: planId,
          ...(planName ? { to_plan_name: planName } : {}),
          property_count: propertyIds.length,
          override_price_php: overridePricePhp,
        },
        req,
      },
    });

    return jsonSuccess(req, {
      subscription,
      recentEvents: events.data ?? [],
    });
  }

  if (req.method === 'PATCH') {
    requireHttpMethod(req, 'PATCH');
    const body = await readJsonBody(req);
    const action = typeof body.action === 'string' ? body.action.trim() : '';

    if (action === 'run_billing_cron') {
      const result = await runPlatformBillingCycle();
      return jsonSuccess(req, { result });
    }

    const organizationId =
      typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
    if (!organizationId) return jsonError(req, 'organizationId is required');

    if (action === 'extend_period') {
      const periodEnd =
        typeof body.periodEnd === 'string'
          ? body.periodEnd.trim()
          : typeof body.periodEndIso === 'string'
            ? body.periodEndIso.trim()
            : '';
      if (!periodEnd) return jsonError(req, 'periodEnd is required');

      const status =
        body.status === 'active' ||
        body.status === 'past_due' ||
        body.status === 'suspended' ||
        body.status === 'canceled'
          ? body.status
          : 'active';

      await adminExtendOrgSubscription({
        organizationId,
        periodEndIso: periodEnd,
        status,
        note: typeof body.note === 'string' ? body.note.trim() || null : null,
        adminUserId: admin.id,
      });

      await logSuperAdminAction(admin, {
        action: 'org_subscription.extend_period',
        targetType: 'organization',
        targetId: organizationId,
        summary: `Extended the billing period to ${periodEnd}`,
        metadata: {
          periodEnd,
          status,
          note: typeof body.note === 'string' ? body.note : undefined,
        },
      });
      const subscription = await getActiveOrgSubscription(organizationId);
      return jsonSuccess(req, { subscription });
    }

    if (action === 'revoke_reward') {
      const orgSubscriptionId =
        typeof body.orgSubscriptionId === 'string'
          ? body.orgSubscriptionId.trim()
          : typeof body.subscriptionId === 'string'
            ? body.subscriptionId.trim()
            : '';
      if (!orgSubscriptionId) return jsonError(req, 'orgSubscriptionId is required');

      await revokeHostVerificationReward(orgSubscriptionId, admin.id);

      await logSuperAdminAction(admin, {
        action: 'org_subscription.revoke_reward',
        targetType: 'organization',
        targetId: organizationId,
        summary: `Revoked host verification reward subscription ${orgSubscriptionId}`,
        metadata: { orgSubscriptionId },
      });

      const subscription = await getActiveOrgSubscription(organizationId);
      return jsonSuccess(req, { subscription });
    }

    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';
    const org = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();
    const orgName = (org.data?.name as string | undefined) ?? organizationId;
    const audit = (
      auditAction: string,
      summary: string,
      metadata: Record<string, unknown>,
      mirror?: Parameters<typeof logSuperAdminAction>[1]['mirrorToOrgActivity']
    ) =>
      logSuperAdminAction(admin, {
        action: auditAction,
        targetType: 'organization',
        targetId: organizationId,
        summary,
        metadata,
        mirrorToOrgActivity: mirror,
      });

    try {
      if (action === 'clear_intent') {
        const result = await clearOrgScheduledChange({ organizationId, clearedBy: admin.id });
        await audit(
          'org_subscription.clear_scheduled_change',
          `Cleared a scheduled plan change for ${orgName}`,
          {
            note,
          }
        );
        return jsonSuccess(req, {
          subscription: await getActiveOrgSubscription(organizationId),
          ...result,
        });
      }

      if (action === 'cancel_at_period_end') {
        const result = await scheduleOrgCancel({
          organizationId,
          reason: 'other',
          scheduledBy: admin.id,
        });
        await audit(
          'org_subscription.cancel_at_period_end',
          `Scheduled ${orgName} to end at the period end`,
          {
            note,
          }
        );
        return jsonSuccess(req, {
          subscription: await getActiveOrgSubscription(organizationId),
          ...result,
        });
      }

      if (action === 'apply_intent_now') {
        const sub = await getActiveOrgSubscription(organizationId);
        if (!sub) return jsonError(req, 'No live subscription for organization');
        if (sub.scheduledPlanId) {
          await expireAllPendingOrgCheckouts(organizationId);
          await applyScheduledPlan(sub);
          await audit(
            'org_subscription.apply_scheduled_change',
            `Applied the scheduled plan change for ${orgName} now`,
            { note }
          );
        } else if (sub.cancelAtPeriodEnd) {
          await expireAllPendingOrgCheckouts(organizationId);
          await cancelOrgSubscriptionToFree({
            orgSubscriptionId: sub.id,
            organizationId,
            previousStatus: sub.status,
            endedReason: 'admin',
            note: note || 'Ended early by platform admin',
            changedBy: admin.id,
          });
          await audit('org_subscription.apply_cancel', `Ended ${orgName}'s plan now`, { note });
        } else {
          return jsonError(req, 'Nothing is scheduled');
        }
        return jsonSuccess(req, { subscription: await getActiveOrgSubscription(organizationId) });
      }

      if (action === 'cancel_now') {
        const sub = await getActiveOrgSubscription(organizationId);
        if (!sub) return jsonError(req, 'No live subscription for organization');
        await expireAllPendingOrgCheckouts(organizationId);
        await cancelOrgSubscriptionToFree({
          orgSubscriptionId: sub.id,
          organizationId,
          previousStatus: sub.status,
          endedReason: 'admin',
          note: note || 'Ended by platform admin',
          changedBy: admin.id,
        });
        await audit(
          'org_subscription.cancel_now',
          `Moved ${orgName} to Free`,
          { note },
          {
            organizationId,
            action: 'billing.subscription_canceled',
            targetType: 'subscription',
            targetId: organizationId,
            targetLabel: orgName,
            metadata: { ended_reason: 'admin' },
            req,
          }
        );
        return jsonSuccess(req, { subscription: null });
      }

      if (action === 'adjust_credit') {
        const creditPhp = Number(body.creditPhp);
        if (!Number.isFinite(creditPhp) || creditPhp === 0 || Math.abs(creditPhp) > 1_000_000) {
          return jsonError(req, 'Enter a credit amount other than zero');
        }
        if (!note) return jsonError(req, 'A note is required for a credit adjustment');
        const result = await adminAdjustOrgCredit({
          organizationId,
          creditPhp,
          note,
          adminUserId: admin.id,
        });
        await audit(
          'org_subscription.adjust_credit',
          `Adjusted ${orgName}'s account credit by ₱${Math.round(creditPhp)}`,
          { creditPhp: Math.round(creditPhp), note },
          {
            organizationId,
            action: 'billing.credit_adjusted',
            targetType: 'subscription',
            targetId: organizationId,
            targetLabel: orgName,
            metadata: { amount: Math.abs(Math.round(creditPhp)) },
            req,
          }
        );
        return jsonSuccess(req, result);
      }

      if (action === 'record_refund') {
        const transactionId =
          typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
        if (!transactionId) return jsonError(req, 'transactionId is required');
        const { data: txn, error: txnError } = await supabase
          .from('org_payment_transactions')
          .select('id, status, amount, org_subscription_id')
          .eq('id', transactionId)
          .eq('organization_id', organizationId)
          .maybeSingle();
        if (txnError) return jsonError(req, txnError.message, 500);
        if (!txn || txn.status !== 'paid')
          return jsonError(req, 'Only a paid payment can be marked refunded');
        await supabase
          .from('org_payment_transactions')
          .update({ status: 'refunded', review_reason: note ? `refunded: ${note}` : 'refunded' })
          .eq('id', transactionId)
          .eq('status', 'paid');
        if (txn.org_subscription_id) {
          await writeOrgSubscriptionEvent({
            orgSubscriptionId: txn.org_subscription_id as string,
            eventType: 'ledger_entry',
            note: `Refund recorded (₱${Math.round(Number(txn.amount))})${note ? `: ${note}` : ''}`,
            createdBy: admin.id,
          });
        }
        await audit(
          'org_subscription.record_refund',
          `Recorded a ₱${Math.round(Number(txn.amount))} refund for ${orgName}`,
          { transactionId, note },
          {
            organizationId,
            action: 'billing.refund_recorded',
            targetType: 'subscription',
            targetId: organizationId,
            targetLabel: orgName,
            metadata: { amount: Math.round(Number(txn.amount)) },
            req,
          }
        );
        return jsonSuccess(req, { refunded: true });
      }

      if (action === 'resolve_payment') {
        const transactionId =
          typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
        const resolution =
          body.resolution === 'apply'
            ? 'apply'
            : body.resolution === 'keep_credit'
              ? 'keep_credit'
              : '';
        if (!transactionId || !resolution)
          return jsonError(req, 'transactionId and resolution are required');
        const { data: txn, error: txnError } = await supabase
          .from('org_payment_transactions')
          .select('id, status, amount, applied, review_reason')
          .eq('id', transactionId)
          .eq('organization_id', organizationId)
          .maybeSingle();
        if (txnError) return jsonError(req, txnError.message, 500);
        if (!txn || txn.status !== 'paid' || txn.applied === true) {
          return jsonError(req, 'This payment is already resolved');
        }
        if (resolution === 'apply') {
          // Forget a previous "kept as credit" verdict so the apply path runs again.
          await supabase
            .from('org_payment_transactions')
            .update({ applied: null, review_reason: null, apply_attempts: 0 })
            .eq('id', transactionId);
          if (String(txn.review_reason ?? '').startsWith('stale:')) {
            // The payment was kept as credit earlier: take that credit back before applying it.
            await addLedgerEntry({
              organizationId,
              amountPhp: Math.round(Number(txn.amount)),
              kind: 'admin_adjustment',
              note: 'Reversed credit so the payment can be applied',
              createdBy: admin.id,
            });
          }
          const result = await applyPaidTransaction(transactionId, admin.id);
          await audit('org_subscription.resolve_payment', `Applied a held payment for ${orgName}`, {
            transactionId,
            resolution,
            applied: result.applied,
            note,
          });
          return jsonSuccess(req, result);
        }
        if (String(txn.review_reason ?? '').startsWith('stale:')) {
          return jsonSuccess(req, { applied: false, reason: 'already_credit' });
        }
        await addLedgerEntry({
          organizationId,
          amountPhp: -Math.round(Number(txn.amount)),
          kind: 'stale_payment',
          transactionId,
          note: note || 'Kept as account credit by platform admin',
          createdBy: admin.id,
        });
        await supabase
          .from('org_payment_transactions')
          .update({ applied: false, review_reason: 'stale: kept as credit by admin' })
          .eq('id', transactionId);
        await audit(
          'org_subscription.resolve_payment',
          `Kept a held payment as credit for ${orgName}`,
          {
            transactionId,
            resolution,
            note,
          }
        );
        return jsonSuccess(req, { applied: false, reason: 'kept_credit' });
      }
    } catch (err) {
      return billingErrorResponse(req, err);
    }

    return jsonError(req, 'Unknown action', 400);
  }

  return jsonError(req, 'Method not allowed', 405);
});
