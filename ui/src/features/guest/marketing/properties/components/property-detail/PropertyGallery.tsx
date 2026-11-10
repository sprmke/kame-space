import { PropertySaveButton } from '@/features/guest/marketing/properties/components/PropertySaveButton';
import { ListingGallery } from '@/features/guest/marketing/shared/components/ListingGallery';

interface PropertyGalleryProps {
  images: string[];
  propertyName: string;
  propertySlug: string;
  /** Host alt text per photo, same order as `images`. */
  imageAlts?: Array<string | null | undefined>;
}

export function PropertyGallery({
  images,
  propertyName,
  propertySlug,
  imageAlts,
}: PropertyGalleryProps) {
  return (
    <ListingGallery
      images={images}
      listingName={propertyName}
      imageAlts={imageAlts}
      actionSlot={<PropertySaveButton propertySlug={propertySlug} variant="pill" />}
    />
  );
}
