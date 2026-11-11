import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { AMENITY_CATEGORIES } from '@/features/dashboard/org/lib/propertySettingsConstants';
import { HOUSE_RULE_CATEGORIES } from '@/features/dashboard/org/lib/propertyHouseRulesConstants';

import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles } from 'lucide-react';

type Seeds = { amenityIds: string[]; houseRuleIds: string[] };

type Props = {
  seeds: Seeds;
  disabled?: boolean;
  onChange: (next: Seeds) => void;
};

function toggle(list: string[], id: string, checked: boolean): string[] {
  if (checked) return list.includes(id) ? list : [...list, id];
  return list.filter((entry) => entry !== id);
}

/**
 * Property defaults (plan §4.1 "seed"): the amenity and house-rule ids a new property in
 * this residence starts with. Copied once at creation, then the host owns them.
 */
export function DevelopmentPropertySeedsSection({ seeds, disabled = false, onChange }: Props) {
  return (
    <AdminSection
      id="property-defaults"
      title="Property defaults"
      icon={Sparkles}
      description="Amenities and house rules a new property starts with. Existing properties keep their own lists."
    >
      <div className="space-y-5">
        <div className="space-y-3">
          <p className="text-section-title">Amenities</p>
          {AMENITY_CATEGORIES.map((category) => (
            <div key={category.id} className="space-y-1.5">
              <p className="text-muted-foreground text-xs">{category.name}</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {category.amenities.map((amenity) => {
                  const checked = seeds.amenityIds.includes(amenity.id);
                  return (
                    <label key={amenity.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(value) =>
                          onChange({
                            ...seeds,
                            amenityIds: toggle(seeds.amenityIds, amenity.id, value === true),
                          })
                        }
                        aria-label={amenity.name}
                      />
                      {amenity.name}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-section-title">House rules</p>
          {HOUSE_RULE_CATEGORIES.map((category) => (
            <div key={category.id} className="space-y-1.5">
              <p className="text-muted-foreground text-xs">{category.name}</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {category.rules.map((rule) => {
                  const checked = seeds.houseRuleIds.includes(rule.id);
                  return (
                    <label key={rule.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(value) =>
                          onChange({
                            ...seeds,
                            houseRuleIds: toggle(seeds.houseRuleIds, rule.id, value === true),
                          })
                        }
                        aria-label={rule.name}
                      />
                      {rule.name}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminSection>
  );
}
