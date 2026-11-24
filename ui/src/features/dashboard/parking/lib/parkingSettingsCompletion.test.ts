import { describe, expect, it } from 'vitest';

import {
  computeParkingSettingsCompletion,
  MIN_PARKING_AMENITIES,
} from '@/features/dashboard/parking/lib/parkingSettingsCompletion';
import type {
  ParkingDetailsDraft,
  ParkingLocationDraft,
  ParkingProfileDraft,
} from '@/features/dashboard/parking/lib/parkingSettingsForm';

const profile: ParkingProfileDraft = {
  tower: 'Tower 1',
  level: 'B2',
  slotNumber: '12A',
  parkingType: 'inside_tower',
  residenceName: 'One Palm Residences',
  brandColor: '',
  description: '',
  seoTitle: '',
  seoDescription: '',
};

const details: ParkingDetailsDraft = {
  spaceLengthM: '5',
  spaceWidthM: '2.5',
  heightClearanceM: '2.1',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  acceptedVehicleTypes: ['car'],
};

const location: ParkingLocationDraft = {
  address: 'One Palm Residences, Mactan',
  city: 'Lapu-Lapu',
  province: 'Cebu',
  country: 'Philippines',
  zipCode: '',
  latitude: null,
  longitude: null,
  mapsUrl: '',
  placeId: '',
};

function completion(overrides: { location?: Partial<ParkingLocationDraft> } = {}) {
  return computeParkingSettingsCompletion({
    profile,
    details,
    features: { enabledParkingAmenities: ['cctv'], customParkingAmenities: [] },
    location: { ...location, ...overrides.location },
    coverImage: 'https://example.test/cover.jpg',
    appSettings: null,
  });
}

describe('computeParkingSettingsCompletion', () => {
  it('accepts a lettered slot label', () => {
    expect(completion().fieldErrors).not.toHaveProperty('settings-slot');
  });

  it('does not require a map pin when the address is set', () => {
    const result = completion();
    expect(result.fieldErrors).not.toHaveProperty('property-location-map');
    expect(result.issueSectionIds).not.toContain('location');
  });

  it('still requires a street address', () => {
    const result = completion({ location: { address: '' } });
    expect(result.fieldErrors['property-address']).toBe('Enter the street address');
    expect(result.issueSectionIds).toContain('location');
  });

  it('exports the amenity minimum', () => {
    expect(MIN_PARKING_AMENITIES).toBeGreaterThan(0);
  });
});
