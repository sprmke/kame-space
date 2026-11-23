import { useEffect, useMemo, useRef, useState } from 'react';

import { ChevronLeft } from 'lucide-react';

import { PHONE_TOOL_ICONS } from '@/features/dashboard/marketing/components/video-editor/v2/mobile/phoneToolIcons';
import {
  rootTools,
  rowAtPath,
  toolsForSelection,
  type PhoneTool,
  type PhoneToolAction,
  type PhoneToolOptions,
  type SelectionKind,
} from '@/features/dashboard/marketing/lib/video/v2/phoneTools';

import { cn } from '@/lib/utils';

type Props = {
  options: PhoneToolOptions;
  selection: SelectionKind;
  /** The tool that is open in the panel above the strip (highlighted). */
  activeAction?: PhoneToolAction | null;
  /** Read-only roles can look but not change anything. */
  readOnly?: boolean;
  /** Actions that cannot run right now (for example Split with the playhead outside the clip). */
  disabledActions?: ReadonlySet<PhoneToolAction>;
  onAction: (action: PhoneToolAction) => void;
  /** Leave the selected-clip row (clears the selection). */
  onDone: () => void;
};

/** Actions that only look around, so a read-only role may still use them. */
const LOOK_ONLY = new Set<PhoneToolAction>(['open-reviews', 'open-guide']);

/** A tool a read-only role may still use: it only looks, or it opens a row that has such a tool. */
function canLook(tool: PhoneTool): boolean {
  if (tool.action && LOOK_ONLY.has(tool.action)) return true;
  return Boolean(tool.children?.some(canLook));
}

/**
 * Phone tool row. Nothing selected: big tools, each opening a second row with a back arrow.
 * Something selected: the tools for that clip. In the page flow (not floating), so it can never
 * cover the timeline or collide with another button. Every target is at least 44 px.
 */
export function VideoToolStrip({
  options,
  selection,
  activeAction = null,
  readOnly = false,
  disabledActions,
  onAction,
  onDone,
}: Props) {
  const [path, setPath] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const root = useMemo(() => rootTools(options), [options]);
  const selectionRow = useMemo(() => toolsForSelection(selection, options), [selection, options]);
  const hasSelection = selection !== 'none';

  const row = hasSelection ? selectionRow : (rowAtPath(root, path) ?? root);
  const inSubRow = !hasSelection && path.length > 0;

  // A selection replaces whatever second row was open; a stale path falls back to the root.
  useEffect(() => {
    if (hasSelection) setPath([]);
  }, [hasSelection]);
  useEffect(() => {
    if (!rowAtPath(root, path)) setPath([]);
  }, [root, path]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
  }, [row, hasSelection]);

  const handle = (tool: PhoneTool) => {
    if (tool.children?.length) {
      setPath((current) => [...current, tool.id]);
      return;
    }
    if (!tool.action) return;
    onAction(tool.action);
    // A tool that finished its job returns to the root row; panels keep their row open.
    if (!hasSelection && inSubRow) setPath([]);
  };

  const label = hasSelection ? 'Clip tools' : inSubRow ? 'Tool options' : 'Editor tools';

  return (
    <div
      role="toolbar"
      aria-label={label}
      className="border-border bg-card flex shrink-0 items-stretch border-t"
    >
      {hasSelection || inSubRow ? (
        <button
          type="button"
          aria-label={hasSelection ? 'Done' : 'Back'}
          onClick={hasSelection ? onDone : () => setPath((current) => current.slice(0, -1))}
          className="border-border text-muted-foreground hover:text-foreground flex min-h-[44px] w-10 shrink-0 items-center justify-center border-r"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
      ) : null}
      <div
        ref={scrollRef}
        className="flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto overscroll-x-contain px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {row.map((tool) => {
          const Icon = PHONE_TOOL_ICONS[tool.icon];
          const disabled =
            (readOnly && !canLook(tool)) ||
            Boolean(tool.action && disabledActions?.has(tool.action));
          const active = Boolean(tool.action && tool.action === activeAction);
          return (
            <button
              key={tool.id}
              type="button"
              disabled={disabled}
              aria-pressed={active || undefined}
              onClick={() => handle(tool)}
              className={cn(
                // 44px tall keeps WCAG / E2E; width and type are denser than CapCut-clone 60×68 tiles.
                'flex min-h-[44px] min-w-[52px] shrink-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-[10px] font-medium leading-tight transition-colors',
                'text-muted-foreground hover:text-foreground disabled:opacity-40',
                active && 'text-primary',
                tool.destructive && 'text-destructive hover:text-destructive'
              )}
            >
              <Icon className="size-4" aria-hidden />
              <span className="line-clamp-1 max-w-[3.75rem] text-center">{tool.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
