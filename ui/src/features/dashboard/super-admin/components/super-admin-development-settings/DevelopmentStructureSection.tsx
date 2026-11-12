import { useEffect, useState } from 'react';

import { Plus, X } from 'lucide-react';

import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ResidenceProfile } from '@/lib/residence/residenceProfile';

type Structure = ResidenceProfile['structure'];
type PropertyTower = Structure['propertyTowers'][number];
type ParkingTower = Structure['parkingTowers'][number];

type Props = {
  structure: Structure;
  disabled?: boolean;
  onChange: (structure: Structure) => void;
};

const UNIT_PRESETS = [
  { value: 'digits4', label: 'Exactly 4 digits' },
  { value: 'digits', label: 'Digits only' },
  { value: 'alnum', label: 'Letters and numbers' },
  { value: 'custom', label: 'Custom pattern' },
] as const;

const SLOT_PRESETS = [
  { value: 'digits1to4', label: '1 to 4 digits' },
  { value: 'alnum', label: 'Letters and numbers' },
  { value: 'custom', label: 'Custom pattern' },
] as const;

const PARKING_TYPES = [
  { value: 'inside_tower', label: 'Inside the tower' },
  { value: 'outside_tower', label: 'Outside the tower' },
  { value: 'motorcycle', label: 'Motorcycle' },
] as const;

function RowCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border/70 space-y-3 rounded-xl border p-3">
      {children}
    </div>
  );
}

