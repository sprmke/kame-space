#!/usr/bin/env -S deno run --allow-env --allow-read --allow-write --allow-import
/**
 * Azure golden set — the release gate for the multi-residence work.
 *
 * Phase 3 replaces the hardcoded GAF/pet behavior with per-residence configuration. This
 * script captures what Azure North gets today through the real production functions, so a
 * change to any of these surfaces is a reviewed diff instead of a shipped surprise:
 *
 *   - `resolveAppSettings`            (operator settings)
 *   - `get-guest-payment-info`        (guest payment DTO)
 *   - guest-form settings             (caps, locks, times)
 *   - resolved document requirements  (+ which steps apply to which booking)
 *   - GAF and pet PDF field values
 *   - GAF / pet / ready-for-check-in email HTML and subjects
 *   - status + step titles used on the calendar and booking rail
 *
 * No database, no network, no storage: `azureScenario.ts` supplies the rows and the code
 * under test is the same code production runs. That is what lets this run in CI.
 *
 * Usage:
 *   deno run --allow-env --allow-read --allow-write --allow-import \
 *     --config supabase/functions/deno.json scripts/dev/golden/azure-golden.ts           # write
 *   deno run --allow-env --allow-read --allow-write --allow-import \
 *     --config supabase/functions/deno.json scripts/dev/golden/azure-golden.ts --check   # verify
 *
 * Or `bun run golden:azure` / `bun run check:azure-golden`.
 *
 * If a diff is intentional and Azure stays byte-identical, rewrite with `bun run golden:azure`
 * and read the HTML diff before committing.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  applyGafDefaults,
  buildGuestPaymentInfoDto,
  resolveAppSettingsFromRows,
  type AppSettingsResolved,
} from '../../../supabase/functions/_shared/appSettings.ts';
import {
  hasApplicableDocumentPdfTemplate,
  mergeDocumentRequirements,
  requirementApplies,
  requirementDocKind,
} from '../../../supabase/functions/_shared/documentRequirements.ts';
import { buildGuestFacingPlaceholderVars } from '../../../supabase/functions/_shared/guestContactInfo.ts';
import { buildGuestFormSettings } from '../../../supabase/functions/_shared/guestFormSettings.ts';
import {
  buildGafPdfFieldMap,
  buildPetPdfFieldMap,
} from '../../../supabase/functions/_shared/gafPdfFields.ts';
import {
  buildPropertyEmailBranding,
  resolveEmailUnitLabel,
  type PropertyEmailBranding,
} from '../../../supabase/functions/_shared/propertyEmailBranding.ts';
import {
  buildBookingPlaceholderVars,
  buildEmailHeaderLogoHtml,
  buildGuestFormPlaceholderVars,
  renderTemplateSendEmailHtml,
} from '../../../supabase/functions/_shared/propertyTemplateEmail.ts';
import {
  buildDocumentRemindersSectionFromBooking,
  buildEmailSignatureSectionHtml,
  buildPaymentBreakdownSectionFromBooking,
  buildPetAttachmentsSectionHtml,
  buildPetDetailsSectionFromGuestForm,
  buildReadyForCheckinBookingSummaryFromBooking,
  buildReadyForCheckinContactSectionHtml,
  buildStayGuideCtaHtml,
  buildUrgentSameDayCallout,
  computeReadyForCheckinTotalDue,
  formatPeso,
} from '../../../supabase/functions/_shared/propertyTemplateEmailSections.ts';
import { getBuiltinPropertyTemplate } from '../../../supabase/functions/_shared/propertyTemplates.ts';
import { loadEmailTemplate } from '../../../supabase/functions/_shared/renderEmailHtml.ts';
import { parseResidenceProfile } from '../../../supabase/functions/_shared/residenceProfile.ts';
import { buildStayGuideCheckInDocuments } from '../../../supabase/functions/_shared/stayGuideCheckInDocuments.ts';
import {
  PIPELINE_ORDER,
  STATUS_HUMAN_LABEL,
} from '../../../supabase/functions/_shared/statusMachine.ts';
import {
  buildGafRequestSubject,
  buildPetRequestSubject,
  buildReadyForCheckinSubject,
} from '../../../supabase/functions/_shared/workflowEmailSubjects.ts';

import {
  AZURE_APP_SETTINGS_ROW,
  AZURE_BOOKING,
  AZURE_BRAND_COLOR,
  AZURE_DEVELOPMENT_ROW,
  AZURE_FROM_EMAIL,
  AZURE_GUEST_CONTACT,
  AZURE_GUEST_FORM,
  AZURE_ORG_SETTINGS_ROW,
  AZURE_ORGANIZATION_NAME,
  AZURE_PMO_EMAIL,
  AZURE_PRICING,
  AZURE_PROPERTY_ROW,
  AZURE_PROPERTY_SLUG,
  AZURE_PROPERTY_STATUS,
  AZURE_RESIDENCE_NAME,
  AZURE_STAY_GUIDE_URL,
} from './azureScenario.ts';
import type { GuestSubmission } from '../../../supabase/functions/_shared/types.ts';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');
const JSON_FIXTURE = join(FIXTURES_DIR, 'azure-golden.json');

/** The three emails whose HTML is snapshotted. */
const EMAIL_FILES = {
  gaf: 'email-gaf-request.html',
  pet: 'email-pet-request.html',
  readyForCheckin: 'email-ready-for-checkin.html',
} as const;

