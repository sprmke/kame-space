import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildGuestPaymentInfoDto,
  resolveAppSettingsFromRows,
  type AppSettingsRow,
} from './appSettings.ts';
import { buildGuestFormSettings, type GuestFormSettingsSource } from './guestFormSettings.ts';
import type { OrgSettingsRow } from './orgSettings.ts';
import { GENERIC_RESIDENCE_PROFILE, parseResidenceProfile } from './residenceProfile.ts';

const ORG_ROW: OrgSettingsRow = {
  id: 1,
  organization_id: 'org-1',
  updated_at: '2026-11-01T00:00:00.000Z',
  public_guest_app_origin: 'https://kamehomes.test',
  facebook_reviews_url: null,
  airbnb_url: null,
  instagram_url: null,
  tiktok_url: null,
  email_logo_url: null,
};

function settingsRow(overrides: Partial<AppSettingsRow> = {}): AppSettingsRow {
  return {
    id: 1,
    updated_at: '2026-11-01T00:00:00.000Z',
    email_to: 'pmo@azure.test',
    email_reply_to: 'ops@kamehomes.test',
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
    payment_methods: null,
    external_reviews: null,
    vouchers_enabled: null,
    voucher_prizes: null,
    voucher_reveal_style: null,
    document_requirements_override: null,
    ...overrides,
  };
}

function propertyRow(overrides: Partial<GuestFormSettingsSource> = {}): GuestFormSettingsSource {
  return {
    name: 'Monaco 2604',
    tower_and_unit: 'Monaco 2604',
    residence_name: 'Azure North Residences',
    development_id: 'dev-1',
    organization_id: 'org-1',
    settings: { maxAdults: 4, maxChildren: 0, allowPets: true },
    ...overrides,
  };
}

Deno.test('resolveAppSettingsFromRows: the property PMO email wins over the legacy column', () => {
  const resolved = resolveAppSettingsFromRows({
    settingsRow: settingsRow(),
    orgSettingsRow: ORG_ROW,
    residenceName: 'Azure North Residences',
    developmentPmoEmail: 'pmo@azure.test',
    brandColor: '#24a88e',
  });

  assertEquals(resolved.emailTo, 'pmo@azure.test');
  assertEquals(resolved.emailReplyTo, 'ops@kamehomes.test');
  assertEquals(resolved.gafUnitOwner, 'Maria Santos');
  assertEquals(resolved.gafTowerAndUnitNumber, 'Monaco 2604');
});

Deno.test(
  'resolveAppSettingsFromRows: a blank residence never borrows another building email',
  () => {
    const resolved = resolveAppSettingsFromRows({
      settingsRow: settingsRow({ email_to: null }),
      orgSettingsRow: ORG_ROW,
      residenceName: '',
      developmentPmoEmail: null,
      brandColor: '#24a88e',
    });

    assertEquals(resolved.emailTo, '');
    assertEquals(resolved.gafUnitOwner, 'Maria Santos');
  }
);

Deno.test('resolveAppSettingsFromRows: numeric fallbacks apply when the row is empty', () => {
  const resolved = resolveAppSettingsFromRows({
    settingsRow: null,
    orgSettingsRow: null,
    residenceName: '',
    developmentPmoEmail: null,
    brandColor: '#24a88e',
  });

  assertEquals(resolved.sdRefundCronEmailLeadMinutes, 120);
  assertEquals(resolved.sdRefundCronMaxCheckoutAgeDays, 30);
  assertEquals(resolved.defaultParkingRateGuest, 400);
  assertEquals(resolved.brandColor, '#24a88e');
});

Deno.test('buildGuestFormSettings: a building rule can only take an option away', () => {
  const profile = {
    ...GENERIC_RESIDENCE_PROFILE,
    stay: { ...GENERIC_RESIDENCE_PROFILE.stay, petsAllowed: false },
  };

  const settings = buildGuestFormSettings({
    property: propertyRow(),
    organizationName: 'Kame Homes',
    profile,
  });

  assertEquals(settings.allowPets, false);
});

Deno.test('buildGuestFormSettings: property caps clamp to the building cap', () => {
  const profile = {
    ...GENERIC_RESIDENCE_PROFILE,
    occupancy: { ...GENERIC_RESIDENCE_PROFILE.occupancy, maxAdultsCap: 4, maxChildrenCap: 2 },
  };

  const settings = buildGuestFormSettings({
    property: propertyRow({ settings: { maxAdults: 9, maxChildren: 5 } }),
    organizationName: 'Kame Homes',
    profile,
  });

  assertEquals(settings.maxAdults, 4);
  assertEquals(settings.maxChildren, 2);
});

Deno.test('buildGuestFormSettings: copies the residence age rules', () => {
  const profile = parseResidenceProfile({
    settings: {
      occupancy: {
        maxAdultsCap: 5,
        maxChildrenCap: 3,
        childMaxAge: 5,
        adultMinAge: 21,
        idRequiredFromAge: 16,
        primaryGuestMinAge: 21,
      },
    },
  });

  const settings = buildGuestFormSettings({
    property: propertyRow(),
    organizationName: 'Kame Homes',
    profile,
  });

  assertEquals(settings.childMaxAge, 5);
  assertEquals(settings.adultMinAge, 21);
  assertEquals(settings.idRequiredFromAge, 16);
  assertEquals(settings.primaryGuestMinAge, 21);
});

Deno.test('buildGuestPaymentInfoDto: an ACTIVE property accepts bookings', () => {
  const appSettings = resolveAppSettingsFromRows({
    settingsRow: settingsRow(),
    orgSettingsRow: ORG_ROW,
    residenceName: '',
    developmentPmoEmail: null,
    brandColor: '#24a88e',
  });
  const guestForm = buildGuestFormSettings({
    property: propertyRow(),
    organizationName: 'Kame Homes',
    profile: GENERIC_RESIDENCE_PROFILE,
  });

  const dto = buildGuestPaymentInfoDto({
    settings: appSettings,
    guestForm,
    petFee: 500,
    downPayment: 5000,
    status: 'ACTIVE',
    inactiveReason: null,
  });

  assertEquals(dto.listingState, 'live');
  assertEquals(dto.acceptingBookings, true);
  assertEquals(dto.petFee, 500);
  assertEquals(dto.downPayment, 5000);
  assertEquals(dto.gafTowerAndUnitNumber, 'Monaco 2604');
});

Deno.test(
  'buildGuestPaymentInfoDto: a paused property stops new bookings but keeps the page',
  () => {
    const appSettings = resolveAppSettingsFromRows({
      settingsRow: settingsRow(),
      orgSettingsRow: ORG_ROW,
      residenceName: '',
      developmentPmoEmail: null,
      brandColor: '#24a88e',
    });
    const guestForm = buildGuestFormSettings({
      property: propertyRow(),
      organizationName: 'Kame Homes',
      profile: GENERIC_RESIDENCE_PROFILE,
    });

    const dto = buildGuestPaymentInfoDto({
      settings: appSettings,
      guestForm,
      petFee: 0,
      downPayment: 0,
      status: 'INACTIVE',
      inactiveReason: 'paused',
    });

    assertEquals(dto.listingState, 'paused');
    assertEquals(dto.acceptingBookings, false);
  }
);

Deno.test('property eyebrow joins the unit and the residence', () => {
  const settings = buildGuestFormSettings({
    property: propertyRow(),
    organizationName: 'Kame Homes',
    profile: GENERIC_RESIDENCE_PROFILE,
  });

  assertEquals(settings.propertyEyebrow, 'Monaco 2604 · Azure North Residences');
});
