import { useState } from 'react';

import { motion } from 'framer-motion';
import {
  AlertCircle,
  Baby,
  Ban,
  Camera,
  Check,
  ChevronRight,
  Clock,
  Cigarette,
  Home,
  ListChecks,
  PartyPopper,
  PawPrint,
  Users,
  Volume2,
  type LucideIcon,
} from 'lucide-react';

import { CancellationPolicyDisplay } from '@/features/guest/marketing/properties/components/property-detail/CancellationPolicyDisplay';
import { GuestDialogShell } from '@/features/guest/marketing/shared/components/GuestDialogShell';

import type { ResolvedCancellationPolicyDisplay } from '@/features/dashboard/org/lib/cancellationPolicy';
import type { ResolvedHouseRule } from '@/features/dashboard/org/lib/propertyHouseRulesConstants';
import type { PublicBuildingInfo } from '@/features/guest/marketing/properties/types/publicProperty';

import { Button } from '@/components/ui/button';

interface PropertyRulesProps {
  houseRules: ResolvedHouseRule[];
  maxGuests?: number | null;
  cancellationPolicy: ResolvedCancellationPolicyDisplay;
  showSafetySection?: boolean;
  /** Building rules and info; the API returns null when the residence hides it. */
  buildingInfo?: PublicBuildingInfo | null;
}

const DISPLAY_LIMIT = 6;

const RULE_ICONS: Record<string, LucideIcon> = {
  check_in_after: Clock,
  check_out_before: Clock,
  quiet_hours: Volume2,
  no_smoking: Cigarette,
  no_parties: PartyPopper,
  no_shoes_inside: Ban,
  no_loud_music: Volume2,
  pets_allowed: PawPrint,
  no_pets: PawPrint,
  suitable_for_children: Baby,
  registered_guests_only: Users,
  security_cameras: Camera,
  self_check_in: Home,
  no_cooking_smelly_food: Ban,
};

const safetyFeatures = [
  'Smoke alarm',
  'Carbon monoxide alarm',
  'Fire extinguisher',
  'First aid kit',
  '24/7 security',
];

function ruleIcon(rule: ResolvedHouseRule): LucideIcon {
  return RULE_ICONS[rule.id] ?? ListChecks;
}

function HouseRuleCard({ rule }: { rule: ResolvedHouseRule }) {
  const Icon = ruleIcon(rule);

  return (
    <div className="border-border bg-card flex items-center gap-3 rounded-lg border p-3">
      <div
        className={`rounded-full p-2 ${
          rule.type === 'prohibited'
            ? 'bg-red-100 dark:bg-red-950'
            : rule.type === 'allowed'
              ? 'bg-green-100 dark:bg-green-950'
              : 'bg-muted'
        }`}
      >
        <Icon
          className={`h-4 w-4 ${
            rule.type === 'prohibited'
              ? 'text-red-600 dark:text-red-400'
              : rule.type === 'allowed'
                ? 'text-green-600 dark:text-green-400'
                : 'text-muted-foreground'
          }`}
        />
      </div>
      <span className="text-foreground text-sm">{rule.text}</span>
    </div>
  );
}

