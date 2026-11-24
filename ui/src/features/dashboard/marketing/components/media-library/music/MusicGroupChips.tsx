import { useEffect, useRef } from 'react';

import { Bookmark } from 'lucide-react';

import {
  MUSIC_GROUPS,
  type MusicGroup,
  type MusicGroupKind,
} from '@/features/dashboard/marketing/lib/music/musicTypes';

import { cn } from '@/lib/utils';

export const SAVED_GROUP = 'saved';

type BrowseSection = 'saved' | 'trending' | 'popular' | 'genre' | 'mood' | 'collection';

type Props = {
  /** A group slug, or `saved`. */
  value: string;
  onChange: (slug: string) => void;
  savedCount: number;
};

const SECTION_DEFAULT: Record<'genre' | 'mood' | 'collection', string> = {
  genre: 'chill',
  mood: 'happy',
  collection: 'beach-day',
};

function sectionForValue(value: string): BrowseSection {
  if (value === SAVED_GROUP) return 'saved';
  if (value === 'trending') return 'trending';
  if (value === 'popular') return 'popular';
  const group = MUSIC_GROUPS.find((entry) => entry.slug === value);
  if (group?.kind === 'genre' || group?.kind === 'mood' || group?.kind === 'collection') {
    return group.kind;
  }
  return 'trending';
}

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

function ChipRow({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
}

function groupsOfKind(kind: MusicGroupKind): MusicGroup[] {
  return MUSIC_GROUPS.filter((group) => group.kind === kind);
}

/**
 * Browse music in two steps: a short section row, then genres / moods / stay collections when
 * needed. Keeps the Instagram-style swipe without dumping every tag at once.
 */
export function MusicGroupChips({ value, onChange, savedCount }: Props) {
  const section = sectionForValue(value);
  const nestedKind =
    section === 'genre' || section === 'mood' || section === 'collection' ? section : null;
  const nestedGroups = nestedKind ? groupsOfKind(nestedKind) : [];

  const pickSection = (next: BrowseSection) => {
    if (next === 'saved') {
      onChange(SAVED_GROUP);
      return;
    }
    if (next === 'trending' || next === 'popular') {
      onChange(next);
      return;
    }
    const current = MUSIC_GROUPS.find((entry) => entry.slug === value);
    if (current?.kind === next) return;
    onChange(SECTION_DEFAULT[next]);
  };

  return (
    <div className="space-y-2" role="group" aria-label="Music groups">
      <ChipRow label="Music sections">
        <Chip
          selected={section === 'saved'}
          onClick={() => pickSection('saved')}
          label={savedCount > 0 ? `Saved, ${savedCount}` : 'Saved'}
        >
          <Bookmark className="size-3.5" aria-hidden />
          Saved
        </Chip>
        <Chip selected={section === 'trending'} onClick={() => pickSection('trending')}>
          Trending
        </Chip>
        <Chip selected={section === 'popular'} onClick={() => pickSection('popular')}>
          Popular
        </Chip>
        <Chip selected={section === 'genre'} onClick={() => pickSection('genre')}>
          Genres
        </Chip>
        <Chip selected={section === 'mood'} onClick={() => pickSection('mood')}>
          Moods
        </Chip>
        <Chip selected={section === 'collection'} onClick={() => pickSection('collection')}>
          For stays
        </Chip>
      </ChipRow>

      {nestedKind ? (
        <ChipRow
          label={
            nestedKind === 'genre' ? 'Genres' : nestedKind === 'mood' ? 'Moods' : 'For stays'
          }
        >
          {nestedGroups.map((group) => (
            <Chip
              key={group.slug}
              selected={value === group.slug}
              onClick={() => onChange(group.slug)}
            >
              {group.label}
            </Chip>
          ))}
        </ChipRow>
      ) : null}
    </div>
  );
}
