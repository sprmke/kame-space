import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BookingListQuickActions } from '@/features/dashboard/bookings/components/BookingListQuickActions';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import type { BookingChatMatch } from '@/features/dashboard/inbox/types/inbox';

import { EdgeResponseError } from '@/lib/api/edgeError';

const navigate = vi.fn();
const toastFn = vi.fn();
const toastError = vi.fn();
const fetchBookingChats = vi.fn();
const propertyAccess = vi.fn();
const parkingAccess = vi.fn();

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('sonner', () => ({
  toast: Object.assign((...args: unknown[]) => toastFn(...args), {
    error: (...args: unknown[]) => toastError(...args),
  }),
}));
vi.mock('@/features/dashboard/inbox/lib/inboxApi', () => ({
  fetchBookingChats: (...args: unknown[]) => fetchBookingChats(...args),
}));
vi.mock('@/features/dashboard/org/components/RequireOrgContext', () => ({
  useOptionalOrgContext: () => null,
}));
vi.mock('@/features/dashboard/org/components/RequireParkingContext', () => ({
  useOptionalParkingContext: () => null,
}));
vi.mock('@/features/dashboard/org/lib/adminApiScope', () => ({
  useOrgSlugParam: () => 'acme',
  useResolvedOrgId: () => 'org-1',
}));
vi.mock('@/features/dashboard/team/hooks/usePropertyPermissions', () => ({
  usePropertyPermissionsFor: (id: string | null) => propertyAccess(id),
}));
vi.mock('@/features/dashboard/team/hooks/useParkingPermissions', () => ({
  useParkingPermissions: (id: string | null) => parkingAccess(id),
}));

const propertyRow = {
  id: 'b-1',
  booking_kind: 'property',
  property_id: 'p-1',
  property_slug: 'solea',
  primary_guest_name: 'Maria Santos',
  guest_facebook_name: '',
  guest_email: 'maria@example.com',
} as unknown as BookingRow;

const parkingRow = {
  id: 'b-2',
  booking_kind: 'parking',
  parking_id: 'k-1',
  parking_slug: 'lot-a',
  primary_guest_name: 'Maria Santos',
  guest_facebook_name: '',
  guest_email: '',
} as unknown as BookingRow;

const chat = (over: Partial<BookingChatMatch> = {}): BookingChatMatch => ({
  id: 'c-1',
  platform: 'web',
  participant_name: 'Maria Santos',
  participant_avatar_url: null,
  last_message_at: new Date().toISOString(),
  last_message_preview: null,
  unread_count: 0,
  booking_id: 'b-1',
  match: 'booking',
  ...over,
});

function renderActions(row: BookingRow, onRowClick = vi.fn(), client = new QueryClient()) {
  render(
    <QueryClientProvider client={client}>
      <div onClick={onRowClick}>
        <BookingListQuickActions row={row} />
      </div>
    </QueryClientProvider>
  );
  return { onRowClick, client };
}

const chatButton = () => screen.queryByRole('button', { name: /Open chat with/i });

beforeEach(() => {
  vi.clearAllMocks();
  propertyAccess.mockReturnValue({ data: { permissions: ['inbox:view'] } });
  parkingAccess.mockReturnValue({ data: { permissions: ['inbox:view'] } });
  fetchBookingChats.mockResolvedValue([]);
});

describe('BookingListQuickActions visibility', () => {
  it('shows for a viewer with inbox:view and names the guest', () => {
    renderActions(propertyRow);
    expect(chatButton()?.getAttribute('aria-label')).toBe('Open chat with Maria Santos');
  });

  it('hides without inbox:view', () => {
    propertyAccess.mockReturnValue({ data: { permissions: ['bookings:view'] } });
    renderActions(propertyRow);
    expect(chatButton()).toBeNull();
  });

  it('hides until access has loaded, so there is no false affordance', () => {
    propertyAccess.mockReturnValue({ data: undefined });
    renderActions(propertyRow);
    expect(chatButton()).toBeNull();
  });

  it('hides when the row has no listing slug to open', () => {
    renderActions({ ...propertyRow, property_slug: null } as BookingRow);
    expect(chatButton()).toBeNull();
  });

  it('checks parking permissions, not property ones, for a parking row', () => {
    propertyAccess.mockReturnValue({ data: { permissions: ['inbox:view'] } });
    parkingAccess.mockReturnValue({ data: { permissions: [] } });
    renderActions(parkingRow);
    expect(chatButton()).toBeNull();
    expect(parkingAccess).toHaveBeenCalledWith('k-1');
    expect(propertyAccess).toHaveBeenCalledWith(null);
  });
});

