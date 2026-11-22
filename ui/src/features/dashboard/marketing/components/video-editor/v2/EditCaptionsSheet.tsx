import { Trash2 } from 'lucide-react';

import { formatTimecode } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import type { CaptionItem } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  lines: CaptionItem[];
  fps: number;
  readOnly: boolean;
  onChangeText: (id: string, text: string) => void;
  onMakeAgain: () => void;
  onDeleteAll: () => void;
};

/** Every caption line in one list, so a whole video can be proofread without hunting. */
export function EditCaptionsSheet({
  open,
  onOpenChange,
  lines,
  fps,
  readOnly,
  onChangeText,
  onMakeAgain,
  onDeleteAll,
}: Props) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-lg">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Edit captions</ResponsiveModalTitle>
          <ResponsiveModalDescription>Fix a word and the timing stays.</ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <ul
          className="max-h-[50dvh] space-y-2 overflow-y-auto overscroll-contain pr-1"
          aria-label="Caption lines"
        >
          {lines.map((line) => (
            <li key={line.id} className="flex items-center gap-2">
              <span className="text-muted-foreground w-12 shrink-0 text-xs tabular-nums">
                {formatTimecode(line.from, fps)}
              </span>
              <Input
                aria-label={`Caption at ${formatTimecode(line.from, fps)}`}
                value={line.text}
                maxLength={200}
                disabled={readOnly}
                className="min-h-[44px]"
                onChange={(event) => onChangeText(line.id, event.target.value)}
              />
            </li>
          ))}
        </ul>

        {readOnly ? null : (
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={onMakeAgain}>
              Make them again
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-destructive min-h-[44px] gap-1.5"
              onClick={onDeleteAll}
            >
              <Trash2 className="size-4" aria-hidden />
              Delete all captions
            </Button>
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
