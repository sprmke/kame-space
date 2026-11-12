import { Building2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { GuestStayGuideDto } from '@/features/guest/stay-guide/lib/api';

type Props = {
  info: NonNullable<GuestStayGuideDto['buildingInfo']>;
};

/**
 * What the building itself tells guests.
 *
 * The guide above is the host's design; this is system content, so it sits below the
 * template in the app's own tokens rather than inside a host-composed chapter.
 */
export function StayGuideBuildingBlock({ info }: Props) {
  const hasFacilities = info.poolFee != null || Boolean(info.poolSchedule) || info.amenities.length > 0;

  return (
    <section
      aria-labelledby="stay-guide-building-heading"
      className="border-border/70 mx-auto max-w-4xl border-t px-5 py-10 @md:px-8"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Building2 className="text-muted-foreground size-5" aria-hidden />
          <h2 id="stay-guide-building-heading" className="text-lg font-semibold tracking-tight">
            The building
          </h2>
        </div>

        {info.rules.length > 0 ? (
          <ul className="border-border divide-border divide-y overflow-hidden rounded-xl border">
            {info.rules.map((rule) => (
              <li key={rule.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={
                    rule.type === 'prohibited'
                      ? 'text-destructive shrink-0 text-xs font-semibold uppercase tracking-wide'
                      : rule.type === 'allowed'
                        ? 'shrink-0 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400'
                        : 'text-muted-foreground shrink-0 text-xs font-semibold uppercase tracking-wide'
                  }
                >
                  {rule.type === 'prohibited' ? 'No' : rule.type === 'allowed' ? 'Ok' : 'Note'}
                </span>
                <span className="min-w-0 flex-1 text-sm leading-relaxed">{rule.text}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {info.requirements ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Requirements</h3>
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
              {info.requirements}
            </p>
          </div>
        ) : null}

        {info.guides.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Guides</h3>
            <ul className="space-y-3">
              {info.guides.map((guide) => (
                <li key={guide.id} className="space-y-1">
                  <p className="text-sm font-medium">{guide.title}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                    {guide.content}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {info.importantInfo ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Important</h3>
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
              {info.importantInfo}
            </p>
          </div>
        ) : null}

        {hasFacilities ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Facilities</h3>
            <div className="flex flex-wrap gap-1.5">
              {info.amenities.map((amenity) => (
                <Badge key={amenity} variant="secondary" className="font-normal">
                  {amenity}
                </Badge>
              ))}
              {info.poolFee != null ? (
                <Badge variant="secondary" className="font-normal">
                  Pool ₱{info.poolFee.toLocaleString('en-PH')}
                </Badge>
              ) : null}
              {info.poolSchedule ? (
                <Badge variant="secondary" className="font-normal">
                  Pool {info.poolSchedule}
                </Badge>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
