/**
 * Stateful property Templates fixtures for the UI/UX review and the regression suite.
 *
 * The shared team RBAC harness seeds one custom template and a thin DTO, which is enough to
 * prove the shell renders but says nothing about the rail at real density: ten guide sections,
 * guest messages, automated emails with subjects and automation facts, building-admin rows with
 * fixed subjects, a team alert, three folders (one empty) and one ungrouped custom template.
 *
 * This harness layers that library on top of the RBAC boot mocks and keeps it mutable, so
 * create / rename / move / delete / folder CRUD round-trip through the same GET the page reads.
 *
 * Only the template endpoints (plus the send dialog's booking list and preview render) are
 * overridden; everything else falls back to the team harness.
 */

import {
  entitlementsPayload,
  installPropertyTeamRbacMocks,
} from '../../../team/shared/propertyTeamRbacHarness';

import type { Page, Route } from '@playwright/test';

export const TEMPLATES_E2E_ORG_SLUG = 'sample-stays-ph';
export const TEMPLATES_E2E_PROPERTY_SLUG = 'solea-mactan';
export const TEMPLATES_E2E_PATH = `/org/${TEMPLATES_E2E_ORG_SLUG}/property/${TEMPLATES_E2E_PROPERTY_SLUG}/templates`;

export type TemplateSeed = {
  templateKey: string;
  name: string;
  category: 'standard' | 'email' | 'message' | 'custom';
  group: 'stay-guide' | 'guest-messages' | 'guest-emails' | 'building-admin' | 'team-alerts' | null;
  content: string;
  defaultContent: string;
  isDefault: boolean;
  description: string | null;
  folderId: string | null;
  guestVisible: boolean;
  guestPhase: 'before' | 'arrival' | 'stay' | 'checkout' | 'after' | 'always';
  updatedAt: string | null;
  recipient: 'guest' | 'team' | 'building-admin' | null;
  trigger: string | null;
  automationToggleKey: string | null;
  iconId: string | null;
  defaultSubject: string | null;
  defaultSubjectPreview: string | null;
  subjectLocked: boolean;
  chapter: 'getting-in' | 'make-yourself-at-home' | 'before-you-go' | null;
  condition: 'has_pets' | 'need_parking' | null;
  requiresEdit: boolean;
  appliesWhen: 'gaf-or-pet-required' | null;
  subject: string | null;
  newDefaultAvailable: boolean;
  automationEnabled: boolean | null;
  automationPlanBlocked: boolean;
};

const BODY = (text: string) =>
  `<p>${text}</p><p>Save the code <strong>{{wifi_network}}</strong> and message us at <strong>{{contact_phone}}</strong> if anything comes up.</p>`;

function template(
  seed: Partial<TemplateSeed> & Pick<TemplateSeed, 'templateKey' | 'name' | 'category' | 'group'>
): TemplateSeed {
  const content = seed.content ?? BODY(`${seed.name} copy for this property.`);
  return {
    templateKey: seed.templateKey,
    name: seed.name,
    category: seed.category,
    group: seed.group,
    content,
    defaultContent: seed.defaultContent ?? content,
    isDefault: seed.isDefault ?? true,
    description: seed.description ?? null,
    folderId: seed.folderId ?? null,
    guestVisible: seed.guestVisible ?? true,
    guestPhase: seed.guestPhase ?? 'always',
    updatedAt: seed.updatedAt ?? null,
    recipient: seed.recipient ?? null,
    trigger: seed.trigger ?? null,
    automationToggleKey: seed.automationToggleKey ?? null,
    iconId: seed.iconId ?? null,
    defaultSubject: seed.defaultSubject ?? null,
    defaultSubjectPreview: seed.defaultSubjectPreview ?? null,
    subjectLocked: seed.subjectLocked ?? false,
    chapter: seed.chapter ?? null,
    condition: seed.condition ?? null,
    requiresEdit: seed.requiresEdit ?? false,
    appliesWhen: seed.appliesWhen ?? null,
    subject: seed.subject ?? null,
    newDefaultAvailable: seed.newDefaultAvailable ?? false,
    automationEnabled: seed.automationEnabled ?? null,
    automationPlanBlocked: seed.automationPlanBlocked ?? false,
  };
}

