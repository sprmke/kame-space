/**
 * get-org-payment-receipt — PDF receipt for a paid org subscription payment (or a payment kept as
 * account credit). Any org member can download it. A payment receipt, not a BIR official receipt.
 */

import { createServiceClient, verifyOrgAccess } from '../_shared/orgAuth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { formatManilaDateLabel } from '../_shared/billingPeriod.ts';
import { jsonError } from '../_shared/httpResponse.ts';
import { buildReceiptPdf, type ReceiptLine } from '../_shared/orgReceiptPdf.ts';
import { PLATFORM_BRAND_NAME } from '../_shared/platformBrand.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const METHOD_LABELS: Record<string, string> = {
  qrph: 'QR Ph',
  gcash: 'GCash',
  paymaya: 'Maya',
  maya: 'Maya',
  dob: 'Online banking',
  card: 'Card',
  credit: 'Account credit',
};

serveAuthenticated('get-org-payment-receipt', async (req) => {
  if (req.method !== 'GET') return jsonError(req, 'Method not allowed', 405);

  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId')?.trim() || undefined;
  const transactionId = url.searchParams.get('transactionId')?.trim() || '';
  if (!orgId || !transactionId) return jsonError(req, 'orgId and transactionId are required');

  const { org } = await verifyOrgAccess(req, { orgId }, 'org.plans:view');
  const organizationId = org.id as string;
  const supabase = createServiceClient();

  const { data: txn, error } = await supabase
    .from('org_payment_transactions')
    .select(
      'id, status, amount, paid_at, payment_method_type, plan_id, period_start, period_end, line_items, receipt_number, applied, property_ids'
    )
    .eq('id', transactionId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) return jsonError(req, error.message, 500);
  if (!txn || !txn.receipt_number || (txn.status !== 'paid' && txn.status !== 'refunded')) {
    return jsonError(req, 'Receipt not available', 404);
  }

  const [{ data: plan }, { data: details }] = await Promise.all([
    supabase
      .from('pricing_plans')
      .select('name')
      .eq('id', txn.plan_id as string)
      .maybeSingle(),
    supabase
      .from('org_billing_details')
      .select('legal_name, address, tin')
      .eq('organization_id', organizationId)
      .maybeSingle(),
  ]);

  const rawItems = Array.isArray(txn.line_items)
    ? (txn.line_items as Record<string, unknown>[])
    : [];
  const lines: ReceiptLine[] = rawItems
    .filter((item) => typeof item.label === 'string' && Number.isFinite(Number(item.amountPhp)))
    .map((item) => ({ label: String(item.label), amountPhp: Number(item.amountPhp) }));
  const amount = Number(txn.amount ?? 0);
  if (lines.length === 0) {
    lines.push({ label: `${plan?.name ?? 'Plan'} subscription`, amountPhp: amount });
  }

  const propertyCount = Array.isArray(txn.property_ids) ? txn.property_ids.length : 0;
  const periodLabel =
    txn.period_start && txn.period_end
      ? `${formatManilaDateLabel(new Date(txn.period_start as string))} to ${formatManilaDateLabel(new Date(txn.period_end as string))}`
      : null;
  const method = String(txn.payment_method_type ?? '').toLowerCase();

  const pdf = await buildReceiptPdf({
    brandName: PLATFORM_BRAND_NAME || 'Kame Space',
    receiptNumber: String(txn.receipt_number),
    paidAtLabel: formatManilaDateLabel(new Date((txn.paid_at as string | null) ?? new Date())),
    orgName: String(org.name ?? 'Organization'),
    legalName: (details?.legal_name as string | null) ?? null,
    address: (details?.address as string | null) ?? null,
    tin: (details?.tin as string | null) ?? null,
    planName: `${plan?.name ?? 'Plan'}${propertyCount ? ` (${propertyCount} ${propertyCount === 1 ? 'property' : 'properties'})` : ''}`,
    periodLabel,
    paymentMethodLabel: METHOD_LABELS[method] ?? (method ? method.toUpperCase() : 'Online payment'),
    lines,
    totalPaidPhp: amount,
    note: txn.applied === false ? 'This payment was added to your account credit.' : null,
  });

  return new Response(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${String(txn.receipt_number)}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
});
