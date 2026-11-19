/**
 * platform-parking-settings — Super-admin GET/PUT commission %, guest service fee and processor-fee config for the
 * parkings vertical (Phase 4). Values are read live by `resolveParkingPlatformSettings()`
 * (`_shared/parkingPlatformSettings.ts`) and snapshotted onto `parking_payment_transactions` at
 * checkout-creation time — changing them here never touches an already-created transaction.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { checkParkingNoLoss } from '../_shared/parkingGuestFee.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { requireSuperAdminStepUp } from '../_shared/superAdminVerification.ts';

function serialize(row: Record<string, unknown>) {
  return {
    commissionPct: Number(row.commission_pct ?? 0.1),
    directCommissionPct: Number(row.direct_commission_pct ?? 0.05),
    guestFeePct: Number(row.guest_fee_pct ?? 0.05),
    guestFeeFixed: Number(row.guest_fee_fixed ?? 15),
    paymentFeePct: Number(row.payment_fee_pct ?? 0.03125),
    paymentFeeFixed: Number(row.payment_fee_fixed ?? 15),
    supportEscalationPhone: (row.support_escalation_phone as string | undefined)?.trim() || null,
    updatedAt: row.updated_at as string,
  };
}

serveSuperAdmin('platform-parking-settings', async (req, user) => {
  const stepUp = await requireSuperAdminStepUp(req, user, 'platform_parking_settings');
  if (stepUp) return stepUp;

  const supabase = createServiceClient();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('platform_parking_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error) return jsonError(req, error.message, 500);
    if (!data) return jsonError(req, 'Parking settings not initialized', 500);
    return jsonSuccess(req, { settings: serialize(data as Record<string, unknown>) });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    requireHttpMethod(req, req.method);
    const body = await readJsonBody(req);

    const patch: Record<string, unknown> = { updated_by: user.id };
    if (body.commissionPct != null) {
      const pct = Number(body.commissionPct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 1) {
        return jsonError(req, 'commissionPct must be between 0 and 1');
      }
      patch.commission_pct = pct;
    }
    if (body.directCommissionPct != null) {
      const pct = Number(body.directCommissionPct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 1) {
        return jsonError(req, 'directCommissionPct must be between 0 and 1');
      }
      patch.direct_commission_pct = pct;
    }
    if (body.guestFeePct != null) {
      const pct = Number(body.guestFeePct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 1) {
        return jsonError(req, 'guestFeePct must be between 0 and 1');
      }
      patch.guest_fee_pct = pct;
    }
    if (body.guestFeeFixed != null) {
      const fee = Number(body.guestFeeFixed);
      if (!Number.isFinite(fee) || fee < 0) {
        return jsonError(req, 'guestFeeFixed must be a non-negative number');
      }
      patch.guest_fee_fixed = fee;
    }
    if (body.paymentFeePct != null) {
      const pct = Number(body.paymentFeePct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 1) {
        return jsonError(req, 'paymentFeePct must be between 0 and 1');
      }
      patch.payment_fee_pct = pct;
    }
    if (body.paymentFeeFixed != null) {
      const fee = Number(body.paymentFeeFixed);
      if (!Number.isFinite(fee) || fee < 0) {
        return jsonError(req, 'paymentFeeFixed must be a non-negative number');
      }
      patch.payment_fee_fixed = fee;
    }
    if (body.supportEscalationPhone != null) {
      patch.support_escalation_phone = String(body.supportEscalationPhone).trim() || null;
    }

    // The platform must never sell below cost at any legal host rate (>= PARKING_MIN_NIGHTLY_RATE).
    const { data: current, error: currentError } = await supabase
      .from('platform_parking_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (currentError) return jsonError(req, currentError.message, 500);
    const merged = serialize({ ...(current ?? {}), ...patch } as Record<string, unknown>);
    const noLoss = checkParkingNoLoss({
      commissionPct: merged.commissionPct,
      directCommissionPct: merged.directCommissionPct,
      guestFeePct: merged.guestFeePct,
      guestFeeFixed: merged.guestFeeFixed,
      paymentFeePct: merged.paymentFeePct,
      paymentFeeFixed: merged.paymentFeeFixed,
    });
    if (!noLoss.ok) {
      return jsonError(req, `These settings lose money. ${noLoss.reason}`);
    }

    const { data, error } = await supabase
      .from('platform_parking_settings')
      .update(patch)
      .eq('id', 1)
      .select('*')
      .single();
    if (error) return jsonError(req, error.message, 500);

    await logSuperAdminAction(user, {
      action: 'platform.parking_settings_update',
      targetType: 'platform',
      targetId: 'platform_parking_settings',
      summary: 'Updated platform parking settings',
      metadata: { changed: Object.keys(patch).filter((k) => k !== 'updated_by') },
    });

    return jsonSuccess(req, { settings: serialize(data as Record<string, unknown>) });
  }

  return jsonError(req, 'Method not allowed', 405);
});
