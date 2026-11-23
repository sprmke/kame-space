import {
  Copy,
  ImagePlus,
  Magnet,
  Maximize2,
  Music,
  Scissors,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type ToolProps = {
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  shortcut?: string;
};

function Tool({ label, icon: Icon, onClick, disabled, pressed, shortcut }: ToolProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('size-9', pressed && 'bg-primary/15 text-primary')}
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
        >
          <Icon className="size-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? <span className="text-muted-foreground ml-2">{shortcut}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}

type Props = {
  hasSelection: boolean;
  canSplit: boolean;
  snapEnabled: boolean;
  onSplit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleSnap: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onAddText: () => void;
  onAddMedia: () => void;
  onAddAudio: () => void;
  readOnly?: boolean;
};

export function TimelineToolbar(props: Props) {
  const editing = !props.readOnly;
  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="toolbar"
        aria-label="Timeline tools"
        className="border-border flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto border-b px-2 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {editing ? (
          <>
            <Tool
              label="Split"
              icon={Scissors}
              onClick={props.onSplit}
              disabled={!props.canSplit}
              shortcut="S"
            />
            <Tool
              label="Duplicate"
              icon={Copy}
              onClick={props.onDuplicate}
              disabled={!props.hasSelection}
              shortcut="Cmd D"
            />
            <Tool
              label="Delete"
              icon={Trash2}
              onClick={props.onDelete}
              disabled={!props.hasSelection}
              shortcut="Del"
            />
            <span className="bg-border mx-1 h-5 w-px" aria-hidden />
            <Tool label="Add text" icon={Type} onClick={props.onAddText} />
            <Tool label="Add media" icon={ImagePlus} onClick={props.onAddMedia} />
            <Tool label="Add sound" icon={Music} onClick={props.onAddAudio} />
            <span className="bg-border mx-1 h-5 w-px" aria-hidden />
            <Tool
              label="Snap to edges"
              icon={Magnet}
              onClick={props.onToggleSnap}
              pressed={props.snapEnabled}
            />
          </>
        ) : null}
        <span className="flex-1" />
        <Tool label="Zoom out" icon={ZoomOut} onClick={props.onZoomOut} />
        <Tool label="Zoom in" icon={ZoomIn} onClick={props.onZoomIn} />
        <Tool label="Fit to screen" icon={Maximize2} onClick={props.onFit} />
      </div>
    </TooltipProvider>
  );
}