describe('BookingListQuickActions click', () => {
  it('opens a single thread straight away with a deep link and scopes the lookup', async () => {
    fetchBookingChats.mockResolvedValue([chat()]);
    renderActions(propertyRow);
    fireEvent.click(chatButton()!);
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        '/org/acme/property/solea/messages?conversationId=c-1&platform=web'
      )
    );
    expect(fetchBookingChats).toHaveBeenCalledWith('acme', 'org-1', 'b-1', { propertyId: 'p-1' });
  });

  it('scopes a parking lookup to the parking and opens the parking inbox', async () => {
    fetchBookingChats.mockResolvedValue([chat({ id: 'c-9' })]);
    renderActions(parkingRow);
    fireEvent.click(chatButton()!);
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        '/org/acme/parking/lot-a/messages?conversationId=c-9&platform=web'
      )
    );
    expect(fetchBookingChats).toHaveBeenCalledWith('acme', 'org-1', 'b-2', { parkingId: 'k-1' });
  });

  it('does not let the click reach the row handler', async () => {
    fetchBookingChats.mockResolvedValue([chat()]);
    const { onRowClick } = renderActions(propertyRow);
    fireEvent.click(chatButton()!);
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('offers a picker for several threads and opens the one that is chosen', async () => {
    fetchBookingChats.mockResolvedValue([
      chat(),
      chat({ id: 'c-2', platform: 'facebook', match: 'name', participant_name: 'Mara S' }),
    ]);
    renderActions(propertyRow);
    fireEvent.click(chatButton()!);

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Maria Santos has 2 chats')).toBeTruthy();
    expect(screen.getByText(/Facebook · Name match/)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('option', { name: /Mara S/ }));
    expect(navigate).toHaveBeenCalledWith(
      '/org/acme/property/solea/messages?conversationId=c-2&platform=facebook'
    );
  });

  it('asks before opening a lone single-word name match', async () => {
    fetchBookingChats.mockResolvedValue([
      chat({ id: 'c-7', platform: 'facebook', match: 'name', participant_name: 'Santos' }),
    ]);
    renderActions(propertyRow);
    fireEvent.click(chatButton()!);

    expect(await screen.findByText('Is this Maria Santos?')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('option', { name: /Santos/ }));
    expect(navigate).toHaveBeenCalledWith(
      '/org/acme/property/solea/messages?conversationId=c-7&platform=facebook'
    );
  });

  it('can search Messages from the picker', async () => {
    fetchBookingChats.mockResolvedValue([chat(), chat({ id: 'c-2', platform: 'instagram' })]);
    renderActions(propertyRow);
    fireEvent.click(chatButton()!);
    fireEvent.click(await screen.findByRole('button', { name: /Search all chats/i }));
    expect(navigate).toHaveBeenCalledWith('/org/acme/property/solea/messages?search=Maria+Santos');
  });

  it('explains when there is no chat and offers a search', async () => {
    renderActions(propertyRow);
    fireEvent.click(chatButton()!);
    await waitFor(() => expect(toastFn).toHaveBeenCalled());
    const [message, options] = toastFn.mock.calls[0]!;
    expect(message).toBe('No chat for this booking yet');
    expect(navigate).not.toHaveBeenCalled();
    options.action.onClick();
    expect(navigate).toHaveBeenCalledWith('/org/acme/property/solea/messages?search=Maria+Santos');
  });

  it.each([
    [new EdgeResponseError('x', 403), 'You do not have access to Messages here'],
    [new EdgeResponseError('x', 404), 'This booking is no longer available'],
    [new Error('network'), 'Could not check chats. Try again'],
  ])('reports a failed lookup (%#) without navigating', async (error, message) => {
    fetchBookingChats.mockRejectedValue(error);
    renderActions(propertyRow);
    fireEvent.click(chatButton()!);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(message));
    expect(navigate).not.toHaveBeenCalled();
    // The control recovers so the host can try again.
    await waitFor(() => expect(chatButton()?.hasAttribute('disabled')).toBe(false));
  });

  it('disables itself while looking up and ignores a second tap', async () => {
    let resolve: (value: BookingChatMatch[]) => void = () => {};
    fetchBookingChats.mockReturnValue(new Promise((r) => (resolve = r)));
    renderActions(propertyRow);
    const button = chatButton()!;
    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('true'));
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
    expect(fetchBookingChats).toHaveBeenCalledTimes(1);
    resolve([chat()]);
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  });

  it('reuses a fresh answer instead of asking the server again', async () => {
    fetchBookingChats.mockResolvedValue([chat()]);
    renderActions(propertyRow);
    fireEvent.click(chatButton()!);
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    fireEvent.click(chatButton()!);
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(2));
    expect(fetchBookingChats).toHaveBeenCalledTimes(1);
  });
});