function guideSections(): TemplateSeed[] {
  const section = (
    key: string,
    name: string,
    iconId: string,
    chapter: TemplateSeed['chapter'],
    extra: Partial<TemplateSeed> = {}
  ) =>
    template({
      templateKey: key,
      name,
      category: 'standard',
      group: 'stay-guide',
      iconId,
      chapter,
      description: `${name} shown in the token-gated guest stay guide.`,
      ...extra,
    });

  return [
    section('welcome-note', 'Welcome note', 'home', 'getting-in'),
    section('getting-here', 'Getting here', 'log-in', 'getting-in', { guestVisible: false }),
    section('check-in-instructions', 'Check-in instructions', 'log-in', 'getting-in'),
    section('house-rules', 'House rules', 'list-checks', 'make-yourself-at-home', {
      description: 'Quiet hours, smoking, visitors and the building rules guests must follow.',
      content: BODY(
        'Quiet hours are 10 PM to 8 AM. No smoking inside the unit. Registered guests only.'
      ),
      isDefault: false,
      updatedAt: '2026-11-18T06:24:00.000Z',
    }),
    section('using-the-unit', 'Using the unit', 'receipt', 'make-yourself-at-home', {
      newDefaultAvailable: true,
    }),
    section('building-amenities', 'Building amenities', 'clipboard', 'make-yourself-at-home', {
      guestVisible: false,
    }),
    section('parking-reminders', 'Parking reminders', 'car', 'make-yourself-at-home', {
      condition: 'need_parking',
    }),
    section('pet-guidelines', 'Pet guidelines', 'paw', 'make-yourself-at-home', {
      condition: 'has_pets',
    }),
    section('emergency-and-safety', 'Emergency and safety', 'ban', 'before-you-go'),
    section('check-out-instructions', 'Check-out instructions', 'log-out', 'before-you-go'),
  ];
}

function guestMessages(): TemplateSeed[] {
  const message = (key: string, name: string, iconId: string) =>
    template({
      templateKey: key,
      name,
      category: 'message',
      group: 'guest-messages',
      iconId,
      description: 'Ready-to-send chat message. Insert it in the Guest Inbox or send by email.',
    });

  return [
    message('balance-reminder', 'Balance reminder', 'receipt'),
    message('missing-documents', 'Missing documents', 'file-check'),
    message('check-in-day', 'Check-in day', 'message'),
    message('item-left-behind', 'Item left behind', 'undo'),
  ];
}

function emails(): TemplateSeed[] {
  const email = (
    key: string,
    name: string,
    iconId: string,
    group: TemplateSeed['group'],
    extra: Partial<TemplateSeed> = {}
  ) =>
    template({
      templateKey: key,
      name,
      category: 'email',
      group,
      iconId,
      description: 'Automated email from the booking workflow.',
      recipient: group === 'team-alerts' ? 'team' : 'guest',
      trigger: 'When a booking reaches the matching stage',
      automationToggleKey: key,
      defaultSubject: '{{property_name}} · {{unit_number}}',
      defaultSubjectPreview: 'Solea Mactan · Unit 1204',
      automationEnabled: true,
      ...extra,
    });

  return [
    email('booking-confirmation', 'Booking confirmation', 'mail', 'guest-emails', {
      subject: 'Your booking at {{property_name}} is confirmed',
      content: BODY('Your stay is confirmed. Here are the details of your booking.'),
    }),
    email('check-in-details', 'Check-in details', 'log-in', 'guest-emails'),
    email('checkout-reminder', 'Check-out reminder', 'log-out', 'guest-emails'),
    email('gaf-request', 'GAF request', 'file-check', 'building-admin', {
      recipient: 'building-admin',
      description:
        'Asks the guest for their Azure GAF before check-in. The subject is fixed because inbound approval matches it.',
      subjectLocked: true,
      requiresEdit: true,
      appliesWhen: 'gaf-or-pet-required',
      automationToggleKey: null,
      automationEnabled: null,
      defaultSubject: 'Azura GAF · {{unit_number}}',
      defaultSubjectPreview: 'Azura GAF · Unit 1204',
    }),
    email('pet-request', 'Pet request', 'paw', 'building-admin', {
      recipient: 'building-admin',
      subjectLocked: true,
      requiresEdit: true,
      appliesWhen: 'gaf-or-pet-required',
      automationToggleKey: null,
      automationEnabled: null,
      defaultSubject: 'Azura pet registration · {{unit_number}}',
      defaultSubjectPreview: 'Azura pet registration · Unit 1204',
    }),
    email('team-new-booking', 'New booking alert', 'send', 'team-alerts', {
      automationPlanBlocked: true,
    }),
  ];
}

