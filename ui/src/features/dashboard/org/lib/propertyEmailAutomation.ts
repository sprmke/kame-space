export const PROPERTY_AUTOMATION_TOGGLE_KEYS = [
  'emailNewBookingRequest',
  'emailBookingRequestReceived',
  'emailGafRequest',
  'emailBookingAcknowledgement',
  'emailPetRequest',
  'emailReadyForCheckin',
  'emailSdRefundCheckout',
  'emailReviewRequest',
  'emailReviewReminder',
  'emailPreArrivalReminder',
  'emailParkingReminder',
  'emailBuildingAdminCancellation',
] as const;

export type PropertyAutomationToggleKey = (typeof PROPERTY_AUTOMATION_TOGGLE_KEYS)[number];

export type PropertyAutomationToggles = Record<PropertyAutomationToggleKey, boolean>;

export const DEFAULT_PROPERTY_AUTOMATION_TOGGLES: PropertyAutomationToggles = {
  emailNewBookingRequest: true,
  emailBookingRequestReceived: true,
  emailGafRequest: true,
  emailBookingAcknowledgement: true,
  emailPetRequest: true,
  emailReadyForCheckin: true,
  emailSdRefundCheckout: true,
  emailReviewRequest: true,
  emailReviewReminder: true,
  emailPreArrivalReminder: true,
  emailParkingReminder: true,
  emailBuildingAdminCancellation: true,
};

/** Mirrors `_shared/propertyAutomationToggles.ts#PLAN_GATED_AUTOMATION_TOGGLE_KEYS`. */
export const PLAN_GATED_AUTOMATION_TOGGLE_KEYS: ReadonlySet<PropertyAutomationToggleKey> = new Set([
  'emailGafRequest',
  'emailBookingAcknowledgement',
  'emailPetRequest',
  'emailReadyForCheckin',
  'emailSdRefundCheckout',
  'emailPreArrivalReminder',
  'emailBuildingAdminCancellation',
]);

export type PropertyAutomationToggleGroup = {
  id: string;
  title: string;
  items: Array<{
    key: PropertyAutomationToggleKey;
    label: string;
    recipient: string;
    trigger: string;
    /** Template this email renders from. */
    templateKey: string;
  }>;
};

export const PROPERTY_AUTOMATION_TOGGLE_GROUPS: PropertyAutomationToggleGroup[] = [
  {
    id: 'team',
    title: 'Your team',
    items: [
      {
        key: 'emailNewBookingRequest',
        label: 'New booking alert',
        templateKey: 'email-new-booking-request',
        recipient: 'Team email',
        trigger: 'When a guest submits the booking form.',
      },
    ],
  },
  {
    id: 'building-admin',
    title: 'Building admin',
    items: [
      {
        key: 'emailGafRequest',
        label: 'GAF request',
        templateKey: 'email-gaf-request',
        recipient: 'Building admin email',
        trigger: 'When you approve a booking that needs building documents.',
      },
      {
        key: 'emailPetRequest',
        label: 'Pet request',
        templateKey: 'email-pet-request',
        recipient: 'Building admin email',
        trigger: 'When you approve a booking that includes a pet.',
      },
      {
        key: 'emailBuildingAdminCancellation',
        label: 'GAF cancellation',
        templateKey: 'email-building-admin-cancellation',
        recipient: 'Building admin email',
        trigger: 'When a booking with an approved GAF is cancelled.',
      },
    ],
  },
  {
    id: 'guest',
    title: 'Guest',
    items: [
      {
        key: 'emailBookingRequestReceived',
        label: 'Booking request received',
        templateKey: 'email-booking-request-received',
        recipient: 'Guest email',
        trigger: 'When a guest submits the booking form.',
      },
      {
        key: 'emailBookingAcknowledgement',
        label: 'Booking acknowledgement',
        templateKey: 'email-booking-acknowledgement',
        recipient: 'Guest email',
        trigger: 'When you approve the booking.',
      },
      {
        key: 'emailReadyForCheckin',
        label: 'Ready for check-in',
        templateKey: 'email-ready-for-checkin',
        recipient: 'Guest email',
        trigger: 'When all required documents are approved.',
      },
      {
        key: 'emailSdRefundCheckout',
        label: 'Check-out and deposit refund',
        templateKey: 'email-sd-refund-form-request',
        recipient: 'Guest email',
        trigger: 'Before check-out, using the timing above.',
      },
      {
        key: 'emailPreArrivalReminder',
        label: 'Arrival reminder',
        templateKey: 'email-pre-arrival-reminder',
        recipient: 'Guest email',
        trigger: 'Two days before check-in.',
      },
      {
        key: 'emailParkingReminder',
        label: 'Parking reminder',
        templateKey: 'email-parking-reminder',
        recipient: 'Guest email',
        trigger: 'When the guest asked for parking and has no slot yet.',
      },
    ],
  },
  {
    id: 'guest-reviews',
    title: 'Guest reviews',
    items: [
      {
        key: 'emailReviewRequest',
        label: 'Review request',
        templateKey: 'email-review-request',
        recipient: 'Guest email',
        trigger: 'After check-out when the review window opens.',
      },
      {
        key: 'emailReviewReminder',
        label: 'Review reminder',
        templateKey: 'email-review-reminder',
        recipient: 'Guest email',
        trigger: 'If the guest has not reviewed before the window closes.',
      },
    ],
  },
];

export function automationTogglesEqual(
  a: PropertyAutomationToggles,
  b: PropertyAutomationToggles
): boolean {
  return PROPERTY_AUTOMATION_TOGGLE_KEYS.every((key) => a[key] === b[key]);
}

export const SD_REFUND_CRON_EMAIL_LEAD_MAX_HOURS = 168;
