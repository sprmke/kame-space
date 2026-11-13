import { Input } from '@/components/ui/input';
import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
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
  disabled?: boolean;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
};

/**
 * Search-result preview plus the two optional overrides, shared by the property and parking
 * settings pages. Empty means "use the generated title and description", and the placeholder
 * shows exactly what that is, so a host can see the cost of leaving it blank.
 */
export function SearchPreviewFields({
  title,
  description,
  autoTitle,
  autoDescription,
  breadcrumb,
  idPrefix = 'listing',
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

  return (
    <section aria-labelledby={`${idPrefix}-search-preview`} className="space-y-4">
      <div className="space-y-1">
        <h3 id={`${idPrefix}-search-preview`} className="text-section-title">
          Search preview
        </h3>
        <p className="text-muted-foreground text-xs">
          What guests see on Google and in AI answers. Leave blank to use the generated text.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField id={`${idPrefix}-seo-title`} label="Title">
          <Input
            id={`${idPrefix}-seo-title`}
            value={title}
            maxLength={SEO_TITLE_MAX}
            disabled={disabled}
            placeholder={autoTitle}
            onChange={(event) => onChangeTitle(event.target.value)}
          />
          <p className={cn('text-xs', titleOver ? 'text-amber-700' : 'text-muted-foreground')}>
            {trimmedTitle.length}/{SEO_TITLE_RECOMMENDED}
          </p>
        </SettingsField>

        <SettingsField id={`${idPrefix}-seo-description`} label="Description">
          <Textarea
            id={`${idPrefix}-seo-description`}
            value={description}
            rows={3}
            maxLength={SEO_DESCRIPTION_MAX}
            disabled={disabled}
            placeholder={autoDescription}
            onChange={(event) => onChangeDescription(event.target.value)}
          />
          <p
            className={cn('text-xs', descriptionOver ? 'text-amber-700' : 'text-muted-foreground')}
          >
            {trimmedDescription.length}/{SEO_DESCRIPTION_RECOMMENDED}
          </p>
        </SettingsField>
      </div>

      {/* The preview mirrors the real result: URL line, title, then description. */}
      <div className="border-border bg-card rounded-xl border p-4" aria-live="polite">
        <p className="text-muted-foreground truncate text-xs">{breadcrumb}</p>
        <p className="text-primary mt-1 line-clamp-2 text-lg font-medium leading-snug">
          {shownTitle}
        </p>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{shownDescription}</p>
      </div>
    </section>
  );
}
