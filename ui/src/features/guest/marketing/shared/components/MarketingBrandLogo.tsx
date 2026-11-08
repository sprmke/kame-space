import { platformWordmarkParts } from '@/lib/platformBranding';
import { cn } from '@/lib/utils';

export type MarketingBrandLogoTone = 'default' | 'onPrimary';

export interface MarketingBrandLogoProps {
  className?: string;
  tone?: MarketingBrandLogoTone;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  markClassName?: string;
}

export function MarketingBrandLogo({
  className,
  tone = 'default',
  showWordmark = true,
  wordmarkClassName,
  markClassName,
}: MarketingBrandLogoProps) {
  const wordmark = platformWordmarkParts();

  return (
    <span className={cn('flex items-center gap-2', className)}>
      <img
        src="/brand/kame-space-mark.svg"
        alt=""
        aria-hidden="true"
        width={40}
        height={40}
        className={cn(
          'size-8 shrink-0 md:size-10',
          tone === 'onPrimary' && 'rounded-[34%] ring-2 ring-white/25',
          markClassName
        )}
      />
      {showWordmark && wordmark ? (
        <span
          className={cn(
            'text-[17px] font-bold tracking-tight md:text-xl',
            tone === 'onPrimary' ? 'text-white' : 'text-foreground',
            wordmarkClassName
          )}
        >
          {tone === 'onPrimary' ? (
            <>
              {wordmark.primary}
              {wordmark.accent ? <span className="text-white/85">{wordmark.accent}</span> : null}
            </>
          ) : (
            <>
              {wordmark.primary}
              {wordmark.accent ? <span className="text-brand-ink">{wordmark.accent}</span> : null}
            </>
          )}
        </span>
      ) : null}
    </span>
  );
}
