import { Search } from 'lucide-react';

import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/** Google truncates a title around here; past it the tail is dropped in results. */
export const SEO_TITLE_RECOMMENDED = 60;
export const SEO_TITLE_MAX = 70;
/** Meta descriptions are cut around 160 characters. */
export const SEO_DESCRIPTION_RECOMMENDED = 160;
export const SEO_DESCRIPTION_MAX = 170;

type Props = {
  title: string;
  description: string;
  /** Placeholder values: exactly what the page uses when the field is empty. */
  autoTitle: string;
  autoDescription: string;
  /** Public URL shown in the preview, e.g. `kamespace.com › properties › monaco-2604`. */
  breadcrumb: string;
  /** Id prefix so the property and parking forms never collide. */
  idPrefix?: string;
  /** When false, hide the inner heading (parent AdminSection already titles the card). */
  showHeading?: boolean;
  disabled?: boolean;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
};

function Counter({
  length,
  recommended,
  over,
}: {
  length: number;
  recommended: number;
  over: boolean;
}) {
  return (
    <p className={cn('text-xs tabular-nums', over ? 'text-amber-700' : 'text-muted-foreground')}>
      {length}/{recommended}
      {over ? ' · may truncate in search' : null}
    </p>
  );
}

/**
 * Search-result preview plus optional title/description overrides.
 * Shared by property and parking settings. Empty = use generated copy (shown as placeholder).
 */
export function SearchPreviewFields({
  title,
  description,
  autoTitle,
  autoDescription,
  breadcrumb,
  idPrefix = 'listing',
  showHeading = true,
  disabled,
  onChangeTitle,
  onChangeDescription,
}: Props) {
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const shownTitle = trimmedTitle || autoTitle;
  const shownDescription = trimmedDescription || autoDescription;
  const titleOver = trimmedTitle.length > SEO_TITLE_RECOMMENDED;
  const descriptionOver = trimmedDescription.length > SEO_DESCRIPTION_RECOMMENDED;
  const usingGeneratedTitle = !trimmedTitle;
  const usingGeneratedDescription = !trimmedDescription;

  const siteHost = breadcrumb.split('›')[0]?.trim() || 'kamespace.com';

  return (
    <div className="space-y-5">
      {showHeading ? (
        <div className="space-y-1">
          <h3 id={`${idPrefix}-search-preview`} className="text-section-title">
            Search preview
          </h3>
          <p className="text-muted-foreground text-xs">
            What guests see on Google and in AI answers. Leave blank to use the generated text.
          </p>
        </div>
      ) : null}

      {/* Google-style result first so hosts judge the outcome before editing. */}
      <div
        className="border-border/70 bg-muted/30 space-y-1 rounded-xl border p-4 sm:p-5"
        aria-live="polite"
        aria-label="Search result preview"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="bg-background text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full border"
            aria-hidden
          >
            <Search className="size-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-foreground truncate text-xs font-medium">{siteHost}</p>
            <p className="text-muted-foreground truncate text-[11px] leading-snug">{breadcrumb}</p>
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-xl font-medium leading-snug text-[#1a0dab] dark:text-sky-400">
          {shownTitle}
        </p>
        <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
          {shownDescription}
        </p>
        {(usingGeneratedTitle || usingGeneratedDescription) && (
          <p className="text-muted-foreground pt-1 text-[11px]">
            {usingGeneratedTitle && usingGeneratedDescription
              ? 'Using generated title and description'
              : usingGeneratedTitle
                ? 'Using generated title'
                : 'Using generated description'}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <SettingsField id={`${idPrefix}-seo-title`} label="Title">
          <Input
            id={`${idPrefix}-seo-title`}
            value={title}
            maxLength={SEO_TITLE_MAX}
            disabled={disabled}
            placeholder={autoTitle}
            onChange={(event) => onChangeTitle(event.target.value)}
          />
          <Counter
            length={trimmedTitle.length}
            recommended={SEO_TITLE_RECOMMENDED}
            over={titleOver}
          />
        </SettingsField>

        <SettingsField id={`${idPrefix}-seo-description`} label="Description">
          <Textarea
            id={`${idPrefix}-seo-description`}
            value={description}
            rows={4}
            maxLength={SEO_DESCRIPTION_MAX}
            disabled={disabled}
            placeholder={autoDescription}
            onChange={(event) => onChangeDescription(event.target.value)}
            className="min-h-[6.5rem] resize-y"
          />
          <Counter
            length={trimmedDescription.length}
            recommended={SEO_DESCRIPTION_RECOMMENDED}
            over={descriptionOver}
          />
        </SettingsField>
      </div>
    </div>
  );
}
