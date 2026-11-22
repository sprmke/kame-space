import { useEffect, useRef } from 'react';

import { Bookmark } from 'lucide-react';

import { MUSIC_GROUPS, type MusicGroup } from '@/features/dashboard/marketing/lib/music/musicTypes';

import { cn } from '@/lib/utils';

export const SAVED_GROUP = 'saved';

type Props = {
  /** A group slug, or `saved`. */
  value: string;
  onChange: (slug: string) => void;
  savedCount: number;
};

function Chip({
  selected,
  onClick,
  children,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    // Keep a chip in view after it is picked, but leave the row alone on first render so the
    // first chips are not clipped.
    if (mounted.current && selected) {
      ref.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
    }
    mounted.current = true;
  }, [selected]);
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-[44px] shrink-0 touch-manipulation items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors',
        selected
          ? 'border-primary-strong bg-primary-strong text-primary-foreground'
          : 'border-border text-foreground hover:bg-muted'
      )}
    >
      {children}
    </button>
  );
}

function divider(prev: MusicGroup | undefined, next: MusicGroup): boolean {
  return Boolean(prev && prev.kind !== next.kind);
}

/** Trending, genres, moods and "for stays" collections as one swipeable row, like a story's music. */
export function MusicGroupChips({ value, onChange, savedCount }: Props) {
  return (
    <div
      role="group"
      aria-label="Music groups"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <Chip
        selected={value === SAVED_GROUP}
        onClick={() => onChange(SAVED_GROUP)}
        label={savedCount > 0 ? `Saved, ${savedCount}` : 'Saved'}
      >
        <Bookmark className="size-3.5" aria-hidden />
        Saved
      </Chip>
      {MUSIC_GROUPS.map((group, index) => (
        <div key={group.slug} className="flex shrink-0 items-center gap-2">
          {divider(MUSIC_GROUPS[index - 1], group) ? (
            <span aria-hidden className="bg-border h-5 w-px" />
          ) : null}
          <Chip selected={value === group.slug} onClick={() => onChange(group.slug)}>
            {group.label}
          </Chip>
        </div>
      ))}
    </div>
  );
}
