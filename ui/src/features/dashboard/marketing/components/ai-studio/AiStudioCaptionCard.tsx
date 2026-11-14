import { Copy, Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';

type Props = {
  caption: string | null;
  loading: boolean;
  disabled?: boolean;
  onWrite: () => void;
  onCopy: () => void;
};

/**
 * The post's Instagram caption, beside the result. Writing it is an explicit tap, so
 * nothing is generated (or charged) just by opening a post.
 */
export function AiStudioCaptionCard({ caption, loading, disabled, onWrite, onCopy }: Props) {
  return (
    <section
      className="border-border bg-card mx-3 mb-3 flex flex-col gap-2 rounded-xl border p-3 sm:mx-6"
      aria-label="Caption"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="settings-field-label">Caption</p>
        {caption ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px] gap-1.5 px-2 lg:min-h-9"
            onClick={onCopy}
          >
            <Copy className="size-4" aria-hidden />
            Copy caption
          </Button>
        ) : null}
      </div>
      {caption ? (
        <p className="text-foreground line-clamp-4 whitespace-pre-line text-sm">{caption}</p>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] w-full gap-2 lg:min-h-9"
          disabled={disabled || loading}
          onClick={onWrite}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          Write a caption
        </Button>
      )}
    </section>
  );
}
