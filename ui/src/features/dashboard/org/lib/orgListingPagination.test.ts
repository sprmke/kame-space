import { describe, expect, it } from 'vitest';

import {
  ORG_LISTING_DEFAULT_PAGE_SIZE,
  orgListingPaginationSlice,
  sliceOrgListingPage,
} from '@/features/dashboard/org/lib/orgListingPagination';

describe('orgListingPaginationSlice', () => {
  it('returns empty indices when there are no items', () => {
    expect(orgListingPaginationSlice(0, { page: 1, limit: ORG_LISTING_DEFAULT_PAGE_SIZE })).toMatchObject({
      page: 1,
      pageCount: 1,
      startIdx: 0,
      endIdx: 0,
    });
  });

  it('clamps page when past the last page', () => {
    const slice = orgListingPaginationSlice(40, { page: 9, limit: ORG_LISTING_DEFAULT_PAGE_SIZE });
    expect(slice.page).toBe(2);
    expect(slice.pageCount).toBe(2);
    expect(slice.startIdx).toBe(ORG_LISTING_DEFAULT_PAGE_SIZE + 1);
    expect(slice.endIdx).toBe(40);
  });

  it('normalizes unsupported page sizes', () => {
    expect(orgListingPaginationSlice(10, { page: 1, limit: 7 }).limit).toBe(
      ORG_LISTING_DEFAULT_PAGE_SIZE
    );
  });
});

describe('sliceOrgListingPage', () => {
  it('returns the current page window', () => {
    const items = Array.from({ length: 40 }, (_, i) => i + 1);
    expect(
      sliceOrgListingPage(items, { page: 1, limit: ORG_LISTING_DEFAULT_PAGE_SIZE })
    ).toEqual(items.slice(0, ORG_LISTING_DEFAULT_PAGE_SIZE));
    expect(
      sliceOrgListingPage(items, { page: 2, limit: ORG_LISTING_DEFAULT_PAGE_SIZE })
    ).toEqual(items.slice(ORG_LISTING_DEFAULT_PAGE_SIZE));
  });
});
