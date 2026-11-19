import type { ReactNode } from 'react';

import { PlatformLogo } from '@/features/dashboard/inbox/components/PlatformLogo';
import { platformLabel } from '@/features/dashboard/inbox/lib/inboxFormat';
import { INBOX_CHANNEL_ORDER } from '@/features/dashboard/inbox/lib/quickReplyGroups';
import type { ThreadPlatformFilter } from '@/features/dashboard/inbox/types/inbox';

import { FeatureStatusDot } from '@/components/feature-availability/FeatureStatusDot';
import { SlidingTabs, SlidingTabsList, SlidingTabsTrigger } from '@/components/ui/sliding-tabs';
import { cn } from '@/lib/utils';

const ALL_PLATFORMS: ThreadPlatformFilter[] = ['all', ...INBOX_CHANNEL_ORDER];

type Props = {
  value: ThreadPlatformFilter;
  onChange: (value: ThreadPlatformFilter) => void;
  platforms?: ThreadPlatformFilter[];
  /** When true, show status dots on Facebook / Instagram tabs (`inbox.meta` off). */
  metaFeatureOff?: boolean;
  /** Sync / import status (and similar) — sits on the right of the tab row. */
  trailing?: ReactNode;
};

export function InboxPlatformTabs({
  value,
  onChange,
  platforms = ALL_PLATFORMS,
  metaFeatureOff = false,
  trailing,
}: Props) {
  // Single channel (e.g. parking Chat-only) — no platform switcher needed.
  if (platforms.length <= 1) {
    if (!trailing) return null;
    return (
      <div className="border-border flex shrink-0 items-center justify-end gap-2 border-b px-3 py-2.5">
        {trailing}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border-border flex shrink-0 items-center gap-2 border-b',
        'px-2 py-2 sm:gap-3 sm:px-3'
      )}
    >
      <SlidingTabs
        value={value}
        onValueChange={(next) => onChange(next as ThreadPlatformFilter)}
        className="min-w-0 flex-1"
      >
        <SlidingTabsList
          size="compact"
          className="h-11 w-full max-w-none justify-start gap-0.5 overflow-x-auto rounded-none bg-transparent p-1"
          pillClassName="bg-muted rounded-md shadow-none"
          aria-label="Platform"
          remeasureDeps={[platforms.length, value]}
        >
          {platforms.map((platform) => {
            const label = platform === 'all' ? 'All' : platformLabel(platform);
            return (
              <SlidingTabsTrigger
                key={platform}
                value={platform}
                className="shrink-0 gap-2 px-3 font-medium"
              >
                {platform !== 'all' && <PlatformLogo platform={platform} size="xs" />}
                {metaFeatureOff && (platform === 'facebook' || platform === 'instagram') ? (
                  <FeatureStatusDot label={`${label} unavailable`} />
                ) : null}
                {label}
              </SlidingTabsTrigger>
            );
          })}
        </SlidingTabsList>
      </SlidingTabs>
      {trailing ? <div className="shrink-0 pr-0.5">{trailing}</div> : null}
    </div>
  );
}
