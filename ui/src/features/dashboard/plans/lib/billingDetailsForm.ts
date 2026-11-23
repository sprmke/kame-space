/**
 * Billing details form rules. Mirrors `supabase/functions/_shared/orgBillingDetails.ts`; the server
 * is the authority and returns the field that failed.
 */

export type BillingDetailsForm = {
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
const TIN_PATTERN = /^\d{3}-?\d{3}-?\d{3}(?:-?\d{3,5})?$/;

export type BillingDetailsErrors = Partial<Record<keyof BillingDetailsForm, string>>;

export const EMPTY_BILLING_DETAILS: BillingDetailsForm = {
  legalName: '',
  address: '',
  tin: '',
  billingEmail: '',
};

export function validateBillingDetailsForm(form: BillingDetailsForm): BillingDetailsErrors {
  const errors: BillingDetailsErrors = {};
  if (form.legalName.trim().length > BILLING_DETAIL_LIMITS.legalName) {
    errors.legalName = 'Legal name is too long';
  }
  if (form.address.trim().length > BILLING_DETAIL_LIMITS.address) {
    errors.address = 'Address is too long';
  }
  const tin = form.tin.trim();
  if (tin && !TIN_PATTERN.test(tin)) {
    errors.tin = 'Enter a TIN like 123-456-789 or 123-456-789-000';
  }
  const email = form.billingEmail.trim();
  if (email && (email.length > BILLING_DETAIL_LIMITS.billingEmail || !EMAIL_PATTERN.test(email))) {
    errors.billingEmail = 'Enter a valid billing email';
  }
  return errors;
}

/** What the form holds vs what is saved, ignoring whitespace-only differences. */
export function billingDetailsDirty(a: BillingDetailsForm, b: BillingDetailsForm): boolean {
  const norm = (value: string) => value.trim();
  return (
    norm(a.legalName) !== norm(b.legalName) ||
    norm(a.address) !== norm(b.address) ||
    norm(a.tin) !== norm(b.tin) ||
    norm(a.billingEmail).toLowerCase() !== norm(b.billingEmail).toLowerCase()
  );
}

/** Compact one-line summary for the collapsed Billing details card; null when empty. */
export function billingDetailsSummaryLine(form: BillingDetailsForm): string | null {
  const legalName = form.legalName.trim();
  const tin = form.tin.trim();
  const email = form.billingEmail.trim();
  const address = form.address.trim();
  const parts = [legalName || null, tin ? `TIN ${tin}` : null, email || null].filter(
    Boolean
  ) as string[];
  if (parts.length > 0) return parts.join(' · ');
  if (address) return address.length > 72 ? `${address.slice(0, 69)}…` : address;
  return null;
}
