/**
 * Azure North scenario for the golden set.
 *
 * The rows below stand in for what production holds for Azure North today. They are
 * deliberately plain JSON (no database, no network) so `azure-golden.ts` can run anywhere,
 * including CI, and produce the same bytes every time.
 *
 * Rules for editing this file:
 * - Only change a value when the real Azure row changed. A change here is a golden diff.
 * - Keep names, emails and addresses fictional. This file is committed.
 * - The check-in date is far in the future so the same-day "urgent" branch stays off.
 *   Both urgent and non-urgent subjects are snapshotted explicitly instead.
 */

import type { AppSettingsRow } from '../../../supabase/functions/_shared/appSettings.ts';
import type { OrgSettingsRow } from '../../../supabase/functions/_shared/orgSettings.ts';
import type { GuestFormSettingsSource } from '../../../supabase/functions/_shared/guestFormSettings.ts';
import type { GuestFacingContactInfo } from '../../../supabase/functions/_shared/guestContactInfo.ts';
import type { GuestFormData, GuestSubmission } from '../../../supabase/functions/_shared/types.ts';
import { DEFAULT_ORG_BRAND_COLOR } from '../../../supabase/functions/_shared/orgSettingsValidation.ts';

export const AZURE_PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
export const AZURE_ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
export const AZURE_DEVELOPMENT_ID = '33333333-3333-4333-8333-333333333333';

export const AZURE_RESIDENCE_NAME = 'Azure North Residences';
export const AZURE_ORGANIZATION_NAME = 'Kame Homes';
export const AZURE_BRAND_COLOR = DEFAULT_ORG_BRAND_COLOR;
export const AZURE_FROM_EMAIL = 'bookings@kamehomes.test';
export const AZURE_PMO_EMAIL = 'stlmonaco.theresortresidences@azurenorth.com.ph';
export const AZURE_PROPERTY_SLUG = 'monaco-2604';

/** `developments` row — Azure's rulebook as it exists today. */
export const AZURE_DEVELOPMENT_ROW = {
  id: AZURE_DEVELOPMENT_ID,
  name: AZURE_RESIDENCE_NAME,
  slug: 'azure-north-residences',
  type: 'CONDOMINIUM',
  status: 'ACTIVE',
  settings: {
    pmoEmail: AZURE_PMO_EMAIL,
    structure: {
      towerLabel: 'Tower',
      unitLabel: 'Unit',
      towersRequired: true,
      propertyTowers: ['Monaco', 'Bali', 'Barbados'],
      parkingTowers: [
        {
          name: 'Monaco',
          code: 'Monaco',
          levels: ['B1', 'B2', 'B3', 'G'],
          parkingType: 'inside_tower',
        },
        {
          name: 'Bali',
          code: 'Bali',
          levels: ['B1', 'B2', 'B3', 'G'],
          parkingType: 'inside_tower',
        },
        {
          name: 'Barbados',
          code: 'Barbados',
          levels: ['B1', 'B2', 'B3', 'G'],
          parkingType: 'inside_tower',
        },
        { name: 'Bay', code: 'BY', levels: ['G'], parkingType: 'outside_tower' },
      ],
      unitNumberFormat: { preset: 'digits4', example: '2604' },
      parkingSlotFormat: { preset: 'digits1to4', example: 'B2-27' },
      floorsMax: 29,
    },
    occupancy: {
      maxAdultsCap: 6,
      maxChildrenCap: 4,
      childMaxAge: 3,
      adultMinAge: 18,
      idRequiredFromAge: 18,
      primaryGuestMinAge: 18,
    },
    stay: {
      checkInTime: '14:00',
      checkOutTime: '12:00',
      petsAllowed: true,
      paidParkingAvailable: true,
      surpriseDecorAllowed: true,
      petTypes: ['Dog', 'Cat'],
      petVaccinationRequired: true,
    },
    workflowDefaults: {
      documentRequirements: [
        {
          id: 'gaf',
          label: 'GAF Request',
          order: 1,
          pdfTemplateId: 'gaf',
          approvalSource: 'email-listener',
          triggerCondition: 'always',
          calendarIcon: null,
        },
        {
          id: 'pet',
          label: 'Pet Approval',
          order: 2,
          pdfTemplateId: 'pet',
          approvalSource: 'email-listener',
          triggerCondition: 'has_pets',
          calendarIcon: '🐶',
        },
      ],
    },
  },
};

/** `properties` row for Monaco 2604. */
export const AZURE_PROPERTY_ROW: GuestFormSettingsSource = {
  name: 'Monaco 2604',
  tower_and_unit: 'Monaco 2604',
  residence_name: AZURE_RESIDENCE_NAME,
  development_id: AZURE_DEVELOPMENT_ID,
  organization_id: AZURE_ORGANIZATION_ID,
  settings: {
    maxAdults: 4,
    maxChildren: 0,
    allowPets: true,
    allowParking: true,
    allowSurpriseDecor: true,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    cleaningBufferMinutes: 240,
    media: [],
  },
};

