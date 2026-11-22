import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';

import { ChoiceChips } from '@/features/dashboard/marketing/components/video-editor/v2/mobile/ChoiceChips';
import type { AutoCaptionsError } from '@/features/dashboard/marketing/hooks/useAutoCaptions';
import type { CaptionLanguage } from '@/features/dashboard/marketing/lib/video/v2/captions/captionApi';
import type {
  CaptionSourceCounts,
  CaptionSourceMode,
} from '@/features/dashboard/marketing/lib/video/v2/captions/captionAudio';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counts: CaptionSourceCounts;
  /** Captions already exist: making new ones replaces them. */
  replacing: boolean;
  busy: boolean;
  phase: 'idle' | 'listening' | 'writing' | 'error';
  error: AutoCaptionsError | null;
  onMake: (options: { mode: CaptionSourceMode; language: CaptionLanguage }) => void;
  onCancel: () => void;
  onUpgrade: () => void;
};

/** The source to start with: the voice the host recorded, then the video's own sound. */
export function defaultCaptionMode(counts: CaptionSourceCounts): CaptionSourceMode {
  if (counts.voice > 0) return counts.video > 0 ? 'both' : 'voice';
  return 'video';
}

/**
 * "Make captions from" (what to listen to) and "Language", then one button. Plain words, one
 * decision per row, and a clear note that the audio is sent to a speech service.
 */
export function AutoCaptionsSheet({
  open,
  onOpenChange,
  counts,
  replacing,
  busy,
  phase,
  error,
  onMake,
  onCancel,
  onUpgrade,
}: Props) {
  const [mode, setMode] = useState<CaptionSourceMode>(() => defaultCaptionMode(counts));
  const [language, setLanguage] = useState<CaptionLanguage>('auto');

  // Pick a sensible source each time the sheet opens.
  useEffect(() => {
    if (open) setMode(defaultCaptionMode(counts));
    // Only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const none = counts.voice + counts.video === 0;
  const available = (value: CaptionSourceMode) =>
    value === 'voice'
      ? counts.voice > 0
      : value === 'video'
        ? counts.video > 0
        : counts.voice + counts.video > 0;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Auto captions</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            We listen to the video and write what is said.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        {none ? (
          <p className="text-muted-foreground text-sm" role="status">
            Add a voice recording or a video with sound first. Music is not captioned.
          </p>
        ) : (
          <div className="space-y-4">
            <ChoiceChips<CaptionSourceMode>
              label="Make captions from"
              value={mode}
              options={
                [
                  { value: 'voice', label: `Voice (${counts.voice})` },
                  { value: 'video', label: `Video sound (${counts.video})` },
                  { value: 'both', label: 'Both' },
                ].filter((option) => available(option.value as CaptionSourceMode)) as Array<{
                  value: CaptionSourceMode;
                  label: string;
                }>
              }
              onChange={setMode}
            />
            <ChoiceChips<CaptionLanguage>
              label="Language"
              value={language}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'en', label: 'English' },
                { value: 'tl', label: 'Filipino' },
              ]}
              onChange={setLanguage}
            />
            <p className="text-muted-foreground text-xs">
              The sound is sent to our speech service to write the words. It is not saved.
              {replacing ? ' This replaces the captions you have now.' : ''}
            </p>
          </div>
        )}

        {phase === 'error' && error ? (
          <div className="space-y-2" role="alert">
            <p className="text-destructive text-sm">{error.message}</p>
            {error.upgrade ? (
              <Button type="button" variant="outline" className="min-h-[44px]" onClick={onUpgrade}>
                See plans
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          {busy ? (
            <>
              <p
                className="text-muted-foreground flex min-h-[44px] items-center gap-2 text-sm"
                role="status"
              >
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {phase === 'listening' ? 'Listening to your video…' : 'Writing the captions…'}
              </p>
              <Button type="button" variant="outline" className="min-h-[44px]" onClick={onCancel}>
                Cancel
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="min-h-[44px]"
              disabled={none}
              onClick={() => onMake({ mode, language })}
            >
              Make captions
            </Button>
          )}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
