/**
 * The arrival essentials a host fills in (guest journey plan D7).
 *
 * Order here is the order the editor renders. `secret` drives the masked input and the
 * "guests see this after the reveal time" note.
 */

export type EssentialsFieldKey =
  | 'wifiName'
  | 'wifiPassword'
  | 'doorCode'
  | 'unitFloor'
  | 'parkingSlotNote'
  | 'emergencyContactName'
  | 'emergencyContactPhone'
  | 'buildingSecurityPhone'
  | 'garbageSchedule'
  | 'quietHours';

export type EssentialsFieldSpec = {
  key: EssentialsFieldKey;
  label: string;
  placeholder: string;
  /** Hidden from guests until the reveal time. */
  secret?: boolean;
  /** Rendered as a telephone input. */
  phone?: boolean;
  multiline?: boolean;
};

export type EssentialsGroup = {
  id: string;
  title: string;
  fields: EssentialsFieldSpec[];
};

export const ESSENTIALS_GROUPS: EssentialsGroup[] = [
  {
    id: 'connect',
    title: 'Wi-Fi',
    fields: [
      { key: 'wifiName', label: 'Network name', placeholder: 'Kame_2604' },
      {
        key: 'wifiPassword',
        label: 'Password',
        placeholder: 'Enter the Wi-Fi password',
        secret: true,
      },
    ],
  },
  {
    id: 'access',
    title: 'Getting in',
    fields: [
      { key: 'doorCode', label: 'Door or lock code', placeholder: '4821', secret: true },
      // unitFloor: edited only when Basic Info has no tower/unit; otherwise read-only from listing.
      { key: 'unitFloor', label: 'Unit and floor', placeholder: 'Monaco 2604, 26th floor' },
      { key: 'parkingSlotNote', label: 'Parking tip', placeholder: 'Level 2, slot 27' },
    ],
  },
  {
    id: 'contacts',
    title: 'Contacts',
    fields: [
      { key: 'emergencyContactName', label: 'Emergency contact', placeholder: 'Ana' },
      {
        key: 'emergencyContactPhone',
        label: 'Emergency phone',
        placeholder: '0917 123 4567',
        phone: true,
      },
      {
        key: 'buildingSecurityPhone',
        label: 'Building security',
        placeholder: '0917 123 4567',
        phone: true,
      },
    ],
  },
  {
    id: 'house',
    title: 'Building notes',
    // Quiet hours live in House rules; keep the key for existing guest data but do not edit here.
    fields: [{ key: 'garbageSchedule', label: 'Garbage schedule', placeholder: 'Daily, 7:00 PM' }],
  },
];

/** Fields the Manage modal edits. Quiet hours stay on House rules. */
export const ESSENTIALS_EDITABLE_KEYS: EssentialsFieldKey[] = ESSENTIALS_GROUPS.flatMap((group) =>
  group.fields.map((field) => field.key)
);

/** All persisted keys, including legacy quiet hours no longer edited here. */
export const ESSENTIALS_FIELD_KEYS: EssentialsFieldKey[] = [
  ...ESSENTIALS_EDITABLE_KEYS,
  'quietHours',
];

const QUIET_HOURS_FIELD: EssentialsFieldSpec = {
  key: 'quietHours',
  label: 'Quiet hours',
  placeholder: '10:00 PM to 7:00 AM',
};

/** Flat lookup by key, for labels and per-field behaviour. */
export const ESSENTIALS_FIELDS = Object.fromEntries(
  [...ESSENTIALS_GROUPS.flatMap((group) => group.fields), QUIET_HOURS_FIELD].map((field) => [
    field.key,
    field,
  ])
) as Record<EssentialsFieldKey, EssentialsFieldSpec>;

/** Which keys differ between two drafts, so the save sends only what changed. */
export function changedEssentialsFields(
  baseline: Record<EssentialsFieldKey, string>,
  draft: Record<EssentialsFieldKey, string>
): EssentialsFieldKey[] {
  return ESSENTIALS_FIELD_KEYS.filter((key) => baseline[key] !== draft[key]);
}

export function guestEssentialsEqual(
  a: Record<EssentialsFieldKey, string> & { revealLeadHours: number },
  b: Record<EssentialsFieldKey, string> & { revealLeadHours: number }
): boolean {
  return a.revealLeadHours === b.revealLeadHours && changedEssentialsFields(a, b).length === 0;
}

/** Compact summary chips for the settings card (filled essentials only). */
export function summarizeGuestEssentials(
  draft: Record<EssentialsFieldKey, string> & { revealLeadHours: number },
  listingUnitLabel?: string | null
): { chips: string[]; empty: boolean; needsAttention: boolean } {
  const chips: string[] = [];
  if (draft.wifiName.trim()) chips.push(`Wi-Fi ${draft.wifiName.trim()}`);
  if (draft.doorCode.trim()) chips.push('Door code');
  const unit = draft.unitFloor.trim() || listingUnitLabel?.trim() || '';
  if (unit) chips.push(unit);
  if (draft.parkingSlotNote.trim()) chips.push('Parking tip');
  if (draft.emergencyContactPhone.trim() || draft.emergencyContactName.trim()) {
    chips.push('Contact');
  }
  if (draft.buildingSecurityPhone.trim()) chips.push('Security');
  if (draft.garbageSchedule.trim()) chips.push('Garbage');
  chips.push(`Reveal ${draft.revealLeadHours}h`);

  const hasCore =
    draft.wifiName.trim().length > 0 ||
    draft.wifiPassword.trim().length > 0 ||
    draft.doorCode.trim().length > 0 ||
    draft.emergencyContactPhone.trim().length > 0 ||
    draft.buildingSecurityPhone.trim().length > 0;

  return {
    chips,
    empty: !hasCore,
    needsAttention: !hasCore,
  };
}
