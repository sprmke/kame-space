import { beforeEach, describe, expect, it, vi } from 'vitest';

const isSentrySdkEnabled = { value: false };
const setUser = vi.fn();
const setTags = vi.fn();
const setTag = vi.fn();

vi.mock('@/lib/sentry/init', () => ({
  get isSentrySdkEnabled() {
    return isSentrySdkEnabled.value;
  },
}));

vi.mock('@sentry/react', () => ({ setUser, setTags, setTag }));

const { setSentrySurface, setSentryTenantScope, setSentryUser } = await import(
  '@/lib/sentry/scope'
);

describe('Sentry scope setters', () => {
  beforeEach(() => {
    isSentrySdkEnabled.value = false;
    setUser.mockReset();
    setTags.mockReset();
    setTag.mockReset();
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
