import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CalendarSyncFeed, CalendarSyncSettings } from '../lib/calendarSyncApi';
import { ChannelSyncDialog } from './ChannelSyncDialog';

const mocks = vi.hoisted(() => ({
  settings: undefined as unknown,
  addMutate: vi.fn(),
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
    useSetExportEnabled: idle,
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
        vrbo: 'https://x/vrbo',
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
    expect(screen.getByRole('button', { name: /^Airbnb, Syncing/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Agoda, Needs attention/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Booking.com, Not connected/ })).toBeTruthy();
    expect(screen.getByText('Connect each channel only to Kame Space.')).toBeTruthy();
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
    expect(screen.getByText('1. Bring Agoda in')).toBeTruthy();
    expect(screen.getByText(/exactly 1 room/)).toBeTruthy();
    expect(screen.getByText('2. Send Kame Space to Agoda')).toBeTruthy();
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
    fireEvent.click(screen.getByText('All channels'));
    fireEvent.click(screen.getByRole('button', { name: /^Booking.com/ }));
    expect(screen.getByText(/sending back closed dates/)).toBeTruthy();
  });

  it('hides connect actions for view-only members', () => {
    mocks.settings = settings({ connectableProviders: ['airbnb', 'agoda'] });
    renderDialog(true);
    fireEvent.click(screen.getByRole('button', { name: /^Agoda/ }));
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
    expect(screen.getByText('No Agoda calendar')).toBeTruthy();
  });
});
