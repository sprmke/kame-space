/** Turns billing rule errors into precise HTTP responses (status, message and a stable code). */

import { BillingRuleError, PriceChangedError } from './billingErrors.ts';
import { jsonError, jsonResponse } from './httpResponse.ts';

export function billingErrorResponse(req: Request, err: unknown): Response {
  if (err instanceof PriceChangedError) {
    return jsonResponse(
      req,
      {
        success: false,
        error: err.message,
        code: err.code,
        freshChargePhp: err.freshChargePhp,
      },
      err.status,
      'private'
    );
  }
  if (err instanceof BillingRuleError) {
    return jsonResponse(
      req,
      { success: false, error: err.message, code: err.code },
      err.status,
      'private'
    );
  }
  const message = err instanceof Error ? err.message : 'Billing request failed';
  const unavailable = message.includes('not configured');
  console.error('[billing] unexpected error', err);
  return jsonError(
    req,
    unavailable ? message : 'Could not complete the billing request',
    unavailable ? 503 : 502
  );
}
