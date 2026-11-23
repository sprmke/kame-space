import { useEffect, useMemo, useState } from 'react';

import { ChevronDown, Loader2 } from 'lucide-react';

import { useSaveOrgBillingDetails } from '@/features/dashboard/plans/hooks/useOrgPlan';
import {
  BILLING_DETAIL_LIMITS,
  billingDetailsDirty,
  billingDetailsSummaryLine,
  validateBillingDetailsForm,
  type BillingDetailsErrors,
  type BillingDetailsForm,
} from '@/features/dashboard/plans/lib/billingDetailsForm';
import {
  OrgBillingApiError,
  type OrgBillingDetailsDto,
} from '@/features/dashboard/plans/lib/orgPlanApi';
import { planTabSectionTitleClass } from '@/features/dashboard/plans/lib/planPresentation';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { cn } from '@/lib/utils';

type OrgBillingDetailsCardProps = {
  orgId: string | null;
  details: OrgBillingDetailsDto | null | undefined;
  /** Only the organization owner edits; members see what receipts will show. */
  canEdit: boolean;
};

function toForm(details: OrgBillingDetailsDto | null | undefined): BillingDetailsForm {
  return {
    legalName: details?.legalName ?? '',
    address: details?.address ?? '',
    tin: details?.tin ?? '',
    billingEmail: details?.billingEmail ?? '',
  };
}

export function OrgBillingDetailsCard({ orgId, details, canEdit }: OrgBillingDetailsCardProps) {
  const saved = useMemo(() => toForm(details), [details]);
  const [form, setForm] = useState<BillingDetailsForm>(saved);
  const [errors, setErrors] = useState<BillingDetailsErrors>({});
  const [expanded, setExpanded] = useState(false);
  const save = useSaveOrgBillingDetails(orgId);

  // Pick up a refetch (or another tab's save) when the host has no edits of their own.
  const dirty = billingDetailsDirty(form, saved);
  useEffect(() => {
    if (!dirty) setForm(saved);
  }, [saved, dirty]);

  const summary = billingDetailsSummaryLine(saved);
  const hasSavedDetails = summary != null;

  const submit = async (): Promise<boolean> => {
    const found = validateBillingDetailsForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setExpanded(true);
      return false;
    }
    try {
      await save.mutateAsync(form);
      setExpanded(false);
      return true;
    } catch (err) {
      setExpanded(true);
      if (err instanceof OrgBillingApiError) {
        const message = err.message;
        // The server names the field that failed in the message text; show it inline.
        if (/TIN/i.test(message)) setErrors({ tin: message });
        else if (/email/i.test(message)) setErrors({ billingEmail: message });
        else setErrors({ legalName: message });
      }
      return false;
    }
  };

  useUnsavedChangesGuard({
    isDirty: canEdit && dirty,
    onSave: submit,
    onDiscard: () => {
      setForm(saved);
      setErrors({});
    },
    enabled: canEdit,
  });

  const set = (field: keyof BillingDetailsForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const collapse = () => {
    if (dirty) return;
    setExpanded(false);
    setErrors({});
  };

  const expand = () => setExpanded(true);

  const field = (
    id: keyof BillingDetailsForm,
    label: string,
    input: React.ReactNode,
    hint?: string
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`billing-${id}`}>{label}</Label>
      {input}
      {errors[id] ? (
        <p id={`billing-${id}-error`} role="alert" className="text-destructive text-xs">
          {errors[id]}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );

  return (
    <FloatingPanel as="section" padding="lg" aria-labelledby="billing-details-heading">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="billing-details-heading" className={planTabSectionTitleClass}>
            Billing details
          </h2>
          {!expanded ? (
            <p className="text-muted-foreground mt-1 text-sm">
              {hasSavedDetails
                ? summary
                : 'Optional. Printed on payment receipts when you add them.'}
            </p>
          ) : (
            <p className="text-muted-foreground mt-1 text-sm">
              Printed on your payment receipts. The billing email gets the same billing emails as
              the owner.
            </p>
          )}
        </div>

        {!expanded ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0 sm:min-h-10"
            aria-expanded={false}
            aria-controls="billing-details-panel"
            onClick={expand}
          >
            {canEdit ? (hasSavedDetails ? 'Edit' : 'Add') : 'View'}
            <ChevronDown className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 shrink-0 sm:min-h-10"
            aria-expanded={true}
            aria-controls="billing-details-panel"
            disabled={dirty}
            title={dirty ? 'Save or reset before collapsing' : undefined}
            onClick={collapse}
          >
            Collapse
            <ChevronDown className={cn('size-4 rotate-180', dirty && 'opacity-50')} aria-hidden />
          </Button>
        )}
      </div>

      {expanded ? (
        <form
          id="billing-details-panel"
          className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          noValidate
        >
          {field(
            'legalName',
            'Legal name',
            <Input
              id="billing-legalName"
              value={form.legalName}
              maxLength={BILLING_DETAIL_LIMITS.legalName}
              disabled={!canEdit}
              autoComplete="organization"
              aria-invalid={Boolean(errors.legalName)}
              aria-describedby={errors.legalName ? 'billing-legalName-error' : undefined}
              onChange={(event) => set('legalName', event.target.value)}
            />,
            'Optional. Printed on your payment receipts.'
          )}
          {field(
            'billingEmail',
            'Billing email',
            <Input
              id="billing-billingEmail"
              type="email"
              inputMode="email"
              value={form.billingEmail}
              maxLength={BILLING_DETAIL_LIMITS.billingEmail}
              disabled={!canEdit}
              autoComplete="email"
              aria-invalid={Boolean(errors.billingEmail)}
              aria-describedby={errors.billingEmail ? 'billing-billingEmail-error' : undefined}
              onChange={(event) => set('billingEmail', event.target.value)}
            />,
            'Optional. Billing emails also go to the owner.'
          )}
          {field(
            'tin',
            'TIN',
            <Input
              id="billing-tin"
              inputMode="numeric"
              value={form.tin}
              maxLength={BILLING_DETAIL_LIMITS.tin}
              disabled={!canEdit}
              placeholder="123-456-789-000"
              aria-invalid={Boolean(errors.tin)}
              aria-describedby={errors.tin ? 'billing-tin-error' : undefined}
              onChange={(event) => set('tin', event.target.value)}
            />,
            'Optional. Printed on receipts when you add it.'
          )}
          <div className="lg:col-span-3">
            {field(
              'address',
              'Address',
              <Textarea
                id="billing-address"
                value={form.address}
                maxLength={BILLING_DETAIL_LIMITS.address}
                disabled={!canEdit}
                rows={2}
                className="min-h-[72px]"
                autoComplete="street-address"
                aria-invalid={Boolean(errors.address)}
                aria-describedby={errors.address ? 'billing-address-error' : undefined}
                onChange={(event) => set('address', event.target.value)}
              />
            )}
          </div>

          {canEdit ? (
            <div className="flex items-end justify-end gap-2 lg:col-span-3">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                disabled={!dirty || save.isPending}
                onClick={() => {
                  setForm(saved);
                  setErrors({});
                }}
              >
                Reset
              </Button>
              <Button type="submit" className="min-h-[44px]" disabled={!dirty || save.isPending}>
                {save.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Save details
              </Button>
            </div>
          ) : null}
        </form>
      ) : null}
    </FloatingPanel>
  );
}