function HouseRulesGrid({ rules }: { rules: ResolvedHouseRule[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {rules.map((rule) => (
        <HouseRuleCard key={rule.id} rule={rule} />
      ))}
    </div>
  );
}

/** What the building itself tells guests (residence config, not the host's own rules). */
function BuildingRulesBlock({ info }: { info: PublicBuildingInfo }) {
  const hasFacilities = info.poolFee != null || Boolean(info.poolSchedule) || info.amenities.length > 0;

  return (
    <div className="space-y-4">
      <h2 className="text-foreground @xl:text-xl text-lg font-semibold">The building</h2>

      {info.rules.length > 0 ? (
        <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
          {info.rules.map((rule) => (
            <li key={rule.id} className="flex items-start gap-3 px-4 py-3">
              <span
                className={
                  rule.type === 'prohibited'
                    ? 'text-destructive text-xs font-semibold uppercase tracking-wide'
                    : rule.type === 'allowed'
                      ? 'text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400'
                      : 'text-muted-foreground text-xs font-semibold uppercase tracking-wide'
                }
              >
                {rule.type === 'prohibited' ? 'No' : rule.type === 'allowed' ? 'Ok' : 'Note'}
              </span>
              <span className="text-foreground min-w-0 flex-1 text-sm">{rule.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {info.requirements ? (
        <div className="space-y-1">
          <h3 className="text-foreground text-sm font-semibold">Requirements</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">{info.requirements}</p>
        </div>
      ) : null}

      {info.guides.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-foreground text-sm font-semibold">Guides</h3>
          <ul className="space-y-3">
            {info.guides.map((guide) => (
              <li key={guide.id} className="space-y-1">
                <p className="text-foreground text-sm font-medium">{guide.title}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{guide.content}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {info.importantInfo ? (
        <div className="space-y-1">
          <h3 className="text-foreground text-sm font-semibold">Important</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">{info.importantInfo}</p>
        </div>
      ) : null}

      {hasFacilities ? (
        <div className="space-y-2">
          <h3 className="text-foreground text-sm font-semibold">Facilities</h3>
          <div className="flex flex-wrap gap-1.5">
            {info.amenities.map((amenity) => (
              <span
                key={amenity}
                className="border-border bg-card text-muted-foreground rounded-full border px-2.5 py-1 text-xs"
              >
                {amenity}
              </span>
            ))}
            {info.poolFee != null ? (
              <span className="border-border bg-card text-muted-foreground rounded-full border px-2.5 py-1 text-xs">
                Pool ₱{info.poolFee.toLocaleString('en-PH')}
              </span>
            ) : null}
            {info.poolSchedule ? (
              <span className="border-border bg-card text-muted-foreground rounded-full border px-2.5 py-1 text-xs">
                Pool {info.poolSchedule}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PropertyRules({
  houseRules,
  maxGuests,
  cancellationPolicy,
  showSafetySection = false,
  buildingInfo = null,
}: PropertyRulesProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const previewRules = houseRules.slice(0, DISPLAY_LIMIT);

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="space-y-8"
      >
        <div className="space-y-4">
          <h2 className="text-foreground @xl:text-xl text-lg font-semibold">House rules</h2>

          {maxGuests ? (
            <div className="border-border bg-card flex items-center gap-3 rounded-lg border p-4">
              <Users className="text-primary h-5 w-5" />
              <span className="text-foreground">
                Maximum {maxGuests} guest{maxGuests !== 1 && 's'}
              </span>
            </div>
          ) : null}

          {houseRules.length > 0 ? (
            <>
              <HouseRulesGrid rules={previewRules} />

              {houseRules.length > DISPLAY_LIMIT ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(true)}
                  className="h-10 w-full gap-2 rounded-xl sm:w-auto"
                >
                  Show all {houseRules.length} house rules
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
            </>
          ) : null}
        </div>

        {buildingInfo ? <BuildingRulesBlock info={buildingInfo} /> : null}

        {showSafetySection ? (
          <div className="space-y-4">
            <h2 className="text-foreground @xl:text-xl text-lg font-semibold">Safety & property</h2>

            <div className="border-border bg-card rounded-lg border p-4">
              <div className="mb-4 flex items-center gap-2">
                <AlertCircle className="text-primary h-5 w-5" />
                <h3 className="text-foreground font-medium">Safety features</h3>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {safetyFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-muted-foreground text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          <h2 className="text-foreground @xl:text-xl text-lg font-semibold">Cancellation policy</h2>
          <CancellationPolicyDisplay policy={cancellationPolicy} />
        </div>
      </motion.section>

      <GuestDialogShell
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="House rules"
        sizeClassName="max-w-[min(calc(100vw-1.5rem),32rem)] sm:max-w-[min(90vw,32rem)]"
      >
        {maxGuests ? (
          <div className="border-border bg-card mb-4 flex items-center gap-3 rounded-lg border p-4">
            <Users className="text-primary h-5 w-5" />
            <span className="text-foreground">
              Maximum {maxGuests} guest{maxGuests !== 1 && 's'}
            </span>
          </div>
        ) : null}
        <HouseRulesGrid rules={houseRules} />
      </GuestDialogShell>
    </>
  );
}