function customTemplates(): TemplateSeed[] {
  const custom = (
    key: string,
    name: string,
    folderId: string | null,
    extra: Partial<TemplateSeed> = {}
  ) =>
    template({
      templateKey: key,
      name,
      category: 'custom',
      group: null,
      folderId,
      guestVisible: true,
      guestPhase: 'before',
      isDefault: false,
      description: null,
      updatedAt: '2026-11-20T09:12:00.000Z',
      content: BODY(`${name} written for this property.`),
      ...extra,
    });

  return [
    custom('custom-arrival-pack', 'Arrival instructions', 'folder-arrival'),
    custom('custom-late-checkout', 'Late check-out offer', 'folder-arrival', {
      guestPhase: 'checkout',
    }),
    custom('custom-airport-transfer', 'Airport transfer', 'folder-upsells', {
      guestPhase: 'before',
    }),
    custom('custom-typhoon-advisory', 'Typhoon advisory', null, {
      guestPhase: 'stay',
      guestVisible: false,
    }),
  ];
}

export type TemplatesState = {
  templates: TemplateSeed[];
  folders: Array<{ id: string; name: string; position: number; templateCount: number }>;
  requests: Array<{ method: string; body: Record<string, unknown> }>;
  failNextSave: boolean;
};

function catalogFor(templates: TemplateSeed[], folders: TemplatesState['folders']) {
  return {
    templates: templates.map((row) => ({
      ...row,
      previewTemplateSlug: null,
      sectionImageUrl: null,
      defaultPhase: row.category === 'custom' ? 'always' : null,
      defaultGuestVisible: row.category === 'standard' ? true : false,
      placeholderKeys: ['guest_name', 'property_name', 'unit_number', 'wifi_network'],
      automationToggleKey: row.automationToggleKey,
    })),
    folders: folders.map((folder) => ({
      ...folder,
      templateCount: templates.filter((row) => row.folderId === folder.id).length,
    })),
    placeholdersReference: [
      '{{guest_name}}',
      '{{property_name}}',
      '{{unit_number}}',
      '{{wifi_network}}',
      '{{contact_phone}}',
    ],
    propertyEmptyPlaceholders: ['wifi_network'],
  };
}

const PREVIEW_HTML = `<!doctype html><html><head><meta charset="utf-8" />
<style>
  body{margin:0;background:#f6f7f8;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111827}
  .wrap{max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.08)}
  .band{background:#117a6d;color:#fff;padding:20px 24px;font-weight:700;font-size:16px}
  .body{padding:24px;font-size:14px;line-height:1.6}
  h1{font-size:18px;margin:0 0 12px}
  .facts{border-collapse:collapse;width:100%;margin:16px 0;font-size:13px}
  .facts td{border-top:1px solid #e5e7eb;padding:8px 0}
  .facts td:last-child{text-align:right;font-weight:600}
  .cta{display:inline-block;margin-top:8px;background:#117a6d;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600}
  .foot{padding:16px 24px;background:#f3f4f6;color:#6b7280;font-size:11px}
</style></head><body>
<div class="wrap">
  <div class="band">Solea Mactan · Unit 1204</div>
  <div class="body">
    <h1>You are all set for your stay</h1>
    <p>Hi Maria, your booking is confirmed. Here is everything you need before you arrive.</p>
    <table class="facts">
      <tr><td>Check-in</td><td>Dec 4, 2026 · 2:00 PM</td></tr>
      <tr><td>Check-out</td><td>Dec 8, 2026 · 12:00 PM</td></tr>
      <tr><td>Guests</td><td>4 adults</td></tr>
      <tr><td>Total paid</td><td>PHP 31,150.00</td></tr>
    </table>
    <a class="cta" href="#">Open your trip</a>
  </div>
  <div class="foot">Sent by Kame Space on behalf of Solea Mactan.</div>
</div></body></html>`;

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });
}

