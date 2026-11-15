import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

export const POST_PHOTO_PICK_LIMIT = 3;

type Props = {
  photos: string[];
  picked: string[];
  onChange: (picked: string[]) => void;
  disabled?: boolean;
};

/**
 * Which photos the post uses. Nothing picked means Auto: the best photos are ranked
 * for you. Picks lead the batch, first pick is the hero (up to three).
 */
export function AiStudioPostPhotos({ photos, picked, onChange, disabled }: Props) {
  if (photos.length === 0) return null;

  const toggle = (url: string) => {
    if (picked.includes(url)) onChange(picked.filter((item) => item !== url));
    else if (picked.length < POST_PHOTO_PICK_LIMIT) onChange([...picked, url]);
  };

  return (
    <div className="space-y-2" role="group" aria-label="Photos">
      <div className="flex items-baseline justify-between gap-3">
        <p className="settings-field-label">Photos</p>
        <p className="text-muted-foreground text-xs">
          {picked.length === 0 ? 'Auto: best photos' : `${picked.length} of ${POST_PHOTO_PICK_LIMIT}`}
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {photos.slice(0, 18).map((url) => {
          const order = picked.indexOf(url);
          const on = order !== -1;
          return (
            <button
              key={url}
              type="button"
              aria-pressed={on}
              aria-label={on ? `Photo ${order + 1}, tap to remove` : 'Use this photo'}
              disabled={disabled || (!on && picked.length >= POST_PHOTO_PICK_LIMIT)}
              onClick={() => toggle(url)}
              className={cn(
                'focus-visible:ring-ring relative size-[4.5rem] shrink-0 overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40 lg:size-16',
                on && 'ring-primary-strong ring-2'
              )}
            >
              <img src={url} alt="" loading="lazy" className="size-full object-cover" />
              {on ? (
                <span className="bg-primary-strong text-primary-foreground absolute right-1 top-1 flex size-5 items-center justify-center rounded-full text-[0.65rem] font-semibold">
                  {order === 0 ? <Check className="size-3" strokeWidth={3} aria-hidden /> : order + 1}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
