import { beforeEach, describe, expect, it, vi } from 'vitest';

const isSentrySdkEnabled = { value: false };
const setUser = vi.fn();
const setTags = vi.fn();
const setTag = vi.fn();
const getActiveSpan = vi.fn();

vi.mock('@/lib/sentry/init', () => ({
  get isSentrySdkEnabled() {
    return isSentrySdkEnabled.value;
  },
}));

vi.mock('@sentry/react', () => ({ setUser, setTags, setTag, getActiveSpan }));

const { setSentryRoutePattern, setSentrySurface, setSentryTenantScope, setSentryUser } =
  await import('@/lib/sentry/scope');

describe('Sentry scope setters', () => {
  beforeEach(() => {
    isSentrySdkEnabled.value = false;
    setUser.mockReset();
    setTags.mockReset();
    setTag.mockReset();
    getActiveSpan.mockReset();
  });

  it('does nothing when the SDK is off', () => {
    setSentryUser({ id: 'u1' });
    setSentryTenantScope({ orgId: 'o1' });
    setSentrySurface('host_dashboard');

    expect(setUser).not.toHaveBeenCalled();
    expect(setTags).not.toHaveBeenCalled();
    expect(setTag).not.toHaveBeenCalled();
  });

  describe('with the SDK on', () => {
    beforeEach(() => {
      isSentrySdkEnabled.value = true;
    });

    it('sends the user id and nothing else', () => {
      setSentryUser({ id: 'user-1' });

      expect(setUser).toHaveBeenCalledWith({ id: 'user-1' });
    });

    it('clears the user on sign out', () => {
      setSentryUser(null);

      expect(setUser).toHaveBeenCalledWith(null);
    });

    it('sends tenant ids, converting missing ones to undefined so they are cleared', () => {
      setSentryTenantScope({ orgId: 'org-1', propertyId: null });

      expect(setTags).toHaveBeenCalledWith({
        org_id: 'org-1',
        property_id: undefined,
        parking_id: undefined,
      });
    });

    it('sends the surface tag, including clearing it', () => {
      setSentrySurface('guest_booking');
      expect(setTag).toHaveBeenCalledWith('surface', 'guest_booking');

      setSentrySurface(undefined);
      expect(setTag).toHaveBeenLastCalledWith('surface', undefined);
    });

    it('never lets a broken SDK break the caller', () => {
      setUser.mockImplementation(() => {
        throw new Error('sdk down');
      });
      setTags.mockImplementation(() => {
        throw new Error('sdk down');
      });
      setTag.mockImplementation(() => {
        throw new Error('sdk down');
      });

      expect(() => setSentryUser({ id: 'u1' })).not.toThrow();
      expect(() => setSentryTenantScope({ orgId: 'o1' })).not.toThrow();
      expect(() => setSentrySurface('host_dashboard')).not.toThrow();
    });
  });
});

describe('setSentryRoutePattern', () => {
  beforeEach(() => {
    isSentrySdkEnabled.value = true;
    setTag.mockReset();
    getActiveSpan.mockReset();
  });

  it('tags the pattern and renames the active span', () => {
    const updateName = vi.fn();
    getActiveSpan.mockReturnValue({ updateName });

    setSentryRoutePattern('/org/:param/property/:param/bookings');

    expect(setTag).toHaveBeenCalledWith('route_pattern', '/org/:param/property/:param/bookings');
    expect(updateName).toHaveBeenCalledWith('/org/:param/property/:param/bookings');
  });

  it('survives a span that cannot be renamed', () => {
    getActiveSpan.mockReturnValue({});
    expect(() => setSentryRoutePattern('/calendar')).not.toThrow();
    expect(setTag).toHaveBeenCalledWith('route_pattern', '/calendar');
  });

  it('survives no active span at all', () => {
    getActiveSpan.mockReturnValue(undefined);
    expect(() => setSentryRoutePattern('/')).not.toThrow();
  });

  it('does nothing when the SDK is off', () => {
    isSentrySdkEnabled.value = false;
    setSentryRoutePattern('/calendar');
    expect(setTag).not.toHaveBeenCalled();
    expect(getActiveSpan).not.toHaveBeenCalled();
  });
});