/** Check-in / check-out as the emails render them (`MMM D, YYYY`). */
const DISPLAY_CHECK_IN = 'Mar 14, 2027';
const DISPLAY_CHECK_OUT = 'Mar 17, 2027';

/** Booking shapes the approval steps are evaluated against. */
const BOOKING_SHAPES = [
  { label: 'no_pets_no_parking', has_pets: false, need_parking: false },
  { label: 'pets_no_parking', has_pets: true, need_parking: false },
  { label: 'pets_and_parking', has_pets: true, need_parking: true },
  { label: 'string_true_flags', has_pets: 'true', need_parking: 'true' },
] as const;

type EmailSnapshot = { subject: string; html: string };

function builtinContent(key: string): string {
  const template = getBuiltinPropertyTemplate(key);
  if (!template) throw new Error(`Missing built-in property template: ${key}`);
  return template.defaultContent;
}

async function buildEmails(
  settings: AppSettingsResolved,
  branding: PropertyEmailBranding,
  unitLabel: string
): Promise<Record<keyof typeof EMAIL_FILES, EmailSnapshot>> {
  const shell = await loadEmailTemplate('fragments/configurable-template-send');
  const headerLogoHtml = buildEmailHeaderLogoHtml(
    await loadEmailTemplate('fragments/email-header-logo'),
    settings,
    branding.organizationName
  );
  const fd = applyGafDefaults(AZURE_GUEST_FORM, settings);
  const booking = AZURE_BOOKING;

  const gaf: EmailSnapshot = {
    subject: buildGafRequestSubject({
      unitLabel,
      displayCheckInDate: DISPLAY_CHECK_IN,
      displayCheckOutDate: DISPLAY_CHECK_OUT,
      isUrgent: false,
      isUpdate: false,
    }),
    html: renderTemplateSendEmailHtml({
      settings,
      branding,
      shell,
      headerLogoHtml,
      content: builtinContent('email-gaf-request'),
      templateKey: 'email-gaf-request',
      emailTitle: 'Guest Advise Form Request',
      placeholderVars: buildGuestFormPlaceholderVars(
        fd,
        settings,
        {
          urgent_notice: buildUrgentSameDayCallout(false),
          update_notice: '',
          email_signature_section: buildEmailSignatureSectionHtml(settings.gafUnitOwner, unitLabel),
        },
        branding
      ),
    }),
  };

  const pet: EmailSnapshot = {
    subject: buildPetRequestSubject({
      unitLabel,
      displayCheckInDate: DISPLAY_CHECK_IN,
      displayCheckOutDate: DISPLAY_CHECK_OUT,
      isUrgent: false,
      isUpdate: false,
    }),
    html: renderTemplateSendEmailHtml({
      settings,
      branding,
      shell,
      headerLogoHtml,
      content: builtinContent('email-pet-request'),
      templateKey: 'email-pet-request',
      emailTitle: 'Pet Registration Request',
      placeholderVars: buildGuestFormPlaceholderVars(
        fd,
        settings,
        {
          urgent_notice: buildUrgentSameDayCallout(false),
          update_notice: '',
          pet_details_section: buildPetDetailsSectionFromGuestForm(fd, settings.brandColor),
          pet_attachments_section: buildPetAttachmentsSectionHtml(settings.brandColor),
          email_signature_section: buildEmailSignatureSectionHtml(settings.gafUnitOwner, unitLabel),
        },
        branding
      ),
    }),
  };

  // Guest booking links are signed with a time-limited token (`exp` = now + TTL), so a
  // golden snapshot of them could never be stable. Stable stand-ins keep the copy honest.
  const linkExtras = {
    property_slug: AZURE_PROPERTY_SLUG,
    form_url: `${settings.publicGuestAppOrigin}/book/${AZURE_PROPERTY_SLUG}`,
    sd_form_url: `${settings.publicGuestAppOrigin}/sd-form/${AZURE_PROPERTY_SLUG}`,
    review_url: `${settings.publicGuestAppOrigin}/review/${AZURE_PROPERTY_SLUG}`,
    trip_url: `${settings.publicGuestAppOrigin}/trips`,
  };
  const totalDueAtCheckin = computeReadyForCheckinTotalDue(booking);

  const readyForCheckin: EmailSnapshot = {
    subject: buildReadyForCheckinSubject({
      unitLabel,
      displayCheckInDate: DISPLAY_CHECK_IN,
      displayCheckOutDate: DISPLAY_CHECK_OUT,
    }),
    html: renderTemplateSendEmailHtml({
      settings,
      branding,
      shell,
      headerLogoHtml,
      content: builtinContent('email-ready-for-checkin'),
      templateKey: 'email-ready-for-checkin',
      emailTitle: "You're all set & ready for check-in!",
      placeholderVars: buildBookingPlaceholderVars(
        booking,
        settings,
        {
          ...linkExtras,
          ...buildGuestFacingPlaceholderVars(AZURE_GUEST_CONTACT),
          ready_for_checkin_booking_summary_section: buildReadyForCheckinBookingSummaryFromBooking(
            booking,
            branding,
            settings.brandColor
          ),
          document_reminders_section: buildDocumentRemindersSectionFromBooking(
            booking,
            settings.brandColor
          ),
          payment_breakdown_section:
            totalDueAtCheckin > 0
              ? buildPaymentBreakdownSectionFromBooking(
                  booking,
                  formatPeso,
                  totalDueAtCheckin,
                  settings.brandColor
                )
              : '',
          // Payment QR images come from Storage; the golden set covers the copy, not the files.
          gcash_payment_section: '',
          ready_for_checkin_contact_section: buildReadyForCheckinContactSectionHtml(
            AZURE_GUEST_CONTACT,
            settings.brandColor
          ),
          stay_guide_cta_section: buildStayGuideCtaHtml(AZURE_STAY_GUIDE_URL, settings.brandColor),
          email_signature_section: buildEmailSignatureSectionHtml(settings.gafUnitOwner, unitLabel),
        },
        branding
      ),
    }),
  };

  return { gaf, pet, readyForCheckin };
}

