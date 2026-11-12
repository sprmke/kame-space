/**
 * Public slice of a Residence Profile.
 *
 * Hosts and guests may read how a building is laid out (towers, unit format, parking
 * levels, occupancy caps, terms, copy). They must never receive the approval recipients,
 * PDF templates or document requirement wiring, so this module is the only shape the
 * public read endpoints return.
 */

import type { ResidenceProfile } from './residenceProfile.ts';
import { parseResidenceProfile } from './residenceProfile.ts';

export type PublicResidenceProfile = {
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

export function toPublicResidenceProfile(profile: ResidenceProfile): PublicResidenceProfile {
  return {
    developmentId: profile.developmentId,
    name: profile.developmentName,
    type: profile.developmentType,
    structure: profile.structure,
    location: profile.location,
    occupancy: profile.occupancy,
    stay: profile.stay,
    terms: profile.terms,
    copy: profile.copy,
  };
}

type DevelopmentRowForOptions = {
  id: string;
  name: string;
  slug: string;
  type: string;
  settings: unknown;
};

/** One entry per ACTIVE development, newest-safe ordering left to the caller. */
export function buildResidenceOptions(rows: DevelopmentRowForOptions[]): PublicResidenceProfile[] {
  return rows.map((row) => toPublicResidenceProfile(parseResidenceProfile(row)));
}