/** `app_settings` row for Monaco 2604. */
export const AZURE_APP_SETTINGS_ROW: AppSettingsRow = {
  id: 1,
  updated_at: '2026-11-01T00:00:00.000Z',
  email_to: AZURE_PMO_EMAIL,
  email_reply_to: 'approvals+monaco-2604@inbound.kamehomes.test',
  sd_refund_cron_email_lead_minutes: null,
  sd_refund_cron_max_checkout_age_days: null,
  default_parking_rate_guest: 400,
  automation_toggles: null,
  gcash_name: 'Maria Santos',
  gcash_number: '0917 123 4567',
  gcash_qr_image_url: null,
  payment_provider: 'gcash',
  gaf_unit_owner: 'Maria Santos',
  gaf_tower_and_unit_number: 'Monaco 2604',
  gaf_guests_onsite_contact_person: 'Ana Lim',
  gaf_owner_contact_number: '+63 917 123 4567',
  gaf_unit_owner_signature_url: null,
  brand_color: null,
  facebook_reviews_url: null,
  airbnb_url: null,
  instagram_url: null,
  tiktok_url: null,
  payment_methods: [
    {
      id: 'gcash-primary',
      provider: 'gcash',
      accountName: 'Maria Santos',
      accountNumber: '0917 123 4567',
      qrImageUrl: null,
      isPrimary: true,
    },
  ],
  external_reviews: null,
  vouchers_enabled: null,
  voucher_prizes: null,
  voucher_reveal_style: null,
  document_requirements_override: null,
};

/** `org_settings` row for the host organization. */
export const AZURE_ORG_SETTINGS_ROW: OrgSettingsRow = {
  id: 1,
  organization_id: AZURE_ORGANIZATION_ID,
  updated_at: '2026-11-01T00:00:00.000Z',
  public_guest_app_origin: 'https://kamehomes.test',
  facebook_reviews_url: null,
  airbnb_url: null,
  instagram_url: null,
  tiktok_url: null,
  email_logo_url: null,
};

/** Pricing values `get-guest-payment-info` exposes on the Payment step. */
export const AZURE_PRICING = { petFee: 500, downPayment: 5000 };

/** `properties` lifecycle columns. */
export const AZURE_PROPERTY_STATUS = { status: 'ACTIVE', inactiveReason: null };

/** Guest form submission used for the PDF and email snapshots. */
export const AZURE_GUEST_FORM = {
  guestFacebookName: '',
  primaryGuestName: 'Kyle Santos',
  guestEmail: 'kyle.santos@example.test',
  guestPhoneNumber: '0917 555 0134',
  guestAddress: '12 Mabini Street, Makati City',
  checkInDate: '2027-03-14',
  checkOutDate: '2027-03-17',
  findUs: 'Facebook',
  bookingSource: 'Facebook',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  nationality: 'Filipino',
  numberOfAdults: 2,
  numberOfChildren: 0,
  numberOfNights: 3,
  primaryGuestAge: 32,
  guest2Name: 'Ana Reyes',
  guest2Age: 29,
  guestSpecialRequests: 'One extra towel please.',
  guestRequestsSurpriseDecor: false,
  needParking: true,
  parkingSameAsBookingDuration: true,
  carPlateNumber: 'ABC 1234',
  carBrandModel: 'Toyota Vios',
  carColor: 'Silver',
  carparkSlotNumber: 'B2-27',
  hasPets: true,
  petName: 'Biscuit',
  petType: 'Dog',
  petBreed: 'Shih Tzu',
  petAge: '3 years',
  petVaccinationDate: '2027-01-20',
  unitOwner: '',
  towerAndUnitNumber: '',
  ownerOnsiteContactPerson: '',
  ownerContactNumber: '',
} satisfies GuestFormData;

/** Booking row used for the ready-for-check-in email. */
export const AZURE_BOOKING = {
  id: '44444444-4444-4444-8444-444444444444',
  property_id: AZURE_PROPERTY_ID,
  guest_facebook_name: '',
  primary_guest_name: 'Kyle Santos',
  guest_email: 'kyle.santos@example.test',
  guest_phone_number: '0917 555 0134',
  guest_address: '12 Mabini Street, Makati City',
  check_in_date: '2027-03-14',
  check_out_date: '2027-03-17',
  check_in_time: '14:00',
  check_out_time: '12:00',
  nationality: 'Filipino',
  number_of_adults: 2,
  number_of_children: 0,
  number_of_nights: 3,
  primary_guest_age: 32,
  guest2_name: 'Ana Reyes',
  guest2_age: 29,
  find_us: 'Facebook',
  booking_source: 'Facebook',
  guest_requests_surprise_decor: false,
  need_parking: true,
  car_plate_number: 'ABC 1234',
  car_brand_model: 'Toyota Vios',
  car_color: 'Silver',
  has_pets: true,
  pet_name: 'Biscuit',
  pet_type: 'Dog',
  pet_breed: 'Shih Tzu',
  pet_age: '3 years',
  pet_vaccination_date: '2027-01-20',
  payment_receipt_url: '',
  unit_owner: 'Maria Santos',
  tower_and_unit_number: 'Monaco 2604',
  owner_onsite_contact_person: 'Ana Lim',
  owner_contact_number: '+63 917 123 4567',
  booking_rate: 8500,
  down_payment: 2500,
  balance: 6000,
  security_deposit: 3000,
  parking_rate_guest: 400,
  pet_fee: 500,
  guest_additional_fee: 0,
  status: 'READY_FOR_CHECKIN',
  approved_gaf_pdf_url: null,
  approved_pet_pdf_url: null,
} satisfies GuestSubmission;

/** Contact block the ready-for-check-in email renders. */
export const AZURE_GUEST_CONTACT: GuestFacingContactInfo = {
  facebookPageUrl: '',
  airbnbUrl: '',
  contactName: 'Ana Lim',
  contactPhone: '+63 917 123 4567',
  contactEmail: 'bookings@kamehomes.test',
};

export const AZURE_STAY_GUIDE_URL = 'https://kamehomes.test/stay/azure-north/monaco-2604';
