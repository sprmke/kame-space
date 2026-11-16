import { Search } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import type { PropertyProfileDraft } from '@/features/dashboard/org/lib/propertySettingsForm';

import { SearchPreviewFields } from '@/components/settings/SearchPreviewFields';
import { buildPageTitle, listingDescription, propertyTitle } from '@/lib/seo/seoMeta';

type Props = {
  draft: PropertyProfileDraft;
  slugPreview: string;
  disabled?: boolean;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
};

/** Search preview overrides: own settings card above Integrations. */
export function PropertySearchSettingsSection({
  draft,
  slugPreview,
  disabled,
  onChangeTitle,
  onChangeDescription,
}: Props) {
  return (
    <AdminSection
      id="search"
      title="Search preview"
      icon={Search}
      description="Title and description for Google and AI answers."
    >
      <SearchPreviewFields
        title={draft.seoTitle}
        description={draft.seoDescription}
        autoTitle={buildPageTitle(
          propertyTitle({
            name: draft.name || 'Your property',
            unitType: draft.type,
            city: draft.city,
          })
        )}
        autoDescription={listingDescription({
          name: draft.name || 'Your property',
          unitType: draft.type,
          city: draft.city,
          guests: draft.maxGuests,
          bedrooms: draft.bedrooms,
          amenities: draft.enabledAmenities,
          priceFrom: null,
        })}
        breadcrumb={`kamespace.com › properties › ${slugPreview || 'your-listing'}`}
        idPrefix="property"
        showHeading={false}
        disabled={disabled}
        onChangeTitle={onChangeTitle}
        onChangeDescription={onChangeDescription}
      />
    </AdminSection>
  );
}
