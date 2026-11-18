import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ORGANIZATIONS_QUERY_KEY } from '@/features/dashboard/org/hooks/useOrganizations';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { Property } from '@/features/dashboard/org/types';
import { orgPlanQueryKey } from '@/features/dashboard/plans/hooks/useOrgPlan';

/** What billing did with the new property. `covered` joins the plan now; `overdue` waits for payment. */
export type CreatePropertyBilling =
  | { status: 'covered'; trueUpPhp: number; nextRenewalPhp: number }
  | { status: 'overdue' }
  | { status: 'free' };

export type CreatePropertyInput = {
  orgId: string;
  orgSlug: string;
  name: string;
  tower: string;
  unitNumber: string;
  residenceName?: string;
};

export function useCreateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePropertyInput) =>
      callEdgeFunction<{
        property: Property;
        billing?: CreatePropertyBilling;
        billingRequired?: boolean;
      }>('create-property', {
        method: 'POST',
        body: JSON.stringify({
          orgId: input.orgId,
          name: input.name,
          tower: input.tower,
          unitNumber: input.unitNumber,
          residenceName: input.residenceName,
        }),
      }),
    onSuccess: (data, input) => {
      queryClient.setQueryData(
        ['properties', input.orgSlug],
        (old: { properties: Property[] } | undefined) => {
          const list = old?.properties ?? [];
          if (list.some((p) => p.id === data.property.id)) {
            return old ?? { properties: list };
          }
          return {
            properties: [...list, data.property].sort((a, b) => a.name.localeCompare(b.name)),
          };
        }
      );
      void queryClient.invalidateQueries({
        queryKey: ['properties', input.orgSlug],
      });
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
      // A covered property changes the plan total, the next payment and the credit/owed lines.
      if (
        data.billing?.status === 'covered' ||
        data.billing?.status === 'overdue' ||
        data.billingRequired
      ) {
        void queryClient.invalidateQueries({ queryKey: orgPlanQueryKey(input.orgId) });
      }
    },
  });
}
