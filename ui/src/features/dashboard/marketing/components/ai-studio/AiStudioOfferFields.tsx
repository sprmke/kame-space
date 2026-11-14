import { useId } from 'react';

import {
  manilaToday,
  type OfferDraft,
  OFFER_TEXT_LIMIT,
  offerProblem,
  type OfferProblem,
} from '@/features/dashboard/marketing/lib/poster/posterOffer';

import { Input } from '@/components/ui/input';
import { IsoDateInput } from '@/components/ui/iso-date-input';

const PROBLEM_COPY: Record<OfferProblem, string> = {
  'missing-text': 'Add the offer text.',
  'bad-date': 'Pick a valid date.',
  expired: 'That date has passed.',
  'bad-code': 'Use 3 to 16 letters or numbers.',
};

type Props = {
  value: OfferDraft;
  onChange: (next: OfferDraft) => void;
  disabled?: boolean;
};

/** Promo posts print a real offer. Without one they feature the nightly rate. */
export function AiStudioOfferFields({ value, onChange, disabled }: Props) {
  const id = useId();
  const problem = offerProblem(value);
  const set = (patch: Partial<OfferDraft>) => onChange({ ...value, ...patch });
  const invalid = (...kinds: OfferProblem[]) => problem !== null && kinds.includes(problem);

  return (
    <div className="space-y-3" data-testid="ai-studio-offer-fields">
      <div className="space-y-1.5">
        <label htmlFor={`${id}-text`} className="settings-field-label">
          Your offer
        </label>
        <Input
          id={`${id}-text`}
          value={value.text}
          maxLength={OFFER_TEXT_LIMIT.chars}
          placeholder="20% off weekdays"
          disabled={disabled}
          error={invalid('missing-text')}
          aria-invalid={invalid('missing-text')}
          aria-describedby={`${id}-help`}
          onChange={(event) => set({ text: event.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-until`} className="settings-field-label">
            Valid until <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <IsoDateInput
            id={`${id}-until`}
            value={value.validUntil}
            min={manilaToday()}
            disabled={disabled}
            onChange={(event) => set({ validUntil: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-code`} className="settings-field-label">
            Code <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            id={`${id}-code`}
            value={value.code}
            maxLength={16}
            placeholder="SUMMER10"
            autoCapitalize="characters"
            autoComplete="off"
            disabled={disabled}
            error={invalid('bad-code')}
            aria-invalid={invalid('bad-code')}
            onChange={(event) => set({ code: event.target.value.toUpperCase() })}
          />
        </div>
      </div>
      <p
        id={`${id}-help`}
        role={problem ? 'alert' : undefined}
        className={problem ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}
      >
        {problem
          ? PROBLEM_COPY[problem]
          : 'Printed as you type it. Leave blank to show your nightly rate.'}
      </p>
    </div>
  );
}
