import { scopedAdminPath } from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import type { EssentialsFieldKey } from '@/features/dashboard/guest-experience/lib/guestEssentialsFields';

export type GuestEssentialsDraft = Record<EssentialsFieldKey, string> & {
  revealLeadHours: number;
};

export const EMPTY_GUEST_ESSENTIALS: GuestEssentialsDraft = {
  wifiName: '',
  wifiPassword: '',
  doorCode: '',
  unitFloor: '',
  parkingSlotNote: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  buildingSecurityPhone: '',
  garbageSchedule: '',
  quietHours: '',
  revealLeadHours: 24,
};

/** Loads the host's essentials. All strings, so inputs stay controlled. */
export async function fetchGuestEssentials(propertyId: string): Promise<GuestEssentialsDraft> {
  const payload = await callEdgeFunction<{ essentials: GuestEssentialsDraft }>(
    scopedAdminPath('property-guest-essentials', propertyId)
  );
  return { ...EMPTY_GUEST_ESSENTIALS, ...(payload.essentials ?? {}) };
}

/** Saves only the fields that changed, so one edit cannot clear the rest. */
export async function saveGuestEssentials(
  propertyId: string,
  draft: GuestEssentialsDraft,
  changed: EssentialsFieldKey[]
): Promise<GuestEssentialsDraft> {
  const essentials: Record<string, string | number> = {};
  for (const field of changed) essentials[field] = draft[field];
  // The reveal lead is always written: it is a single control, not a field the user edits
  // per keystroke, so there is no "unchanged" state to preserve.
  essentials.revealLeadHours = draft.revealLeadHours;

  const payload = await callEdgeFunction<{ essentials: GuestEssentialsDraft }>(
    'property-guest-essentials',
    {
      method: 'PATCH',
      body: JSON.stringify({ property_id: propertyId, essentials }),
    }
  );
  return { ...EMPTY_GUEST_ESSENTIALS, ...(payload.essentials ?? {}) };
}
