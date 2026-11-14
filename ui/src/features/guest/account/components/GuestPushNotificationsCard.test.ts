import { describe, expect, it } from 'vitest';

import { guestPushCardState } from '@/features/guest/account/components/GuestPushNotificationsCard';

const READY = {
  ready: true,
  preparing: false,
  supported: true,
  needsInstallFirst: false,
  subscribed: false,
  busy: false,
};

describe('guest push card state', () => {
  it('lets the guest toggle once the device state is known', () => {
    expect(guestPushCardState(READY)).toEqual({ canToggle: true, message: null });
    expect(guestPushCardState({ ...READY, subscribed: true })).toEqual({
      canToggle: true,
      message: null,
    });
  });

  it('says it is still checking instead of claiming the device is unsupported', () => {
    expect(guestPushCardState({ ...READY, ready: false }).message).toMatch(/checking/i);
    expect(guestPushCardState({ ...READY, preparing: true }).canToggle).toBe(false);
  });

  it('explains the iOS install requirement in guest terms', () => {
    const state = guestPushCardState({ ...READY, needsInstallFirst: true, supported: true });
    expect(state.canToggle).toBe(false);
    expect(state.message).toMatch(/home screen/i);
  });

  it('never leaves the switch usable on a browser without push', () => {
    expect(guestPushCardState({ ...READY, supported: false })).toEqual({
      canToggle: false,
      message: 'This browser cannot show alerts.',
    });
  });

  it('blocks the switch while a change is in flight', () => {
    expect(guestPushCardState({ ...READY, busy: true }).canToggle).toBe(false);
  });

  it('says "home screen" rather than host wording about Activity', () => {
    // Guests have no Activity feed, so the host copy would point at a screen they cannot open.
    for (const state of [
      guestPushCardState({ ...READY, needsInstallFirst: true }),
      guestPushCardState({ ...READY, supported: false }),
      guestPushCardState({ ...READY, ready: false }),
    ]) {
      expect(state.message ?? '').not.toMatch(/activity/i);
    }
  });
});