async function buildAll() {
  const profile = parseResidenceProfile(AZURE_DEVELOPMENT_ROW);

  const appSettings = resolveAppSettingsFromRows({
    settingsRow: AZURE_APP_SETTINGS_ROW,
    orgSettingsRow: AZURE_ORG_SETTINGS_ROW,
    residenceName: AZURE_RESIDENCE_NAME,
    developmentPmoEmail: AZURE_PMO_EMAIL,
    brandColor: AZURE_BRAND_COLOR,
  });

  const guestFormSettings = buildGuestFormSettings({
    property: AZURE_PROPERTY_ROW,
    organizationName: AZURE_ORGANIZATION_NAME,
    profile,
  });

  const guestPaymentInfo = buildGuestPaymentInfoDto({
    settings: appSettings,
    guestForm: guestFormSettings,
    petFee: AZURE_PRICING.petFee,
    downPayment: AZURE_PRICING.downPayment,
    status: AZURE_PROPERTY_STATUS.status,
    inactiveReason: AZURE_PROPERTY_STATUS.inactiveReason,
  });

  const residenceRequirements = mergeDocumentRequirements(
    AZURE_DEVELOPMENT_ROW.settings.workflowDefaults.documentRequirements
  );

  const pendingBooking: GuestSubmission = { ...AZURE_BOOKING };
  const readyBooking: GuestSubmission = {
    ...AZURE_BOOKING,
    approved_gaf_pdf_url: 'https://storage.test/templates/approved-gaf.pdf',
    approved_pet_pdf_url: 'https://storage.test/templates/approved-pet.pdf',
    gaf_completed_at: '2027-02-01T00:00:00.000Z',
    pet_completed_at: '2027-02-01T00:00:00.000Z',
  };

  const fd = applyGafDefaults(AZURE_GUEST_FORM, appSettings);

  const branding = buildPropertyEmailBranding({
    settings: appSettings,
    property: {
      name: AZURE_PROPERTY_ROW.name,
      tower_and_unit: AZURE_PROPERTY_ROW.tower_and_unit,
    },
    organizationName: AZURE_ORGANIZATION_NAME,
    fromEmail: AZURE_FROM_EMAIL,
  });

  const unitLabel = resolveEmailUnitLabel(fd.towerAndUnitNumber, branding);
  const emails = await buildEmails(appSettings, branding, unitLabel);

  const json = {
    scenario: 'azure-north',
    property: {
      name: AZURE_PROPERTY_ROW.name,
      slug: AZURE_PROPERTY_SLUG,
      residenceName: AZURE_RESIDENCE_NAME,
      organizationName: AZURE_ORGANIZATION_NAME,
    },
    appSettings,
    guestFormSettings,
    guestPaymentInfo,
    documentRequirements: {
      residenceDefault: residenceRequirements,
      applies: residenceRequirements.flatMap((req) =>
        BOOKING_SHAPES.map((shape) => ({
          requirementId: req.id,
          booking: shape.label,
          applies: requirementApplies(req, shape),
        }))
      ),
      requirementsNeedingApprovedPdf: residenceRequirements
        .filter((req) => requirementDocKind(req) !== 'other')
        .map((req) => req.id),
      docKind: residenceRequirements.map((req) => ({
        id: req.id,
        kind: requirementDocKind(req),
      })),
      pdfTemplateDemand: BOOKING_SHAPES.map((shape) => ({
        booking: shape.label,
        gaf: hasApplicableDocumentPdfTemplate(residenceRequirements, shape, 'gaf'),
        pet: hasApplicableDocumentPdfTemplate(residenceRequirements, shape, 'pet'),
      })),
    },
    pdfFields: {
      gaf: buildGafPdfFieldMap(fd),
      pet: buildPetPdfFieldMap(fd),
    },
    emailSubjects: {
      gaf: {
        request: buildGafRequestSubject({
          unitLabel,
          displayCheckInDate: DISPLAY_CHECK_IN,
          displayCheckOutDate: DISPLAY_CHECK_OUT,
          isUrgent: false,
          isUpdate: false,
        }),
        urgent: buildGafRequestSubject({
          unitLabel,
          displayCheckInDate: DISPLAY_CHECK_IN,
          displayCheckOutDate: DISPLAY_CHECK_OUT,
          isUrgent: true,
          isUpdate: false,
        }),
        update: buildGafRequestSubject({
          unitLabel,
          displayCheckInDate: DISPLAY_CHECK_IN,
          displayCheckOutDate: DISPLAY_CHECK_OUT,
          isUrgent: false,
          isUpdate: true,
        }),
      },
      pet: {
        request: buildPetRequestSubject({
          unitLabel,
          displayCheckInDate: DISPLAY_CHECK_IN,
          displayCheckOutDate: DISPLAY_CHECK_OUT,
          isUrgent: false,
          isUpdate: false,
        }),
        urgent: buildPetRequestSubject({
          unitLabel,
          displayCheckInDate: DISPLAY_CHECK_IN,
          displayCheckOutDate: DISPLAY_CHECK_OUT,
          isUrgent: true,
          isUpdate: false,
        }),
        update: buildPetRequestSubject({
          unitLabel,
          displayCheckInDate: DISPLAY_CHECK_IN,
          displayCheckOutDate: DISPLAY_CHECK_OUT,
          isUrgent: false,
          isUpdate: true,
        }),
      },
      readyForCheckin: buildReadyForCheckinSubject({
        unitLabel,
        displayCheckInDate: DISPLAY_CHECK_IN,
        displayCheckOutDate: DISPLAY_CHECK_OUT,
      }),
    },
    statusAndStepTitles: {
      statusHumanLabel: STATUS_HUMAN_LABEL,
      pipelineOrder: PIPELINE_ORDER,
      stepTitles: residenceRequirements.map((req) => ({
        id: req.id,
        label: req.label,
        calendarIcon: req.calendarIcon,
      })),
    },
    stayGuideDocuments: {
      pending: buildStayGuideCheckInDocuments(pendingBooking, residenceRequirements),
      ready: buildStayGuideCheckInDocuments(readyBooking, residenceRequirements),
    },
  };

  return { json, emails };
}