/**
 * Installs the templates library, the preview renderer, the test-send endpoint and the send
 * dialog's booking list. Returns live state so a spec can assert round-trips.
 */
export async function installTemplatesReviewMocks(
  page: Page,
  opts: {
    freePlan?: boolean;
    readOnly?: boolean;
    omitPermissions?: string[];
    emptyLibrary?: boolean;
    failLoad?: boolean;
    loadDelayMs?: number;
  } = {}
): Promise<TemplatesState> {
  await installPropertyTeamRbacMocks(page, 'full_access', {
    freePlan: opts.freePlan,
    customTemplateSeeded: true,
    omitPermissions: [
      ...(opts.omitPermissions ?? []),
      ...(opts.readOnly
        ? [
            'templates.standard:edit',
            'templates.email:edit',
            'templates.custom:add',
            'templates.custom:edit',
            'templates.custom:delete',
          ]
        : []),
    ],
  });

  const state: TemplatesState = {
    templates: opts.emptyLibrary
      ? []
      : [...guideSections(), ...guestMessages(), ...emails(), ...customTemplates()],
    folders: opts.emptyLibrary
      ? []
      : [
          { id: 'folder-arrival', name: 'Arrival pack', position: 0, templateCount: 2 },
          { id: 'folder-upsells', name: 'Upsells', position: 1, templateCount: 1 },
          { id: 'folder-archive', name: 'Archive', position: 2, templateCount: 0 },
        ],
    requests: [],
    failNextSave: false,
  };

  const catalog = () => catalogFor(state.templates, state.folders);

  /**
   * `freePlan` on the shared harness keeps `customTemplates: true`, so a Free-tier run still
   * renders every Starter-only affordance as unlocked. Override the property entitlements for
   * this route so the reviewer sees the real gated state.
   */
  if (opts.freePlan) {
    await page.route('**/functions/v1/property-entitlements**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        return;
      }
      await fulfillJson(route, {
        success: true,
        data: { ...entitlementsPayload(true), customTemplates: false },
      });
    });
  }

  const findTemplate = (templateKey: unknown) =>
    state.templates.find((row) => row.templateKey === templateKey);

  await page.route('**/functions/v1/property-templates-settings**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
      return;
    }

    if (request.method() === 'GET') {
      if (opts.failLoad) {
        await fulfillJson(route, { success: false, error: 'Templates service unavailable' }, 500);
        return;
      }
      if (opts.loadDelayMs) await new Promise((resolve) => setTimeout(resolve, opts.loadDelayMs));
      await fulfillJson(route, { success: true, data: catalog() });
      return;
    }

    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
    state.requests.push({ method: request.method(), body });

    if (state.failNextSave) {
      state.failNextSave = false;
      await fulfillJson(route, { success: false, error: 'Could not save template' }, 500);
      return;
    }

    const action = body.action;

    if (action === 'create') {
      const key = `custom-${String(body.name ?? 'template')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')}`;
      const category = (body.category as TemplateSeed['category']) ?? 'custom';
      state.templates.push({
        ...template({
          templateKey: key,
          name: String(body.name ?? 'Untitled template'),
          category,
          group:
            category === 'standard'
              ? 'stay-guide'
              : category === 'message'
                ? 'guest-messages'
                : category === 'email'
                  ? 'guest-emails'
                  : null,
        }),
        content: String(body.content ?? ''),
        defaultContent: String(body.content ?? ''),
        isDefault: false,
        folderId: (body.folderId as string | null) ?? null,
        description: null,
        updatedAt: new Date('2026-11-22T02:00:00.000Z').toISOString(),
      });
      await fulfillJson(route, { success: true, data: catalog() });
      return;
    }

    if (action === 'delete') {
      state.templates = state.templates.filter((row) => row.templateKey !== body.templateKey);
      await fulfillJson(route, { success: true, data: catalog() });
      return;
    }

    if (action === 'rename') {
      const row = findTemplate(body.templateKey);
      if (row) row.name = String(body.name ?? row.name);
      await fulfillJson(route, { success: true, data: catalog() });
      return;
    }

    if (action === 'move') {
      const row = findTemplate(body.templateKey);
      if (row) {
        row.category = (body.category as TemplateSeed['category']) ?? row.category;
        row.group =
          row.category === 'standard'
            ? 'stay-guide'
            : row.category === 'message'
              ? 'guest-messages'
              : row.category === 'email'
                ? 'guest-emails'
                : null;
        row.folderId =
          row.category === 'custom' ? ((body.folderId as string | null) ?? null) : null;
      }
      await fulfillJson(route, { success: true, data: catalog() });
      return;
    }

    if (action === 'createFolder') {
      const id = `folder-${String(body.name ?? 'group')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')}`;
      state.folders.push({
        id,
        name: String(body.name ?? 'New group'),
        position: state.folders.length,
        templateCount: 0,
      });
      await fulfillJson(route, { success: true, data: catalog() });
      return;
    }

    if (action === 'renameFolder') {
      const folder = state.folders.find((row) => row.id === body.folderId);
      if (folder) folder.name = String(body.name ?? folder.name);
      await fulfillJson(route, { success: true, data: catalog() });
      return;
    }

    if (action === 'deleteFolder') {
      state.folders = state.folders.filter((row) => row.id !== body.folderId);
      for (const row of state.templates) {
        if (row.folderId === body.folderId) row.folderId = null;
      }
      await fulfillJson(route, { success: true, data: catalog() });
      return;
    }

    if (action === 'reset') {
      const row = findTemplate(body.templateKey);
      if (row) {
        row.content = row.defaultContent;
        row.isDefault = true;
        row.subject = null;
      }
      await fulfillJson(route, { success: true, data: catalog() });
      return;
    }

    // Plain save.
    const row = findTemplate(body.templateKey);
    if (row) {
      if (typeof body.content === 'string') {
        row.content = body.content;
        row.isDefault = body.content === row.defaultContent;
      }
      if (typeof body.subject === 'string' || body.subject === null) {
        row.subject = body.subject as string | null;
      }
      if (typeof body.guestVisible === 'boolean') row.guestVisible = body.guestVisible;
      if (typeof body.guestPhase === 'string') {
        row.guestPhase = body.guestPhase as TemplateSeed['guestPhase'];
      }
      row.updatedAt = new Date('2026-11-22T03:30:00.000Z').toISOString();
    }
    await fulfillJson(route, { success: true, data: { ...catalog(), warnings: [] } });
  });

  await page.route('**/functions/v1/property-templates-preview**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
      return;
    }
    await fulfillJson(route, {
      success: true,
      data: { html: PREVIEW_HTML, mode: 'email', subject: 'Solea Mactan · Unit 1204' },
    });
  });

  await page.route('**/functions/v1/send-property-template-test-email**', async (route) => {
    await fulfillJson(route, {
      success: true,
      data: { sentTo: 'owner@sample-stays.ph' },
    });
  });

  await page.route('**/functions/v1/send-property-custom-template-email**', async (route) => {
    const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    await fulfillJson(route, {
      success: true,
      bookingId: body.bookingId,
      templateKey: body.templateKey,
    });
  });

  return state;
}

/** Holds the current screen so a headed tour is watchable. No-op unless the demo env is set. */
export async function demoPause(page: Page, multiplier = 1): Promise<void> {
  const raw = process.env.PLAYWRIGHT_DEMO_PAUSE_MS;
  const ms = raw ? Number.parseInt(raw, 10) : 0;
  if (!ms || !Number.isFinite(ms)) return;
  await page.waitForTimeout(Math.round(ms * multiplier));
}

/** Consent storage only applies to the origin it was recorded on, so clear it explicitly. */
export async function dismissConsent(page: Page): Promise<void> {
  for (const name of ['Essential only', 'Necessary only', 'Accept all']) {
    const button = page.getByRole('button', { name });
    if (await button.isVisible().catch(() => false)) {
      await button.first().click();
      return;
    }
  }
}

export async function openTemplates(page: Page): Promise<void> {
  await page.goto(TEMPLATES_E2E_PATH);
  await page.getByRole('heading', { name: 'Templates', exact: true }).waitFor({ timeout: 30_000 });
  await dismissConsent(page);
}
