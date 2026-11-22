import { AlertCircle, Check, Cloud, Loader2 } from 'lucide-react';

import type { MarketingAutoSaveStatus } from '@/features/dashboard/marketing/hooks/useMarketingAutoSave';

type Props = {
  status: MarketingAutoSaveStatus;
  errorMessage?: string | null;
  /** Icon only (the words stay for screen readers). Used on phones, where the name needs the room. */
  compact?: boolean;
};

export function MarketingAutoSaveStatus({ status, errorMessage, compact = false }: Props) {
  if (status === 'idle') return null;

  if (compact) {
    const label =
      status === 'pending'
        ? 'Unsaved'
        : status === 'saving'
          ? 'Saving'
          : status === 'saved'
            ? 'Saved'
            : 'Save failed';
    return (
      <span
        role="status"
        title={status === 'error' ? (errorMessage ?? label) : label}
        className="flex size-8 shrink-0 items-center justify-center"
      >
        {status === 'saving' ? (
          <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
        ) : status === 'saved' ? (
          <Check className="size-4 text-emerald-500" aria-hidden />
        ) : status === 'pending' ? (
          <Cloud className="text-muted-foreground size-4" aria-hidden />
        ) : (
          <AlertCircle className="text-destructive size-4" aria-hidden />
        )}
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <span className="text-muted-foreground flex min-h-[44px] items-center gap-1.5 px-1 text-xs sm:text-sm">
        <Cloud className="size-3.5 shrink-0" aria-hidden />
        Unsaved
      </span>
    );
  }

  if (status === 'saving') {
    return (
      <span className="text-muted-foreground flex min-h-[44px] items-center gap-1.5 px-1 text-xs sm:text-sm">
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }

  if (status === 'saved') {
    return (
      <span className="text-muted-foreground flex min-h-[44px] items-center gap-1.5 px-1 text-xs sm:text-sm">
        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        Saved
      </span>
    );
  }

  return (
    <span
      className="text-destructive flex min-h-[44px] items-center gap-1.5 px-1 text-xs sm:text-sm"
      title={errorMessage ?? undefined}
    >
      <AlertCircle className="size-3.5 shrink-0" aria-hidden />
      Save failed
    </span>
  );
}
