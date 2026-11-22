import { useCallback, useEffect, useRef } from 'react';

import { MapPin } from 'lucide-react';

import { RequiredMark } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import { useGoogleMapsLoader } from '@/features/dashboard/org/hooks/useGoogleMapsLoader';
import {
  DEFAULT_PROPERTY_MAP_CENTER,
  buildGoogleMapsUrl,
  locationFromGeocoderResult,
  locationFromPlace,
  type PropertyLocationFields,
} from '@/features/dashboard/org/lib/propertyLocation';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PropertyLocationChangeOptions = { markEdited?: boolean };

type PropertyLocationPickerProps = {
  value: PropertyLocationFields;
  disabled?: boolean;
  onChange: (
    patch: Partial<PropertyLocationFields>,
    options?: PropertyLocationChangeOptions
  ) => void;
  addressError?: string | null;
  mapError?: string | null;
  onFieldInteract?: (fieldId: string) => void;
};

export function PropertyLocationPicker({
  value,
  disabled = false,
  onChange,
  addressError = null,
  mapError = null,
  onFieldInteract,
}: PropertyLocationPickerProps) {
  const { ready, error, apiKeyConfigured } = useGoogleMapsLoader();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const initialGeocodeDoneRef = useRef(false);
  const skipInputSyncRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Keep latest callbacks in refs so Map / Autocomplete effects do not tear down
  // on every parent re-render (e.g. first keystroke → markFieldInteracted).
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onFieldInteractRef = useRef(onFieldInteract);
  onFieldInteractRef.current = onFieldInteract;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const applyLocation = useCallback(
    (patch: Partial<PropertyLocationFields>, options?: PropertyLocationChangeOptions) => {
      if (options?.markEdited !== false) {
        if ('address' in patch) onFieldInteractRef.current?.('property-address');
        if ('latitude' in patch || 'longitude' in patch) {
          onFieldInteractRef.current?.('property-location-map');
        }
      }
      onChangeRef.current(patch, options);
    },
    []
  );

  const syncMarkerAndMap = useCallback((latitude: number, longitude: number) => {
    const position = { lat: latitude, lng: longitude };
    markerRef.current?.setPosition(position);
    mapRef.current?.panTo(position);
    mapRef.current?.setZoom(16);
  }, []);

  const reverseGeocode = useCallback(
    (latLng: google.maps.LatLng) => {
      if (!geocoderRef.current) return;

      geocoderRef.current.geocode({ location: latLng }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const location = locationFromGeocoderResult(results[0]);
          if (!location) return;
          skipInputSyncRef.current = true;
          applyLocation(location);
          if (inputRef.current) {
            inputRef.current.value = location.address;
          }
          return;
        }

        const latitude = latLng.lat();
        const longitude = latLng.lng();
        applyLocation({
          latitude,
          longitude,
          mapsUrl: buildGoogleMapsUrl(latitude, longitude),
        });
      });
    },
    [applyLocation]
  );

  const geocodeAddress = useCallback(
    (address: string, options?: PropertyLocationChangeOptions) => {
      const trimmed = address.trim();
      if (!trimmed || !geocoderRef.current) return;

      geocoderRef.current.geocode({ address: trimmed, region: 'ph' }, (results, status) => {
        if (status !== 'OK' || !results?.[0]) return;
        const location = locationFromGeocoderResult(results[0]);
        if (!location?.latitude || location.longitude == null) return;
        skipInputSyncRef.current = true;
        applyLocation(location, options);
        if (inputRef.current) {
          inputRef.current.value = location.address;
        }
        syncMarkerAndMap(location.latitude, location.longitude);
      });
    },
    [applyLocation, syncMarkerAndMap]
  );

  const reverseGeocodeRef = useRef(reverseGeocode);
  reverseGeocodeRef.current = reverseGeocode;
  const applyLocationRef = useRef(applyLocation);
  applyLocationRef.current = applyLocation;
  const syncMarkerAndMapRef = useRef(syncMarkerAndMap);
  syncMarkerAndMapRef.current = syncMarkerAndMap;
  const geocodeAddressRef = useRef(geocodeAddress);
  geocodeAddressRef.current = geocodeAddress;

  useEffect(() => {
    if (!ready || !mapContainerRef.current || mapRef.current) return;

    const current = valueRef.current;
    const latitude = current.latitude ?? DEFAULT_PROPERTY_MAP_CENTER.lat;
    const longitude = current.longitude ?? DEFAULT_PROPERTY_MAP_CENTER.lng;
    const container = mapContainerRef.current;

    const map = new google.maps.Map(container, {
      center: { lat: latitude, lng: longitude },
      zoom: current.latitude != null ? 16 : 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: disabledRef.current ? 'none' : 'greedy',
    });

    const marker = new google.maps.Marker({
      position: { lat: latitude, lng: longitude },
      map,
      draggable: !disabledRef.current,
    });

    geocoderRef.current = new google.maps.Geocoder();

    marker.addListener('dragend', () => {
      const position = marker.getPosition();
      if (position) reverseGeocodeRef.current(position);
    });

    map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (disabledRef.current || !event.latLng) return;
      marker.setPosition(event.latLng);
      reverseGeocodeRef.current(event.latLng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      google.maps.event.clearInstanceListeners(marker);
      google.maps.event.clearInstanceListeners(map);
      marker.setMap(null);
      // Clear Google's leftover DOM so a later init is not on a dirty node.
      container.replaceChildren();
      mapRef.current = null;
      markerRef.current = null;
      geocoderRef.current = null;
      initialGeocodeDoneRef.current = false;
    };
  }, [ready]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setDraggable(!disabled);
    mapRef.current.setOptions({ gestureHandling: disabled ? 'none' : 'greedy' });
  }, [disabled]);

  useEffect(() => {
    if (!ready || !mapRef.current || !markerRef.current) return;
    if (value.latitude == null || value.longitude == null) return;

    const position = { lat: value.latitude, lng: value.longitude };
    markerRef.current.setPosition(position);
    mapRef.current.panTo(position);
  }, [ready, value.latitude, value.longitude]);

  useEffect(() => {
    if (!ready || !inputRef.current || disabled) return;

    const input = inputRef.current;
    const autocomplete = new google.maps.places.Autocomplete(input, {
      fields: ['name', 'formatted_address', 'geometry', 'place_id', 'address_components'],
      componentRestrictions: { country: 'ph' },
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const location = locationFromPlace(place);
      if (!location?.latitude || location.longitude == null) return;

      skipInputSyncRef.current = true;
      applyLocationRef.current(location);
      if (inputRef.current) {
        inputRef.current.value = location.address;
      }
      syncMarkerAndMapRef.current(location.latitude, location.longitude);
    });

    return () => {
      google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, [disabled, ready]);

  useEffect(() => {
    if (!ready || initialGeocodeDoneRef.current) return;
    if (value.latitude != null && value.longitude != null) {
      initialGeocodeDoneRef.current = true;
      return;
    }
    if (!value.address.trim()) return;

    initialGeocodeDoneRef.current = true;
    geocodeAddressRef.current(value.address, { markEdited: false });
  }, [ready, value.address, value.latitude, value.longitude]);

  useEffect(() => {
    if (!inputRef.current) return;
    if (skipInputSyncRef.current) {
      skipInputSyncRef.current = false;
      return;
    }
    if (inputRef.current.value !== value.address) {
      inputRef.current.value = value.address;
    }
  }, [value.address]);

  const handleAddressBlur = () => {
    onFieldInteractRef.current?.('property-address');
    const nextAddress = inputRef.current?.value.trim() ?? '';
    if (nextAddress === value.address.trim()) return;
    applyLocation({ address: nextAddress });
    if (apiKeyConfigured && ready) {
      geocodeAddress(nextAddress);
    }
  };

  const mapsUnavailable = !apiKeyConfigured || Boolean(error);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="property-location-search" className="text-sm font-medium">
          Address
          <RequiredMark />
        </label>
        <Input
          id="property-location-search"
          ref={inputRef}
          defaultValue={value.address}
          disabled={disabled}
          placeholder="Search or enter property address"
          autoComplete="off"
          onInput={() => onFieldInteractRef.current?.('property-address')}
          onBlur={handleAddressBlur}
          aria-invalid={Boolean(addressError)}
          className={cn('min-h-[44px]', addressError && 'border-destructive')}
        />
        {addressError ? (
          <p className="text-destructive text-xs">{addressError}</p>
        ) : mapsUnavailable ? (
          <p className="text-muted-foreground text-xs">
            {error ??
              'Map picker requires VITE_GOOGLE_MAPS_API_KEY (Maps JavaScript + Places APIs).'}
          </p>
        ) : null}
      </div>

      {apiKeyConfigured ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Map pin
            <RequiredMark />
          </p>
          <div
            className={cn(
              'bg-muted/20 relative aspect-video w-full overflow-hidden rounded-lg border',
              !ready && 'animate-pulse',
              mapError && 'border-destructive'
            )}
          >
            <div ref={mapContainerRef} className="absolute inset-0 size-full" />
            {!ready && !error ? (
              <div className="bg-muted/40 absolute inset-0 flex items-center justify-center">
                <MapPin className="text-muted-foreground size-8" aria-hidden />
              </div>
            ) : null}
          </div>
          {mapError ? <p className="text-destructive text-xs">{mapError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
