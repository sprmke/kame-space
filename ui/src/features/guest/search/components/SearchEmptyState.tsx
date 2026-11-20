import { MapPin } from 'lucide-react';

import { KameMascotImage } from '@/components/branding/KameMascotImage';
import { Button } from '@/components/ui/button';

type Props = {
  where: string;
  onClearDates?: () => void;
  onClearWhere?: () => void;
  onSearchNearby?: () => void;
  /** Nearby without browser coords — prompt for permission. */
  needsLocation?: boolean;
  onRequestLocation?: () => void;
  locationRequesting?: boolean;
  /** Soft concept expansion note when literal + expanded both empty. */
  smartFallbackLabel?: string | null;
};

export function SearchEmptyState({
  where,
  onClearDates,
  onClearWhere,
  onSearchNearby,
  needsLocation = false,
  onRequestLocation,
  locationRequesting = false,
  smartFallbackLabel,
}: Props) {
  if (needsLocation) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20 text-center sm:py-24">
        <span className="bg-muted text-muted-foreground mb-5 flex size-14 items-center justify-center rounded-2xl">
          <MapPin className="h-6 w-6" aria-hidden />
        </span>
        <h2 className="text-foreground text-base font-semibold sm:text-lg">Location needed</h2>
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
          Allow location to see stays and parking near you.
        </p>
        {onRequestLocation ? (
          <Button
            type="button"
            onClick={onRequestLocation}
            disabled={locationRequesting}
            className="mt-5 min-h-11 rounded-full px-5"
          >
            {locationRequesting ? 'Checking…' : 'Use my location'}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center sm:py-20">
      <div className="motion-safe:animate-float relative mb-5 w-36 sm:mb-6 sm:w-40" aria-hidden>
        <KameMascotImage pose="gentle-failure" />
      </div>
      <h2 className="text-foreground text-base font-semibold sm:text-lg">No matches</h2>
      {where ? (
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
          Nothing available for “{where}”. Try another place or dates.
        </p>
      ) : (
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
          Try a city, development, or different dates.
        </p>
      )}
      {smartFallbackLabel ? (
        <p className="text-muted-foreground mt-2 max-w-md text-xs">
          Also checked related matches for {smartFallbackLabel}.
        </p>
      ) : null}
      <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
        {onSearchNearby ? (
          <Button type="button" onClick={onSearchNearby} className="min-h-11 rounded-full px-5">
            Search nearby
          </Button>
        ) : null}
        {onClearWhere && where ? (
          <Button
            type="button"
            variant="outline"
            onClick={onClearWhere}
            className="min-h-11 rounded-full px-5"
          >
            Clear place
          </Button>
        ) : null}
        {onClearDates ? (
          <Button
            type="button"
            variant="outline"
            onClick={onClearDates}
            className="min-h-11 rounded-full px-5"
          >
            Clear dates
          </Button>
        ) : null}
      </div>
    </div>
  );
}
