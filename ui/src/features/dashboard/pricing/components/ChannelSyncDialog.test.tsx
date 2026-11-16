import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChannelSyncDialog } from './ChannelSyncDialog';

import type { CalendarSyncFeed, CalendarSyncSettings } from '../lib/calendarSyncApi';

const mocks = vi.hoisted(() => ({
  settings: undefined as unknown,
  addMutate: vi.fn(),
  shareMutate: vi.fn(),
  paused: new Set<string>(),
  canUse: true,
}));

vi.mock('@/features/dashboard/pricing/hooks/useCalendarSync', () => {
  const idle = () => ({ mutate: vi.fn(), isPending: false, variables: undefined });
  return {
    useCalendarSyncSettings: () => ({
      data: mocks.settings,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useAddCalendarFeed: () => ({ mutate: mocks.addMutate, isPending: false }),
    useRemoveCalendarFeed: idle,
    useSetExportEnabled: () => ({ mutate: mocks.shareMutate, isPending: false }),
    useSetCreateBookings: idle,
    useSyncFeedNow: idle,
  };
});
vi.mock('@/features/dashboard/plans/hooks/useFeatureGate', () => ({
  useFeatureGate: () => ({ canUse: mocks.canUse, isLoading: false }),
}));
vi.mock('@/features/dashboard/plans/components/UpgradeModalProvider', () => ({
  useUpgradeModal: () => ({ open: vi.fn() }),
}));
vi.mock('@/features/dashboard/plans/components/TierBadge', () => ({
  TierBadge: () => null,
  TierBadgeAnchor: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/featureAvailability/useFeatureAvailability', () => ({
  useFeatureAvailability: (key: string) => ({
    available: !mocks.paused.has(key),
    isLoading: false,
    label: 'Paused',
    message: 'Paused for maintenance',
    expectedBackLabel: null,
    reason: 'maintenance',
    tone: 'warning',
  }),
}));
vi.mock('@/components/feature-availability/FeatureAvailabilityButton', () => ({
  FeatureAvailabilityButton: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/components/feature-availability/FeatureUnavailableNotice', () => ({
  FeatureUnavailableNotice: ({ label }: { label: string }) => <p>{label}</p>,
}));
vi.mock('@/components/feature-availability/FeatureUnavailablePanel', () => ({
  FeatureUnavailablePanel: () => null,
}));
vi.mock('@/components/ui/responsive-modal', () => {
  const Pass = ({ children }: { children?: unknown }) => <div>{children as never}</div>;
  return {
    ResponsiveModal: ({ open, children }: { open: boolean; children?: unknown }) =>
      open ? <div>{children as never}</div> : null,
    ResponsiveModalContent: Pass,
    ResponsiveModalHeader: Pass,
    ResponsiveModalTitle: Pass,
    ResponsiveModalDescription: Pass,
  };
});
vi.mock('@/lib/featureAvailability/featureUnavailableError', () => ({
  toastFeatureUnavailable: vi.fn(),
}));
vi.mock('@/utils/format/bookingDisplay', () => ({ formatRelative: () => 'just now' }));

function feed(over: Partial<CalendarSyncFeed> = {}): CalendarSyncFeed {
  return {
    id: 'f1',
    provider: 'airbnb',
    label: null,
    isActive: true,
    createBookings: true,
    maskedUrl: '••••',
    hasUrl: true,
    health: 'ok',
    lastAttemptedAt: null,
    lastSuccessAt: '2026-11-17T01:00:00Z',
    lastError: null,
    consecutiveFailures: 0,
    createdAt: '2026-11-01T00:00:00Z',
    ...over,
  };
}

function settings(over: Partial<CalendarSyncSettings> = {}): CalendarSyncSettings {
  return {
    feeds: [],
    export: {
      enabled: true,
      rotatedAt: null,
      lastServedAt: null,
      urls: {
        all: 'https://x/all',
        airbnb: 'https://x/airbnb',
        agoda: 'https://x/agoda',
        booking_com: 'https://x/booking',
      },
    },
    recentEvents: [],
    connectableProviders: ['airbnb'],
    ...over,
  };
}

function renderDialog(readOnly = false) {
  return render(<ChannelSyncDialog open onOpenChange={vi.fn()} readOnly={readOnly} />);
}

beforeEach(() => {
  mocks.paused = new Set();
  mocks.canUse = true;
  mocks.addMutate.mockReset();
  mocks.shareMutate.mockReset();
  mocks.settings = settings();
});

describe('ChannelSyncDialog', () => {
  it('lists only Airbnb when nothing else is rolled out', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /^Airbnb, Not connected/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Agoda/ })).toBeNull();
  });

  it('lists rolled-out channels with their status', () => {
    mocks.settings = settings({
      connectableProviders: ['airbnb', 'agoda', 'booking_com'],
      feeds: [feed(), feed({ id: 'f2', provider: 'agoda', health: 'error' })],
    });
    renderDialog();
    expect(screen.getByRole('button', { name: /^Airbnb, Connected/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Agoda, Needs attention/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Booking.com, Not connected/ })).toBeTruthy();
    expect(screen.getByText(/Connect each channel to Kame Space only/)).toBeTruthy();
  });

  it('shows a paused channel as paused', () => {
    mocks.paused = new Set(['pricing.channel_sync.agoda']);
    mocks.settings = settings({
      connectableProviders: ['airbnb', 'agoda'],
      feeds: [feed({ provider: 'agoda' })],
    });
    renderDialog();
    expect(screen.getByRole('button', { name: /^Agoda, Paused/ })).toBeTruthy();
  });

  it('opens the Agoda setup with its steps and eligibility hint', () => {
    mocks.settings = settings({ connectableProviders: ['airbnb', 'agoda'] });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Agoda/ }));
    expect(screen.getByRole('heading', { name: 'From Agoda' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'To Agoda' })).toBeTruthy();
    expect(screen.getByPlaceholderText('https://…agoda.com/…')).toBeTruthy();
  });

  it('rejects a link from the wrong host and connects a valid one', () => {
    mocks.settings = settings({ connectableProviders: ['airbnb', 'agoda'] });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Agoda/ }));
    const input = screen.getByPlaceholderText('https://…agoda.com/…');
    fireEvent.change(input, { target: { value: 'https://www.airbnb.com/calendar/ical/1.ics' } });
    expect(screen.getByText('Paste the Agoda calendar link')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(
      true
    );

    fireEvent.change(input, { target: { value: 'https://ycs.agoda.com/ical/abc.ics' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(mocks.addMutate).toHaveBeenCalledWith(
      { provider: 'agoda', icsUrl: 'https://ycs.agoda.com/ical/abc.ics' },
      expect.anything()
    );
  });

  it('shows the never-read and closed-dates warnings on their channel', () => {
    mocks.settings = settings({
      connectableProviders: ['airbnb', 'agoda', 'booking_com'],
      feeds: [
        feed({ id: 'a', provider: 'agoda', exportNeverRead: true }),
        feed({ id: 'b', provider: 'booking_com', echoWarning: true }),
      ],
    });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Agoda/ }));
    expect(screen.getByText(/Agoda hasn't read your link yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'All channels' }));
    fireEvent.click(screen.getByRole('button', { name: /^Booking.com/ }));
    expect(screen.getByText(/sending back closed dates/)).toBeTruthy();
  });

  it('hides connect actions for view-only members', () => {
    mocks.settings = settings({ connectableProviders: ['airbnb', 'agoda'] });
    renderDialog(true);
    fireEvent.click(screen.getByRole('button', { name: /^Agoda/ }));
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
    expect(screen.getByText('No calendar connected')).toBeTruthy();
  });

  it('asks before leaving the setup view with a typed link, and keeps it on Keep editing', () => {
    mocks.settings = settings({ connectableProviders: ['airbnb', 'agoda'] });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Agoda/ }));
    const input = screen.getByPlaceholderText('https://…agoda.com/…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://ycs.agoda.com/ical/abc.ics' } });
    fireEvent.click(screen.getByRole('button', { name: 'All channels' }));
    expect(screen.getByText('Discard your changes?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(input.value).toBe('https://ycs.agoda.com/ical/abc.ics');
  });

  it('leaves without a prompt when nothing was typed', () => {
    mocks.settings = settings({ connectableProviders: ['airbnb', 'agoda'] });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Agoda/ }));
    fireEvent.click(screen.getByRole('button', { name: 'All channels' }));
    expect(screen.getByRole('button', { name: /^Airbnb/ })).toBeTruthy();
  });

  it('explains why Create bookings is off for Agoda and Booking.com, not Airbnb', () => {
    mocks.settings = settings({
      connectableProviders: ['airbnb', 'agoda'],
      feeds: [feed({ createBookings: false, provider: 'agoda' })],
    });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Agoda/ }));
    fireEvent.click(screen.getByRole('button', { name: 'About Create bookings' }));
    expect(screen.getByText(/Closed dates can look like stays in Agoda/)).toBeTruthy();
  });

  it('shows a never-synced feed as Connected, with no second connect button', () => {
    mocks.settings = settings({
      connectableProviders: ['airbnb', 'agoda'],
      feeds: [feed({ provider: 'agoda', lastSuccessAt: null })],
    });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Agoda/ }));
    expect(screen.getByText('Waiting for first sync')).toBeTruthy();
    expect(screen.queryByText(/Connect another/)).toBeNull();
    expect(screen.getAllByText('Connected').length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText('https://…agoda.com/…')).toBeNull();
  });

  it('shows activity for the open channel only, collapsed until opened', () => {
    mocks.settings = settings({
      connectableProviders: ['airbnb', 'agoda'],
      feeds: [feed({ id: 'f-ago', provider: 'agoda' })],
      recentEvents: [
        {
          id: 1,
          feed_id: 'f-ago',
          action: 'block_created',
          external_uid: 'u',
          start_date: '2027-09-01',
          end_date: '2027-09-04',
          summary: 'Reserved',
          detail: null,
          created_at: '2026-11-17T01:00:00Z',
        },
      ],
    });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Agoda/ }));
    fireEvent.click(screen.getByText('Recent activity'));
    expect(screen.getByText('Busy dates imported')).toBeTruthy();
  });

  it('shows the export link and last read time when sharing is on', () => {
    mocks.settings = settings({
      connectableProviders: ['airbnb', 'agoda'],
      feeds: [feed({ provider: 'agoda' })],
      export: {
        ...settings().export,
        enabled: true,
        reads: { agoda: { lastReadAt: '2026-11-17T02:00:00Z', readCount: 3 } },
      },
    });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Agoda/ }));
    expect((screen.getByLabelText('Agoda export link') as HTMLInputElement).value).toBe(
      'https://x/agoda'
    );
    expect(screen.getByText('Read just now')).toBeTruthy();
  });

  it('asks before turning sharing off while a channel is connected', () => {
    mocks.settings = settings({
      connectableProviders: ['airbnb', 'agoda'],
      feeds: [feed({ provider: 'agoda' })],
    });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Agoda/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Share dates with Agoda' }));
    expect(screen.getByText('Stop sharing dates?')).toBeTruthy();
    expect(mocks.shareMutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    expect(mocks.shareMutate).toHaveBeenCalledWith(false, expect.anything());
  });

  it('turns sharing off without a prompt when nothing is connected', () => {
    mocks.settings = settings({ connectableProviders: ['airbnb', 'agoda'] });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Agoda/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Share dates with Agoda' }));
    expect(screen.queryByText('Stop sharing dates?')).toBeNull();
    expect(mocks.shareMutate).toHaveBeenCalledWith(false);
  });

  it('keeps a view-only member from changing anything', () => {
    mocks.settings = settings({
      connectableProviders: ['airbnb', 'agoda'],
      feeds: [feed({ provider: 'agoda' })],
    });
    renderDialog(true);
    fireEvent.click(screen.getByRole('button', { name: /^Agoda/ }));
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Sync .* now/ })).toBeNull();
    expect(
      (screen.getByRole('switch', { name: 'Share dates with Agoda' }) as HTMLButtonElement).disabled
    ).toBe(true);
  });
});
