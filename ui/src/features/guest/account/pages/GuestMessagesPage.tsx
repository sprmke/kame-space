import { useEffect, useState } from 'react';

import { Building2, RefreshCw } from 'lucide-react';

import { GuestAccountEmptyState } from '@/features/guest/account/components/GuestAccountEmptyState';
import {
  GUEST_MESSAGES_HUB_SHELL_CLASS,
  GuestMessagesHub,
} from '@/features/guest/account/components/GuestMessagesHub';
import { useGuestMessages } from '@/features/guest/account/hooks/useGuestMessages';
import {
  guestAccountListLayoutFromCount,
  guestAccountListLayoutStorageKey,
  readGuestAccountListLayoutHint,
  resolveGuestAccountListLoadState,
  writeGuestAccountListLayoutHint,
} from '@/features/guest/account/lib/guestAccountListLayout';

import { GuestAccountEmptyStateSkeleton } from '@/components/skeletons/GuestAccountSkeletons';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

const LAYOUT_KEY = guestAccountListLayoutStorageKey('messages');

function GuestMessagesHubSkeleton() {
  return (
    <div
      className={GUEST_MESSAGES_HUB_SHELL_CLASS}
      role="status"
      aria-busy="true"
      aria-label="Loading messages"
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="border-border flex h-full min-h-0 w-full shrink-0 flex-col border-r lg:w-[min(100%,320px)]">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-3 py-3">
                <div className="bg-muted mt-0.5 size-11 shrink-0 animate-pulse rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="bg-muted h-3 w-24 animate-pulse rounded-full" />
                    <div className="bg-muted h-2.5 w-8 animate-pulse rounded-full" />
                  </div>
                  <div className="bg-muted h-2.5 w-16 animate-pulse rounded-full" />
                  <div className="bg-muted h-2.5 w-full animate-pulse rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden h-full min-h-0 flex-1 flex-col overflow-hidden lg:flex">
          <div className="border-border shrink-0 border-b px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="bg-muted size-10 shrink-0 animate-pulse rounded-lg" />
              <div className="space-y-1.5">
                <div className="bg-muted h-3 w-32 animate-pulse rounded-full" />
                <div className="bg-muted h-2.5 w-24 animate-pulse rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-hidden p-4">
            <div className="bg-muted h-12 w-2/3 animate-pulse rounded-2xl" />
            <div className="bg-muted ml-auto h-10 w-1/2 animate-pulse rounded-2xl" />
            <div className="bg-muted h-14 w-3/4 animate-pulse rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function GuestMessagesPage() {
  usePageTitle(publicPageTitle('Messages'));
  const { data, isLoading, isError, refetch } = useGuestMessages();
  const [slowLoading, setSlowLoading] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setSlowLoading(false);
      return;
    }
    const timer = setTimeout(() => setSlowLoading(true), 15_000);
    return () => clearTimeout(timer);
  }, [isLoading]);
  const threads = data?.threads ?? [];
  const loadState = resolveGuestAccountListLoadState({
    isPending: isLoading,
    itemCount: data !== undefined ? threads.length : undefined,
    hint: readGuestAccountListLayoutHint(LAYOUT_KEY),
    coldDefault: 'empty',
  });

  useEffect(() => {
    if (loadState !== 'ready') return;
    writeGuestAccountListLayoutHint(LAYOUT_KEY, guestAccountListLayoutFromCount(threads.length));
  }, [loadState, threads.length]);

  if (loadState === 'empty') {
    return (
      <>
        <h1 className="sr-only">Messages</h1>
        <GuestAccountEmptyStateSkeleton mascotPose="guest-inbox" ariaLabel="Loading messages" />
        {slowLoading ? (
          <p className="text-muted-foreground mt-2 text-center text-xs">
            Taking longer than usual.{' '}
            <button
              type="button"
              className="text-foreground font-medium underline underline-offset-2"
              onClick={() => void refetch()}
            >
              Retry
            </button>
          </p>
        ) : null}
      </>
    );
  }

  if (loadState === 'list') {
    return (
      <>
        <h1 className="sr-only">Messages</h1>
        <GuestMessagesHubSkeleton />
        {slowLoading ? (
          <p className="text-muted-foreground mt-2 text-center text-xs">
            Taking longer than usual.{' '}
            <button
              type="button"
              className="text-foreground font-medium underline underline-offset-2"
              onClick={() => void refetch()}
            >
              Retry
            </button>
          </p>
        ) : null}
      </>
    );
  }

  if (isError) {
    return (
      <>
        <h1 className="sr-only">Messages</h1>
        <GuestAccountEmptyState
          mascotPose="gentle-failure"
          title="Couldn't load messages"
          description="Check your connection and try again."
          actionLabel="Try again"
          actionIcon={RefreshCw}
          onAction={() => void refetch()}
        />
      </>
    );
  }

  if (threads.length === 0) {
    return (
      <>
        <h1 className="sr-only">Messages</h1>
        <GuestAccountEmptyState
          mascotPose="guest-inbox"
          title="No messages yet"
          description="Chats with hosts about your stays will show up here."
          actionLabel="Browse properties"
          actionIcon={Building2}
          actionHref="/properties"
        />
      </>
    );
  }

  return (
    <>
      <h1 className="sr-only">Messages</h1>
      <GuestMessagesHub threads={threads} />
    </>
  );
}
