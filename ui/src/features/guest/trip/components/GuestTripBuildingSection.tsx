import { Building2 } from 'lucide-react';

import { GuestTripSection } from '@/features/guest/trip/components/GuestTripSection';
import type { GuestTrip } from '@/features/guest/trip/lib/guestTripApi';

import { Badge } from '@/components/ui/badge';

type Props = {
  buildingInfo: NonNullable<GuestTrip['buildingInfo']>;
};

const RULE_TONE: Record<string, string> = {
  prohibited: 'text-destructive',
  allowed: 'text-emerald-700 dark:text-emerald-400',
  info: 'text-muted-foreground',
};

/**
 * What the building (not the host) tells guests: its rules, requirements, guides and
 * facilities. Renders only what `guestInfoVisibility.stayGuide` allows; the API already
 * returned null otherwise.
 */
export function GuestTripBuildingSection({ buildingInfo }: Props) {
  const { requirements, guides, importantInfo, rules, poolFee, poolSchedule, amenities } =
    buildingInfo;

  const hasFacilities = poolFee != null || Boolean(poolSchedule) || amenities.length > 0;

  return (
    <GuestTripSection id="trip-building" title="The building">
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Building2 className="text-muted-foreground size-4" aria-hidden />
          Building rules
        </div>

        {rules.length > 0 ? (
          <ul className="border-border/70 divide-border/70 divide-y overflow-hidden rounded-lg border">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-start gap-2 px-3 py-2.5 text-sm">
                <span
                  className={`mt-0.5 shrink-0 text-xs font-semibold uppercase tracking-wide ${RULE_TONE[rule.type] ?? RULE_TONE.info}`}
                >
                  {rule.type === 'prohibited' ? 'No' : rule.type === 'allowed' ? 'Ok' : 'Note'}
                </span>
                <span className="min-w-0 flex-1">{rule.text}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {requirements ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold">Requirements</p>
            <p className="text-muted-foreground text-sm leading-relaxed">{requirements}</p>
          </div>
        ) : null}

        {guides.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold">Guides</p>
            <ul className="space-y-3">
              {guides.map((guide) => (
                <li key={guide.id} className="space-y-1">
                  <p className="text-sm font-medium">{guide.title}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{guide.content}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {importantInfo ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold">Important</p>
            <p className="text-muted-foreground text-sm leading-relaxed">{importantInfo}</p>
          </div>
        ) : null}

        {hasFacilities ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Facilities</p>
            <div className="flex flex-wrap gap-1.5">
              {amenities.map((amenity) => (
                <Badge key={amenity} variant="secondary" className="font-normal">
                  {amenity}
                </Badge>
              ))}
              {poolFee != null ? (
                <Badge variant="secondary" className="font-normal">
                  Pool ₱{poolFee.toLocaleString('en-PH')}
                </Badge>
              ) : null}
              {poolSchedule ? (
                <Badge variant="secondary" className="font-normal">
                  Pool {poolSchedule}
                </Badge>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </GuestTripSection>
  );
}
