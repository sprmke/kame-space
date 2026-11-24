/**
 * Help & Support fixtures — FAQ catalogue, guide articles and a ticket workspace
 * whose state survives reply / reopen / submit, across org, property and parking mounts.
 *
 * The FAQ seed deliberately spans every scope so a test can prove the mount filter:
 * org categories, property categories, parking categories, a category whose scope
 * depends on its source guide path, a guest-only category and a guest-audience answer.
 */

import {
  createParkingFlowState,
  installParkingFlowMocks,
} from '../../parking/shared/parkingFlowHarness';
import { installPropertyTeamRbacMocks } from '../../team/shared/propertyTeamRbacHarness';

import type { Page } from '@playwright/test';

export const HELP_E2E_ORG_SLUG = 'sample-stays-ph';
export const HELP_E2E_PROPERTY_SLUG = 'solea-mactan';
export const HELP_E2E_PARKING_SLUG = 'slot-12a';
export const HELP_E2E_PROPERTY_PATH = `/org/${HELP_E2E_ORG_SLUG}/property/${HELP_E2E_PROPERTY_SLUG}/help-support`;
export const HELP_E2E_ORG_PATH = `/org/${HELP_E2E_ORG_SLUG}/help-support`;
export const HELP_E2E_PARKING_PATH = `/org/${HELP_E2E_ORG_SLUG}/parking/${HELP_E2E_PARKING_SLUG}/help-support`;

export type HelpScope = 'org' | 'property' | 'parking';

export type HelpFaqSeed = {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  source_route_guide_path?: string | null;
  audience?: 'host' | 'guest' | 'public' | null;
};

export type HelpTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type HelpTicketSeed = {
  id: string;
  category: 'bug_report' | 'feature_suggestion' | 'general_inquiry' | 'business_inquiry';
  subject: string;
  status: HelpTicketStatus;
  created_at: string;
  updated_at: string;
  messages: Array<{
    id: string;
    sender_type: 'host' | 'guest' | 'admin';
    sender_name: string;
    body: string;
    created_at: string;
    attachments?: Array<{
      name: string;
      mimeType: string;
      size: number;
      path: string;
      url?: string;
    }>;
  }>;
};

export type HelpSupportState = {
  faqs: HelpFaqSeed[];
  articles: Array<{
    routeGuidePath: string;
    title: string;
    routePath: string | null;
    module: string;
    qaItems: Array<{ question: string; answer: string }>;
  }>;
  tickets: HelpTicketSeed[];
  submitted: Array<Record<string, unknown>>;
  replies: Array<Record<string, unknown>>;
  reopened: string[];
  /** Last `list-support-tickets` query string, so a test can assert the mount scope. */
  lastListQuery: string;
};

const PNG_PIXEL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Q3ZTVlMiIvPjxyZWN0IHg9IjI0IiB5PSI0MCIgd2lkdGg9IjE1MiIgaGVpZ2h0PSIxMiIgcng9IjQiIGZpbGw9IiM4ZmI4YjAiLz48cmVjdCB4PSIyNCIgeT0iNjgiIHdpZHRoPSIxMjAiIGhlaWdodD0iMTAiIHJ4PSI0IiBmaWxsPSIjYTljOWMyIi8+PHJlY3QgeD0iMjQiIHk9IjkyIiB3aWR0aD0iMTQwIiBoZWlnaHQ9IjEwIiByeD0iNCIgZmlsbD0iI2E5YzljMiIvPjxyZWN0IHg9IjI0IiB5PSIxMTYiIHdpZHRoPSI5NiIgaGVpZ2h0PSIxMCIgcng9IjQiIGZpbGw9IiNhOWM5YzIiLz48dGV4dCB4PSIxMDAiIHk9IjE3MiIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiMzZjZiNjQiPmNvbnNvbGUucG5nPC90ZXh0Pjwvc3ZnPg==';

export const TICKET_OPEN = 'a1111111-1111-4111-8111-111111111111';
export const TICKET_IN_PROGRESS = 'b2222222-2222-4222-8222-222222222222';
export const TICKET_RESOLVED = 'c3333333-3333-4333-8333-333333333333';
export const TICKET_CLOSED = 'd4444444-4444-4444-8444-444444444444';
export const TICKET_BUSINESS = 'e5555555-5555-4555-8555-555555555555';

