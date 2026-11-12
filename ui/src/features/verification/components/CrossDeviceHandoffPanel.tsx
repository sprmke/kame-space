import { useCallback, useEffect, useState } from 'react';

import { CheckCircle2, Copy, RefreshCw, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

import type { IdentitySessionStatus } from '../lib/identityApi';

type CrossDeviceHandoffPanelProps = {
  verifyUrl: string;
  expiresAt: string;
  status: IdentitySessionStatus;
  onRestart: () => void;
};

const QR_SIZE = 208;

function remainingLabel(expiresAt: string): string {
  const remainingMs = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 'Link expired';
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')} left`;
}

/**
 * Desktop → phone handoff. QR plus a copyable link; the desktop keeps polling the session
 * and the caller advances itself when the status changes. No `navigate()` from here.
 *
 * Layout contract: one centered QR block, then actions, then live status. The countdown is a
 * quiet pill rather than a floating line so the panel reads as three deliberate rows.
 */
export function CrossDeviceHandoffPanel({
  verifyUrl,
  expiresAt,
  status,
  onRestart,
}: CrossDeviceHandoffPanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(() => remainingLabel(expiresAt));

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: QR_SIZE * 2,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [verifyUrl]);

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(remainingLabel(expiresAt)), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  // The `remaining` state ticks every second, so this is already re-evaluated on time.
  const expired = Date.parse(expiresAt) <= Date.now();

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  }, [verifyUrl]);

  if (status === 'completed') {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden />
        <p className="text-sm font-semibold">Done</p>
        <p className="text-muted-foreground text-xs">Your phone finished the check.</p>
      </div>
    );
  }

  if (expired || status === 'expired' || status === 'failed') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="space-y-1">
          <p className="text-sm font-semibold">This link expired</p>
          <p className="text-muted-foreground text-xs">Start a new one and scan again.</p>
        </div>
        <Button type="button" variant="outline" onClick={onRestart}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Start again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <div className="bg-background rounded-xl border p-3">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR code for the verification link"
              width={QR_SIZE}
              height={QR_SIZE}
              className="block rounded-md"
              style={{ height: QR_SIZE, width: QR_SIZE }}
            />
          ) : (
            <Skeleton className="rounded-md" style={{ height: QR_SIZE, width: QR_SIZE }} />
          )}
        </div>

        <div className="space-y-2 text-center">
          <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-sm">
            <Smartphone className="h-3.5 w-3.5" aria-hidden />
            Scan with your phone camera
          </p>
          <p className="text-muted-foreground bg-muted inline-flex rounded-full px-2.5 py-1 text-xs font-medium tabular-nums">
            {remaining}
          </p>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Button type="button" variant="outline" className="w-full" onClick={() => void copyLink()}>
          <Copy className="mr-2 h-4 w-4" aria-hidden />
          {copied ? 'Copied' : 'Copy link'}
        </Button>

        <p
          className="text-muted-foreground flex items-center justify-center gap-2 text-xs"
          aria-live="polite"
        >
          <span className="bg-primary size-1.5 animate-pulse rounded-full" aria-hidden />
          Waiting for your phone
        </p>
      </div>
    </div>
  );
}
