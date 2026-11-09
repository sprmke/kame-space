import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import { DEFAULT_RESIDENCE_NAME } from '@/features/dashboard/org/lib/propertyDisplay';
import {
  isPropertyTowerForResidence,
  isValidUnitNumber,
} from '@/features/dashboard/org/lib/propertyTowerUnit';
import type { PropertyTowerUnitConflict } from '@/features/dashboard/org/lib/propertyTowerUnitConflict';
import type { Property } from '@/features/dashboard/org/types';

import {
  unitNumberError,
  validateTowerForProfile,
  type ResidenceProfile,
} from '@/lib/residence/residenceProfile';

type CheckTowerUnitResponse = {
  available: boolean;
  hasActiveListing?: boolean;
  message: string | null;
  conflict: {
    propertyId: string;
    propertyName: string;
    orgName: string | null;
  } | null;
};

export type TowerUnitResidenceContext = {
  developmentId?: string | null;
  residenceName?: string | null;
  /** When present, validation uses the residence format instead of the legacy Azure rule. */
  profile?: ResidenceProfile | null;
};

export function useTowerUnitConflict(
  tower: string,
  unitNumber: string,
  excludePropertyId?: string,
  residence?: TowerUnitResidenceContext
): {
  conflict: PropertyTowerUnitConflict | null;
  /** ACTIVE peer already lists this tower+unit — warning only, not a create block. */
  hasActiveListing: boolean;
  /** Alias of hasActiveListing (legacy call sites). */
  hasDuplicate: boolean;
  isChecking: boolean;
  message: string | null;
} {
  const profile = residence?.profile ?? null;
  const ready = profile
    ? validateTowerForProfile(profile, tower).ok &&
      unitNumber.trim().length > 0 &&
      unitNumberError(profile, unitNumber) === null
    : isPropertyTowerForResidence(tower, DEFAULT_RESIDENCE_NAME) && isValidUnitNumber(unitNumber);

  const developmentId = residence?.developmentId ?? profile?.developmentId ?? null;
  const residenceName = residence?.residenceName ?? profile?.developmentName ?? null;

  const query = useQuery({
    queryKey: [
      'check-tower-unit',
      tower,
      unitNumber,
      excludePropertyId,
      developmentId,
      residenceName,
    ] as const,
    enabled: ready,
    staleTime: 30_000,
    queryFn: () => {
      const params = new URLSearchParams({
        tower,
        unitNumber,
      });
      if (excludePropertyId) {
        params.set('excludePropertyId', excludePropertyId);
      }
      if (developmentId) {
        params.set('developmentId', developmentId);
      }
      if (residenceName) {
        params.set('residenceName', residenceName);
      }
      return callEdgeFunction<CheckTowerUnitResponse>(`check-tower-unit?${params.toString()}`);
    },
  });

  const hasActiveListing = Boolean(query.data?.hasActiveListing && query.data.conflict);

  const conflict = useMemo((): PropertyTowerUnitConflict | null => {
    const row = query.data?.conflict;
    if (!hasActiveListing || !row) return null;

    return {
      property: {
        id: row.propertyId,
        name: row.propertyName,
      } as Property,
      orgName: row.orgName ?? '',
      orgSlug: '',
    };
  }, [hasActiveListing, query.data?.conflict]);

  return {
    conflict,
    hasActiveListing,
    hasDuplicate: hasActiveListing,
    isChecking: ready && query.isFetching,
    message: query.data?.message ?? null,
  };
}