function collectDiffs(expected: unknown, actual: unknown, path: string, out: string[]): void {
  if (out.length >= 25) return;

  if (Array.isArray(expected) || Array.isArray(actual)) {
    const a = Array.isArray(expected) ? expected : [];
    const b = Array.isArray(actual) ? actual : [];
    if (a.length !== b.length) {
      out.push(`${path}: length ${a.length} → ${b.length}`);
      return;
    }
    for (let i = 0; i < a.length; i += 1) {
      collectDiffs(a[i], b[i], `${path}[${i}]`, out);
      if (out.length >= 25) return;
    }
    return;
  }

  if (expected && actual && typeof expected === 'object' && typeof actual === 'object') {
    const a = expected as Record<string, unknown>;
    const b = actual as Record<string, unknown>;
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      collectDiffs(a[key], b[key], path ? `${path}.${key}` : key, out);
      if (out.length >= 25) return;
    }
    return;
  }

  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    out.push(`${path}: ${JSON.stringify(expected)} → ${JSON.stringify(actual)}`);
  }
}

async function writeFixtures() {
  const { json, emails } = await buildAll();
  mkdirSync(FIXTURES_DIR, { recursive: true });

  writeFileSync(JSON_FIXTURE, `${JSON.stringify(json, null, 2)}\n`);
  for (const [key, file] of Object.entries(EMAIL_FILES)) {
    writeFileSync(join(FIXTURES_DIR, file), emails[key as keyof typeof emails].html);
  }

  console.log(`Wrote ${JSON_FIXTURE} and ${Object.values(EMAIL_FILES).length} email fixtures.`);
  console.log('Review the HTML diff before committing.');
}

