import { BellRing } from 'lucide-react';

import { usePushNotifications } from '@/features/dashboard/notifications/hooks/usePushNotifications';
import { Switch } from '@/components/ui/switch';

/**
 * Guest-side OS push opt-in, on `/account/profile`.
 *
 * The device side is the same code the host surface uses (`usePushNotifications` →
 * `ui/src/lib/pwa/push.ts` → `push-subscribe`), because a subscription belongs to the signed-in
 * user, not to a team. A guest only receives the two milestones worth waking a phone for
 * (confirmed, ready for check-in); the rest stays in email.
 *
 * Plain language on purpose: a guest is not reading a dashboard, and "notifications" alone reads
 * like something is broken, so every unavailable state says what to do instead.
 */
export type GuestPushCardState = {
  /** The switch can be used. */
  canToggle: boolean;
  /** Why it cannot, or `null` when it can. */
  message: string | null;
};

type PushSnapshot = {
  ready: boolean;
  preparing: boolean;
  supported: boolean;
  needsInstallFirst: boolean;
  subscribed: boolean;
  busy: boolean;
};

/** Pure so every unavailable state is asserted without a browser. */
export function guestPushCardState(push: PushSnapshot): GuestPushCardState {
  if (!push.ready || push.preparing) {
    return { canToggle: false, message: 'Checking this device…' };
  }
  if (push.needsInstallFirst) {
    return {
      canToggle: false,
      message: 'Add this app to your home screen first, then turn alerts on.',
    };
  }
  if (!push.supported) {
    return { canToggle: false, message: 'This browser cannot show alerts.' };
  }
  return { canToggle: !push.busy, message: null };
}

export function GuestPushNotificationsCard() {
  const push = usePushNotifications();
  const { canToggle, message } = guestPushCardState(push);

  return (
    <div className="border-border space-y-2 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <BellRing className="text-muted-foreground size-4 shrink-0" aria-hidden />
            Alerts on this device
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Get a phone alert when your host confirms your booking or your check-in is ready.
          </p>
        </div>
        <Switch
          checked={push.subscribed}
          disabled={!canToggle}
          aria-label="Allow booking alerts on this device"
          onCheckedChange={(next) => {
            void (next ? push.enable() : push.disable());
          }}
        />
      </div>
      {message ? (
        <p className="text-muted-foreground text-sm" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