/** Comma list with a local draft so typing a separator does not collapse. */
function LevelsInput({
  levels,
  disabled,
  onCommit,
}: {
  levels: string[];
  disabled?: boolean;
  onCommit: (levels: string[]) => void;
}) {
  const [value, setValue] = useState(levels.join(', '));

  useEffect(() => {
    setValue(levels.join(', '));
  }, [levels]);

  const commit = () => {
    const next = value
      .split(',')
      .map((level) => level.trim())
      .filter(Boolean);
    setValue(next.join(', '));
    onCommit(next);
  };

  return (
    <Input
      value={value}
      disabled={disabled}
      placeholder="Level 1, Level 2, Level 3"
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}

export function DevelopmentStructureSection({ structure, disabled, onChange }: Props) {
  const patch = (next: Partial<Structure>) => onChange({ ...structure, ...next });

  const updatePropertyTower = (index: number, next: Partial<PropertyTower>) => {
    const propertyTowers = structure.propertyTowers.map((tower, current) =>
      current === index ? { ...tower, ...next } : tower
    );
    patch({ propertyTowers });
  };

  const updateParkingTower = (index: number, next: Partial<ParkingTower>) => {
    const parkingTowers = structure.parkingTowers.map((tower, current) =>
      current === index ? { ...tower, ...next } : tower
    );
    patch({ parkingTowers });
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5">
        <SettingsField id="structure-tower-label" label="Tower label">
          <Input
            id="structure-tower-label"
            value={structure.towerLabel}
            disabled={disabled}
            placeholder="Tower"
            onChange={(event) => patch({ towerLabel: event.target.value })}
          />
        </SettingsField>
        <SettingsField id="structure-unit-label" label="Unit label">
          <Input
            id="structure-unit-label"
            value={structure.unitLabel}
            disabled={disabled}
            placeholder="Unit"
            onChange={(event) => patch({ unitLabel: event.target.value })}
          />
        </SettingsField>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={structure.towersRequired}
            disabled={disabled}
            onCheckedChange={(checked) => patch({ towersRequired: checked === true })}
          />
          A tower is required
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm">Floors max</span>
          <Input
            className="w-24"
            inputMode="numeric"
            value={structure.floorsMax ?? ''}
            disabled={disabled}
            placeholder="None"
            onChange={(event) => {
              const value = Number(event.target.value);
              patch({ floorsMax: event.target.value.trim() && Number.isFinite(value) ? value : null });
            }}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{structure.towerLabel || 'Tower'} list</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="settings-action"
            onClick={() =>
              patch({
                propertyTowers: [
                  ...structure.propertyTowers,
                  { name: '', code: '', active: true },
                ],
              })
            }
          >
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        </div>
        {structure.propertyTowers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No towers. Units are identified by number only.</p>
        ) : null}
        {structure.propertyTowers.map((tower, index) => (
          <RowCard key={`property-tower-${index}`}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={tower.name}
                disabled={disabled}
                placeholder="Monaco"
                aria-label={`Tower ${index + 1} name`}
                onChange={(event) => updatePropertyTower(index, { name: event.target.value })}
              />
              <Input
                value={tower.code}
                disabled={disabled}
                placeholder="M"
                aria-label={`Tower ${index + 1} code`}
                onChange={(event) => updatePropertyTower(index, { code: event.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                aria-label={`Remove tower ${index + 1}`}
                onClick={() =>
                  patch({
                    propertyTowers: structure.propertyTowers.filter(
                      (_entry, current) => current !== index
                    ),
                  })
                }
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={tower.active}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  updatePropertyTower(index, { active: checked === true })
                }
              />
              Active
            </label>
          </RowCard>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Parking towers</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="settings-action"
            onClick={() =>
              patch({
                parkingTowers: [
                  ...structure.parkingTowers,
                  {
                    name: '',
                    code: '',
                    active: true,
                    levels: [],
                    parkingType: 'inside_tower',
                  },
                ],
              })
            }
          >
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        </div>
        {structure.parkingTowers.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No parking structure. Hosts cannot create parking slots in this residence.
          </p>
        ) : null}
        {structure.parkingTowers.map((tower, index) => (
          <RowCard key={`parking-tower-${index}`}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={tower.name}
                disabled={disabled}
                placeholder="Monaco"
                aria-label={`Parking tower ${index + 1} name`}
                onChange={(event) => updateParkingTower(index, { name: event.target.value })}
              />
              <Input
                value={tower.code}
                disabled={disabled}
                placeholder="M"
                aria-label={`Parking tower ${index + 1} code`}
                onChange={(event) => updateParkingTower(index, { code: event.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                aria-label={`Remove parking tower ${index + 1}`}
                onClick={() =>
                  patch({
                    parkingTowers: structure.parkingTowers.filter(
                      (_entry, current) => current !== index
                    ),
                  })
                }
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SettingsField id={`parking-levels-${index}`} label="Levels">
                <LevelsInput
                  levels={tower.levels}
                  disabled={disabled}
                  onCommit={(levels) => updateParkingTower(index, { levels })}
                />
              </SettingsField>
              <SettingsField id={`parking-type-${index}`} label="Type">
                <Select
                  value={tower.parkingType}
                  disabled={disabled}
                  onValueChange={(value) =>
                    updateParkingTower(index, {
                      parkingType: value as ParkingTower['parkingType'],
                    })
                  }
                >
                  <SelectTrigger id={`parking-type-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARKING_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsField>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={tower.active}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  updateParkingTower(index, { active: checked === true })
                }
              />
              Active
            </label>
          </RowCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5">
        <SettingsField id="structure-unit-format" label="Unit number format">
          <Select
            value={structure.unitNumberFormat.preset}
            disabled={disabled}
            onValueChange={(value) => {
              patch({
                unitNumberFormat: {
                  ...structure.unitNumberFormat,
                  preset: value as Structure['unitNumberFormat']['preset'],
                },
              });
            }}
          >
            <SelectTrigger id="structure-unit-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="mt-2"
            value={structure.unitNumberFormat.example}
            disabled={disabled}
            placeholder="2604"
            aria-label="Unit number example"
            onChange={(event) =>
              patch({
                unitNumberFormat: {
                  ...structure.unitNumberFormat,
                  example: event.target.value,
                },
              })
            }
          />
          {structure.unitNumberFormat.preset === 'custom' ? (
            <Input
              className="mt-2"
              value={structure.unitNumberFormat.pattern ?? ''}
              disabled={disabled}
              placeholder="^[A-Z]{2}-\\d{3}$"
              aria-label="Unit number pattern"
              onChange={(event) =>
                patch({
                  unitNumberFormat: {
                    ...structure.unitNumberFormat,
                    pattern: event.target.value,
                  },
                })
              }
            />
          ) : null}
        </SettingsField>

        <SettingsField id="structure-slot-format" label="Parking slot format">
          <Select
            value={structure.parkingSlotFormat.preset}
            disabled={disabled}
            onValueChange={(value) => {
              patch({
                parkingSlotFormat: {
                  ...structure.parkingSlotFormat,
                  preset: value as Structure['parkingSlotFormat']['preset'],
                },
              });
            }}
          >
            <SelectTrigger id="structure-slot-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLOT_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="mt-2"
            value={structure.parkingSlotFormat.example}
            disabled={disabled}
            placeholder="26"
            aria-label="Parking slot example"
            onChange={(event) =>
              patch({
                parkingSlotFormat: {
                  ...structure.parkingSlotFormat,
                  example: event.target.value,
                },
              })
            }
          />
          {structure.parkingSlotFormat.preset === 'custom' ? (
            <Input
              className="mt-2"
              value={structure.parkingSlotFormat.pattern ?? ''}
              disabled={disabled}
              placeholder="^P-\\d{1,3}$"
              aria-label="Parking slot pattern"
              onChange={(event) =>
                patch({
                  parkingSlotFormat: {
                    ...structure.parkingSlotFormat,
                    pattern: event.target.value,
                  },
                })
              }
            />
          ) : null}
        </SettingsField>
      </div>
    </>
  );
}
