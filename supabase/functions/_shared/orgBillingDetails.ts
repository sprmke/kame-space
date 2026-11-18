/**
 * Billing details an org owner keeps on file for receipts: legal name, address, optional TIN and a
 * billing email that receives the same billing emails as the owner. Validation is shared by the
 * edge function and tests; the UI mirrors the same limits.
 */

export type OrgBillingDetailsInput = {
  legalName: string;
  address: string;
  tin: string;
  billingEmail: string;
};

export const BILLING_DETAIL_LIMITS = {
  legalName: 120,
  address: 300,
  tin: 20,
  billingEmail: 160,
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Philippine TIN: 9 digits, optionally followed by a 3 to 5 digit branch code. */
const TIN_PATTERN = /^\d{3}-?\d{3}-?\d{3}(?:-?\d{3,5})?$/;

/** 123456789 -> 123-456-789; 123456789000 -> 123-456-789-000. Leaves anything else untouched. */
export function formatTin(raw: string): string {
  const trimmed = raw.trim();
  if (!TIN_PATTERN.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/-/g, '');
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)];
  if (digits.length > 9) parts.push(digits.slice(9));
  return parts.join('-');
}

export type BillingDetailsValidation =
  | { ok: true; value: OrgBillingDetailsInput }
  | { ok: false; message: string; field: keyof OrgBillingDetailsInput };

export function validateBillingDetails(
  raw: Partial<OrgBillingDetailsInput>
): BillingDetailsValidation {
  const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const value: OrgBillingDetailsInput = {
    legalName: clean(raw.legalName),
    address: clean(raw.address).replace(/\s*\n\s*/g, ', '),
    tin: clean(raw.tin),
    billingEmail: clean(raw.billingEmail).toLowerCase(),
  };

  if (value.legalName.length > BILLING_DETAIL_LIMITS.legalName) {
    return { ok: false, field: 'legalName', message: 'Legal name is too long' };
  }
  if (value.address.length > BILLING_DETAIL_LIMITS.address) {
    return { ok: false, field: 'address', message: 'Address is too long' };
  }
  if (value.tin) {
    if (!TIN_PATTERN.test(value.tin)) {
      return {
        ok: false,
        field: 'tin',
        message: 'Enter a TIN like 123-456-789 or 123-456-789-000',
      };
    }
    value.tin = formatTin(value.tin);
  }
  if (value.billingEmail) {
    if (
      value.billingEmail.length > BILLING_DETAIL_LIMITS.billingEmail ||
      !EMAIL_PATTERN.test(value.billingEmail)
    ) {
      return { ok: false, field: 'billingEmail', message: 'Enter a valid billing email' };
    }
  }
  return { ok: true, value };
}