function iso(day: number, hour = 9) {
  return `2026-11-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;
}

function seededFaqs(): HelpFaqSeed[] {
  return [
    {
      id: 'faq-start-1',
      category: 'Getting Started',
      question: 'How do I invite someone to my team?',
      answer: 'Open **Team**, choose Invite, and send the email. They join once they accept.',
      sort_order: 10,
      audience: 'host',
    },
    {
      id: 'faq-start-2',
      category: 'Getting Started',
      question: 'Where do I change my organization name?',
      answer: 'Organization → Settings → Basic info.',
      sort_order: 20,
      audience: 'host',
    },
    {
      id: 'faq-plans-1',
      category: 'Plans & Billing',
      question: 'Can I change my plan later?',
      answer: 'Yes. Upgrades apply now, downgrades apply at renewal.',
      sort_order: 10,
      audience: 'host',
    },
    {
      id: 'faq-account-1',
      category: 'Account & Security',
      question: 'How do I turn on two-factor sign-in?',
      answer: 'Profile → Security → Two-factor.',
      sort_order: 10,
      audience: 'host',
    },
    {
      id: 'faq-account-guest',
      category: 'Account & Security',
      question: 'I lost access to my guest account',
      answer: 'Reset the password from the guest sign-in page.',
      sort_order: 20,
      audience: 'guest',
    },
    {
      id: 'faq-team-org',
      category: 'Team & Permissions',
      question: 'What can an org admin do?',
      answer: 'Org admins manage every property and parking listing in the organization.',
      sort_order: 10,
      source_route_guide_path: 'docs/guides/routes/org/team.md',
      audience: 'host',
    },
    {
      id: 'faq-bookings-1',
      category: 'Bookings',
      question: 'Why is a booking waiting for review?',
      answer: 'Every new booking lands in Pending review until you approve it.',
      sort_order: 10,
      audience: 'host',
    },
    {
      id: 'faq-property-1',
      category: 'Property Settings',
      question: 'How do I change my check-in time?',
      answer: 'Property Settings → Stay rules.',
      sort_order: 10,
      audience: 'host',
    },
    {
      id: 'faq-maintenance-1',
      category: 'Maintenance & Operations',
      question: 'Can I get a reminder for a repair?',
      answer: 'Yes. Add the reminder and pick the days before it is due.',
      sort_order: 10,
      audience: 'host',
    },
    {
      id: 'faq-finance-property',
      category: 'Billing & Finance',
      question: 'How is net profit calculated?',
      answer: 'Income minus expenses for the selected period.',
      sort_order: 10,
      source_route_guide_path: 'docs/guides/routes/org/property/finance.md',
      audience: 'host',
    },
    {
      id: 'faq-finance-parking',
      category: 'Billing & Finance',
      question: 'Do parking payouts show in Finance?',
      answer: 'Yes. Parking payouts appear beside the slot expenses.',
      sort_order: 20,
      source_route_guide_path: 'docs/guides/routes/org/parking/finance.md',
      audience: 'host',
    },
    {
      id: 'faq-parking-1',
      category: 'Parking',
      question: 'How do I set an hourly rate?',
      answer: 'Parking → Pricing → Hourly rate.',
      sort_order: 10,
      source_route_guide_path: 'docs/guides/routes/org/parking/pricing.md',
      audience: 'host',
    },
    {
      id: 'faq-parking-2',
      category: 'Parking',
      question: 'What happens when a guest overstays?',
      answer: 'The booking stays open until you mark it complete.',
      sort_order: 20,
      source_route_guide_path: 'docs/guides/routes/org/parking/bookings.md',
      audience: 'host',
    },
    {
      id: 'faq-activity-parking',
      category: 'Activity & Audit',
      question: 'Who changed the parking rate?',
      answer: 'Open Activity and filter by Pricing.',
      sort_order: 10,
      source_route_guide_path: 'docs/guides/routes/org/parking/activity.md',
      audience: 'host',
    },
    {
      id: 'faq-announcements',
      category: 'Announcements',
      question: 'Where do product announcements live?',
      answer: 'Announcements in the organization sidebar.',
      sort_order: 10,
      audience: 'host',
    },
    {
      id: 'faq-guest-only',
      category: 'Guest Portal',
      question: 'How do I find my trip?',
      answer: 'Guest account → Trips.',
      sort_order: 10,
      audience: 'guest',
    },
    {
      id: 'faq-public',
      category: 'Getting Started',
      question: 'Do I need an account to book?',
      answer: 'No. You can book as a guest with just your email.',
      sort_order: 30,
      audience: 'public',
    },
  ];
}

function seededArticles() {
  return [
    {
      routeGuidePath: 'docs/guides/routes/org/team.md',
      title: 'Org Team — operator guide',
      routePath: '/org/:orgSlug/team',
      module: 'Org',
      qaItems: [
        {
          question: 'How do I invite a teammate?',
          answer: 'Team → Invite, then choose the role.',
        },
        {
          question: 'Can I change a role later?',
          answer: 'Yes, from the member row menu.',
        },
      ],
    },
    {
      routeGuidePath: 'docs/guides/routes/org/property/finance.md',
      title: 'Finance — operator guide',
      routePath: '/org/:orgSlug/property/:propertySlug/finance',
      module: 'Property',
      qaItems: [
        {
          question: 'Does the ledger include stays?',
          answer: 'Yes. Stays and manual transactions share one ledger.',
        },
      ],
    },
    {
      routeGuidePath: 'docs/guides/routes/org/property/settings.md',
      title: 'Property Settings — operator guide',
      routePath: '/org/:orgSlug/property/:propertySlug/settings',
      module: 'Property',
      qaItems: [
        {
          question: 'Where do I edit the address?',
          answer: 'Settings → Location.',
        },
      ],
    },
    {
      routeGuidePath: 'docs/guides/routes/org/parking/bookings.md',
      title: 'Parking bookings — operator guide',
      routePath: '/org/:orgSlug/parking/:parkingSlug/bookings',
      module: 'Parking',
      qaItems: [
        {
          question: 'How do I approve a request?',
          answer: 'Open the request and choose **Approve for check-in**.',
        },
      ],
    },
    {
      routeGuidePath: 'docs/guides/routes/form.md',
      title: 'Guest booking form',
      routePath: '/form',
      module: 'General',
      qaItems: [
        {
          question: 'Can a guest edit their form after submitting?',
          answer: 'They can reopen it while the booking is still in review.',
        },
      ],
    },
  ];
}

function seededTickets(): HelpTicketSeed[] {
  return [
    {
      id: TICKET_OPEN,
      category: 'bug_report',
      subject: 'Booking form freezes on photo upload',
      status: 'open',
      created_at: iso(18, 9),
      updated_at: iso(20, 15),
      messages: [
        {
          id: 'msg-1',
          sender_type: 'host',
          sender_name: 'Team Member',
          body: 'When I attach the guest ID photo the form stops responding. Chrome on Windows.',
          created_at: iso(18, 9),
        },
        {
          id: 'msg-2',
          sender_type: 'admin',
          sender_name: 'Kame Support',
          body: 'Thanks for the report. Could you send a screenshot of the console?',
          created_at: iso(19, 10),
        },
        {
          id: 'msg-3',
          sender_type: 'host',
          sender_name: 'Team Member',
          body: 'Here it is.',
          created_at: iso(20, 15),
          attachments: [
            {
              name: 'console.png',
              mimeType: 'image/png',
              size: 68,
              path: 'org-team-e2e-001/user-team-e2e-001/console.png',
              url: PNG_PIXEL,
            },
          ],
        },
      ],
    },
    {
      id: TICKET_IN_PROGRESS,
      category: 'general_inquiry',
      subject: 'Can I export a report for two months?',
      status: 'in_progress',
      created_at: iso(15, 11),
      updated_at: iso(19, 9),
      messages: [
        {
          id: 'msg-4',
          sender_type: 'host',
          sender_name: 'Team Member',
          body: 'I need one PDF covering October and November.',
          created_at: iso(15, 11),
        },
        {
          id: 'msg-5',
          sender_type: 'admin',
          sender_name: 'Kame Support',
          body: 'We are checking whether a two-month range can be exported in one file.',
          created_at: iso(19, 9),
        },
      ],
    },
    {
      id: TICKET_RESOLVED,
      category: 'feature_suggestion',
      subject: 'Add a per-property occupancy report',
      status: 'resolved',
      created_at: iso(8, 14),
      updated_at: iso(16, 16),
      messages: [
        {
          id: 'msg-6',
          sender_type: 'host',
          sender_name: 'Team Member',
          body: 'It would help to see occupancy per property in one table.',
          created_at: iso(8, 14),
        },
        {
          id: 'msg-7',
          sender_type: 'admin',
          sender_name: 'Kame Support',
          body: 'Shipped in Analytics. Marking this resolved.',
          created_at: iso(16, 16),
        },
      ],
    },
    {
      id: TICKET_CLOSED,
      category: 'general_inquiry',
      subject: 'Two invoices for the same month',
      status: 'closed',
      created_at: iso(2, 8),
      updated_at: iso(6, 12),
      messages: [
        {
          id: 'msg-8',
          sender_type: 'host',
          sender_name: 'Team Member',
          body: 'I was charged twice in September.',
          created_at: iso(2, 8),
        },
        {
          id: 'msg-9',
          sender_type: 'admin',
          sender_name: 'Kame Support',
          body: 'One charge was refunded. Closing this now.',
          created_at: iso(6, 12),
        },
      ],
    },
    {
      id: TICKET_BUSINESS,
      category: 'business_inquiry',
      subject: 'Partnership for 20 units',
      status: 'open',
      created_at: iso(21, 10),
      updated_at: iso(21, 10),
      messages: [
        {
          id: 'msg-10',
          sender_type: 'host',
          sender_name: 'Team Member',
          body: 'We manage 20 units and would like a custom plan.',
          created_at: iso(21, 10),
        },
      ],
    },
  ];
}

function ticketDto(ticket: HelpTicketSeed, scope: HelpScope) {
  return {
    id: ticket.id,
    channel: 'host',
    organization_id: 'org-team-e2e-001',
    property_id: scope === 'property' ? 'property-team-e2e-001' : null,
    parking_id: scope === 'parking' ? 'parking-e2e-001' : null,
    submitted_by_user_id: 'user-team-e2e-001',
    submitted_by_name: 'Team Member',
    submitted_by_email: 'team-member@example.com',
    category: ticket.category,
    subject: ticket.subject,
    status: ticket.status,
    priority: null,
    category_fields: {},
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
  };
}

function messageDto(message: HelpTicketSeed['messages'][number], ticketId: string) {
  return {
    id: message.id,
    ticket_id: ticketId,
    sender_type: message.sender_type,
    sender_user_id: 'user-team-e2e-001',
    sender_name: message.sender_name,
    body: message.body,
    attachments: message.attachments ?? [],
    created_at: message.created_at,
  };
}

export type InstallHelpSupportOptions = {
  scope?: HelpScope;
  emptyTickets?: boolean;
  emptyFaqs?: boolean;
  failFaqs?: boolean;
  failArticles?: boolean;
  failTickets?: boolean;
  failTicketDetail?: boolean;
  failSubmit?: boolean;
  /** Template for the mocked host session. Read-only still has Help access. */
  permissionTemplate?: 'full_access' | 'read_only' | 'owner';
};

export async function installHelpSupportMocks(
  page: Page,
  options: InstallHelpSupportOptions = {}
): Promise<HelpSupportState> {
  // Seed the consent choice for any port, so the banner never covers a control
  // (the committed storage state only covers 4173/4174).
  await page.addInitScript(() => {
    try {
      localStorage.setItem('kh-cookie-consent', 'declined');
    } catch {
      // Storage blocked: the banner is dismissed by `dismissConsent` instead.
    }
  });

  const scope = options.scope ?? 'property';
  const state: HelpSupportState = {
    faqs: options.emptyFaqs ? [] : seededFaqs(),
    articles: seededArticles(),
    tickets: options.emptyTickets ? [] : seededTickets(),
    submitted: [],
    replies: [],
    reopened: [],
    lastListQuery: '',
  };

  if (scope === 'parking') {
    const parkingState = createParkingFlowState();
    parkingState.parkingSlug = HELP_E2E_PARKING_SLUG;
    parkingState.parkingId = 'parking-e2e-001';
    parkingState.parkingLabel = 'Tower 1 · B2 · 12A';
    await installParkingFlowMocks(page, parkingState);
  } else {
    await installPropertyTeamRbacMocks(page, options.permissionTemplate ?? 'full_access', {
      orgHub: scope === 'org',
    });
  }

  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();

    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const fail = (message: string) => json({ success: false, error: message }, 500);

    switch (endpoint) {
      case 'list-help-center-faqs':
        if (options.failFaqs) {
          await fail('faqs_unavailable');
          return;
        }
        await json({ success: true, data: { faqs: state.faqs } });
        return;

      case 'list-help-center-articles':
        if (options.failArticles) {
          await fail('articles_unavailable');
          return;
        }
        await json({ success: true, data: { articles: state.articles } });
        return;

      case 'list-support-tickets':
        state.lastListQuery = url.search;
        if (options.failTickets) {
          await fail('tickets_unavailable');
          return;
        }
        await json({
          success: true,
          data: {
            tickets: [...state.tickets]
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
              .map((ticket) => ticketDto(ticket, scope)),
          },
        });
        return;

      case 'get-support-ticket': {
        if (options.failTicketDetail) {
          await fail('ticket_unavailable');
          return;
        }
        const id = url.searchParams.get('ticket_id') ?? '';
        const ticket = state.tickets.find((item) => item.id === id);
        if (!ticket) {
          await json({ success: false, error: 'Ticket not found' }, 404);
          return;
        }
        await json({
          success: true,
          data: {
            ticket: ticketDto(ticket, scope),
            messages: ticket.messages.map((message) => messageDto(message, ticket.id)),
          },
        });
        return;
      }

      case 'submit-support-ticket': {
        if (options.failSubmit) {
          await fail('could_not_submit');
          return;
        }
        const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
        state.submitted.push(body);
        const id = 'f6666666-6666-4666-8666-666666666666';
        const now = new Date().toISOString();
        const created: HelpTicketSeed = {
          id,
          category: (body.category as HelpTicketSeed['category']) ?? 'general_inquiry',
          subject: String(body.subject ?? 'New ticket'),
          status: 'open',
          created_at: now,
          updated_at: now,
          messages: [
            {
              id: 'msg-created',
              sender_type: 'host',
              sender_name: 'Team Member',
              body: String(body.description ?? ''),
              created_at: now,
            },
          ],
        };
        state.tickets = [created, ...state.tickets];
        await json({
          success: true,
          data: {
            ticket: ticketDto(created, scope),
            message: messageDto(created.messages[0] as HelpTicketSeed['messages'][number], id),
          },
        });
        return;
      }

      case 'reply-support-ticket': {
        const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
        state.replies.push(body);
        const id = String(body.ticketId ?? '');
        const ticket = state.tickets.find((item) => item.id === id);
        if (!ticket) {
          await json({ success: false, error: 'Ticket not found' }, 404);
          return;
        }
        const now = new Date().toISOString();
        const reply = {
          id: `msg-reply-${ticket.messages.length + 1}`,
          sender_type: 'host' as const,
          sender_name: 'Team Member',
          body: String(body.message ?? ''),
          created_at: now,
        };
        ticket.messages = [...ticket.messages, reply];
        ticket.updated_at = now;
        await json({ success: true, data: { message: messageDto(reply, ticket.id) } });
        return;
      }

      case 'reopen-support-ticket': {
        const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
        const id = String(body.ticketId ?? '');
        state.reopened.push(id);
        const ticket = state.tickets.find((item) => item.id === id);
        if (!ticket) {
          await json({ success: false, error: 'Ticket not found' }, 404);
          return;
        }
        ticket.status = 'open';
        ticket.updated_at = new Date().toISOString();
        await json({ success: true, data: { ticket: ticketDto(ticket, scope) } });
        return;
      }

      case 'upload-support-ticket-attachment':
        await json({
          success: true,
          data: {
            attachment: {
              name: 'screenshot.png',
              mimeType: 'image/png',
              size: 68,
              path: 'org-team-e2e-001/user-team-e2e-001/screenshot.png',
            },
          },
        });
        return;

      default:
        await route.fallback();
    }
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

/** Scrolls an element to the middle of the viewport and holds, for recordings. */
export async function demoScrollTo(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector).first();
  if ((await target.count()) === 0) return;
  await target.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await demoPause(page, 0.8);
}

/** Consent storage only applies to the origin it was recorded on, so clear it explicitly. */
export async function dismissConsent(page: Page): Promise<void> {
  for (const name of ['Essential only', 'Necessary only', 'Accept all']) {
    const button = page.getByRole('button', { name });
    if (await button.isVisible().catch(() => false)) {
      // The consent bar animates in and can still cover itself for a frame.
      await button
        .first()
        .click({ force: true, timeout: 3_000 })
        .catch(() => undefined);
      return;
    }
  }
}

/** Wait for fonts and the two content requests to settle before a capture. */
export async function settleForCapture(page: Page, ms = 250): Promise<void> {
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(ms);
}

export function helpPath(scope: HelpScope): string {
  if (scope === 'org') return HELP_E2E_ORG_PATH;
  if (scope === 'parking') return HELP_E2E_PARKING_PATH;
  return HELP_E2E_PROPERTY_PATH;
}

/** Opens the mount landing page (FAQs) and waits for the module nav. */
export async function openHelpSupport(page: Page, scope: HelpScope = 'property') {
  await page.goto(helpPath(scope));
  await page.getByRole('heading', { name: 'Help & Support', exact: true }).waitFor({
    timeout: 30_000,
  });
  await dismissConsent(page);
}

