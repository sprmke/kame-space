import { useQuery } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import {
  GENERIC_RESIDENCE_PROFILE,
  type ResidenceProfile,
} from '@/lib/residence/residenceProfile';

/** Public slice returned by `list-residence-options` / `get-residence-profile`. */
export type ResidenceOption = {
  developmentId: string | null;
  name: string | null;
  type: string | null;
  structure: ResidenceProfile['structure'];
  location: ResidenceProfile['location'];
  occupancy: ResidenceProfile['occupancy'];
  stay: ResidenceProfile['stay'];
  terms: ResidenceProfile['terms'];
  copy: ResidenceProfile['copy'];
};

export const RESIDENCE_OPTIONS_QUERY_KEY = ['residence-options'] as const;

/** Turn the public DTO back into a full profile so the shared helpers can run. */
export function toResidenceProfile(option: ResidenceOption): ResidenceProfile {
  return {
    ...GENERIC_RESIDENCE_PROFILE,
    developmentId: option.developmentId,
    developmentName: option.name,
    developmentType: option.type,
    structure: option.structure,
    location: option.location,
    occupancy: option.occupancy,
    stay: option.stay,
    terms: option.terms,
    copy: option.copy,
  };
}

export function useResidenceOptions({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: RESIDENCE_OPTIONS_QUERY_KEY,
    queryFn: () =>
      callEdgeFunction<{ residences: ResidenceOption[] }>('list-residence-options'),
    staleTime: 5 * 60_000,
    enabled,
  });
}