async function checkFixtures() {
  const { json, emails } = await buildAll();
  const problems: string[] = [];

  if (!existsSync(JSON_FIXTURE)) {
    console.error(`Missing ${JSON_FIXTURE}. Run: bun run golden:azure`);
    Deno.exit(1);
  }

  const committed = JSON.parse(readFileSync(JSON_FIXTURE, 'utf8')) as unknown;
  collectDiffs(committed, json, 'azure-golden', problems);

  for (const [key, file] of Object.entries(EMAIL_FILES)) {
    const path = join(FIXTURES_DIR, file);
    if (!existsSync(path)) {
      problems.push(`${file}: missing`);
      continue;
    }
    const committedHtml = readFileSync(path, 'utf8');
    const currentHtml = emails[key as keyof typeof emails].html;
    if (committedHtml !== currentHtml) {
      problems.push(
        `${file}: HTML changed (${committedHtml.length} → ${currentHtml.length} bytes)`
      );
    }
  }

  if (problems.length > 0) {
    console.error('Azure golden set changed:');
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error('');
    console.error('If the change is intentional and Azure stays byte-identical, rewrite:');
    console.error('  bun run golden:azure');
    Deno.exit(1);
  }

  console.log(
    `OK — Azure golden set matches (${Object.keys(json).length} sections, ${
      Object.keys(EMAIL_FILES).length
    } emails).`
  );
}

if (Deno.args.includes('--check')) await checkFixtures();
else await writeFixtures();
