import { expect, test } from '@playwright/test';

import { mockEdgeFunctions } from '../../shared/interceptEdge';

const PROPERTY_SLUG = 'solea-mactan';

/** Minimal payload the stay guide page needs to render. */
function stayGuideBody(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      property: {
        slug: PROPERTY_SLUG,
        name: 'Solea Mactan',
        brandColor: '#0f766e',
        logoUrl: null,
        locationLabel: 'Cebu',
        towerAndUnit: 'Tower 1 / 1204',
        location: {
          address: 'Mactan',
          city: 'Lapu-Lapu',
          province: 'Cebu',
          country: 'Philippines',
          zipCode: '6015',
          latitude: null,
          longitude: null,
          placeId: null,
          mapsUrl: null,
        },
        heroImageUrl: null,
        galleryImages: [],
        images: [],
      },
      booking: {
        guestName: 'Jordan Santos',
        checkInDate: '12-10-2026',
        checkOutDate: '12-12-2026',
        checkInTime: '14:00',
        checkOutTime: '11:00',
        needParking: false,
        hasPets: false,
      },
      contact: {
        phone: '09171234567',
        email: 'host@example.com',
        facebookUrl: '',
        airbnbUrl: '',
      },
      host: { name: 'Ana', avatarUrl: null, organizationName: 'Sample Stays' },
      sections: [],
      checkInDocuments: [],
      validUntil: '2026-12-13T23:59:59+08:00',
      todayManila: '2026-12-10',
      templateKey: 'showcase-aurora',
      tripPath: `/properties/${PROPERTY_SLUG}/trip?bookingId=b1`,
      chatPath: `/properties/${PROPERTY_SLUG}/messages?bookingId=b1`,
      ...overrides,
    },
  };
}

const ESSENTIALS_BEFORE_REVEAL =
  '<table><tr><th>Wi-Fi</th><td>Kame_2604</td></tr><tr><th>Door code</th><td>Available Dec 9, 2:00 PM</td></tr></table>';

const ESSENTIALS_AFTER_REVEAL =
  '<table><tr><th>Wi-Fi</th><td>Kame_2604</td></tr><tr><th>Door code</th><td>4821</td></tr></table>';

test.describe('@ci stay guide essentials', () => {
  test('shows the essentials before the reveal time without the door code', async ({ page }) => {
    await mockEdgeFunctions(page, [
      { name: 'get-guest-stay-guide', body: stayGuideBody({ essentialsHtml: ESSENTIALS_BEFORE_REVEAL }) },
    ]);

    await page.goto(`/properties/${PROPERTY_SLUG}/stay-guide?token=valid-token`);

    await expect(page.getByText('Kame_2604').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Available Dec 9, 2:00 PM').first()).toBeVisible();
    await expect(page.getByText('4821')).toHaveCount(0);
  });

  test('shows the door code once the reveal time has passed', async ({ page }) => {
    await mockEdgeFunctions(page, [
      { name: 'get-guest-stay-guide', body: stayGuideBody({ essentialsHtml: ESSENTIALS_AFTER_REVEAL }) },
    ]);

    await page.goto(`/properties/${PROPERTY_SLUG}/stay-guide?token=valid-token`);

    await expect(page.getByText('4821').first()).toBeVisible({ timeout: 20_000 });
  });

  test('a guest who cannot open the guide gets a way to their trips', async ({ page }) => {
    await mockEdgeFunctions(page, [
      {
        name: 'get-guest-stay-guide',
        status: 404,
        body: { success: false, error: 'This guide is not available.' },
      },
    ]);

    await page.goto(`/properties/${PROPERTY_SLUG}/stay-guide?token=expired`);

    await expect(page.getByRole('link', { name: 'View your trips' })).toBeVisible({
      timeout: 20_000,
    });
  });
});
