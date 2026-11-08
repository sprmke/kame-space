/**
 * test: N/A — type-only module. The list is built and rendered by the public
 * parking grid, covered by its Playwright slice.
 */
import type { ParkingSlot } from '@/features/guest/marketing/developments/types';

/** Parking slot plus development context, as rendered by public parking grids. */
export interface ParkingListEntry {
  slot: ParkingSlot;
  developmentSlug: string;
  developmentName: string;
  city: string;
  /** Public detail path segment (`/parkings/:detailSlug`). */
  detailSlug: string;
}
