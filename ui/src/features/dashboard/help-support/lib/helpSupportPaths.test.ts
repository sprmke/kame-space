import { describe, expect, it } from 'vitest';

import {
  useHelpSupportAdminScope,
  useHelpSupportBasePath,
  helpSupportDocsPath,
  helpSupportTicketsPath,
  helpSupportNewTicketPath,
  helpSupportTicketDetailPath,
  isSupportTicketId,
  resolveTicketsRouteSegment,
  ticketsComposeSearchParam,
  helpSupportSectionFromPath,
  isHelpSupportTicketDetailPath,
} from '@/features/dashboard/help-support/lib/helpSupportPaths';

const TICKET_ID = 'a1111111-1111-4111-8111-111111111111';

describe('isHelpSupportTicketDetailPath', () => {
  it.each([
    `/org/acme/property/villa/help-support/tickets/${TICKET_ID}`,
    `/org/acme/property/villa/help-support/tickets/${TICKET_ID}/`,
    `/org/acme/parking/slot-12a/help-support/tickets/${TICKET_ID}`,
    `/org/acme/help-support/tickets/${TICKET_ID}`,
  ])('recognises a ticket thread at %s', (path) => {
    expect(isHelpSupportTicketDetailPath(path)).toBe(true);
  });

  it.each([
    '/org/acme/property/villa/help-support',
    '/org/acme/property/villa/help-support/docs',
    '/org/acme/property/villa/help-support/tickets',
    '/org/acme/property/villa/help-support/tickets/',
    '/org/acme/property/villa/help-support/tickets/new',
    '/org/acme/property/villa/help-support/tickets/not-a-ticket-id',
  ])('does not treat %s as a ticket thread', (path) => {
    expect(isHelpSupportTicketDetailPath(path)).toBe(false);
  });
});

describe('useHelpSupportAdminScope', () => {
  it('useHelpSupportAdminScope is exported', () => {
    expect(typeof useHelpSupportAdminScope).toBe('function');
  });
});

describe('useHelpSupportBasePath', () => {
  it('useHelpSupportBasePath is exported', () => {
    expect(typeof useHelpSupportBasePath).toBe('function');
  });
});

describe('helpSupportDocsPath', () => {
  it('helpSupportDocsPath is exported', () => {
    expect(typeof helpSupportDocsPath).toBe('function');
  });
});

describe('helpSupportTicketsPath', () => {
  it('helpSupportTicketsPath is exported', () => {
    expect(typeof helpSupportTicketsPath).toBe('function');
  });
});

describe('helpSupportNewTicketPath', () => {
  it('helpSupportNewTicketPath is exported', () => {
    expect(typeof helpSupportNewTicketPath).toBe('function');
  });
});

describe('helpSupportTicketDetailPath', () => {
  it('helpSupportTicketDetailPath is exported', () => {
    expect(typeof helpSupportTicketDetailPath).toBe('function');
  });
});

describe('isSupportTicketId', () => {
  it('isSupportTicketId is exported', () => {
    expect(typeof isSupportTicketId).toBe('function');
  });
});

describe('resolveTicketsRouteSegment', () => {
  it('resolveTicketsRouteSegment is exported', () => {
    expect(typeof resolveTicketsRouteSegment).toBe('function');
  });
});

describe('ticketsComposeSearchParam', () => {
  it('ticketsComposeSearchParam is exported', () => {
    expect(typeof ticketsComposeSearchParam).toBe('function');
  });
});

describe('helpSupportSectionFromPath', () => {
  it('helpSupportSectionFromPath is exported', () => {
    expect(typeof helpSupportSectionFromPath).toBe('function');
  });
});
