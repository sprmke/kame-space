/**
 * Phone tool tree for the Videos editor (CapCut style): a row of big tools, each opening a
 * second row, and a different row once a clip is selected.
 *
 * Pure data and helpers so the navigation rules are unit-tested. The component maps `icon` keys
 * to lucide icons and `action` ids to editor commands. Plain words only: no editing jargon.
 *
 * Plan: docs/workflow/in-progress/marketing-video-editor-mobile-first-refine.md §4.2, §4.3.
 */

import { findItem } from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import type {
  VideoItem,
  VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

export type PhoneIconKey =
  | 'audio'
  | 'music'
  | 'mic'
  | 'sound'
  | 'upload'
  | 'text'
  | 'captions'
  | 'media'
  | 'overlay'
  | 'templates'
  | 'size'
  | 'background'
  | 'ai'
  | 'more'
  | 'style'
  | 'edit'
  | 'trim'
  | 'split'
  | 'speed'
  | 'volume'
  | 'mute'
  | 'fade'
  | 'duration'
  | 'motion'
  | 'adjust'
  | 'fit'
  | 'replace'
  | 'duplicate'
  | 'delete'
  | 'animation'
  | 'duck'
  | 'position';

export type PhoneToolAction =
  // Root tools that open a sheet or a panel.
  | 'open-media'
  | 'open-templates'
  | 'open-size'
  | 'open-background'
  | 'open-ai'
  | 'open-reviews'
  | 'open-reset'
  | 'open-guide'
  // Audio.
  | 'audio-music'
  | 'audio-upload'
  | 'audio-record'
  | 'audio-from-video'
  // Text and captions.
  | 'text-add'
  | 'text-styles'
  | 'captions-make'
  | 'captions-edit'
  | 'captions-delete'
  // Media.
  | 'media-add'
  | 'media-add-on-top'
  // Selected clip.
  | 'clip-trim'
  | 'clip-split'
  | 'clip-speed'
  | 'clip-volume'
  | 'clip-mute'
  | 'clip-separate-sound'
  | 'clip-replace'
  | 'clip-adjust'
  | 'clip-fit'
  | 'clip-motion'
  | 'clip-duration'
  | 'clip-duplicate'
  | 'clip-delete'
  | 'clip-edit'
  | 'clip-style'
  | 'clip-animation'
  | 'clip-fade'
  | 'clip-duck'
  | 'clip-position'
  | 'clip-more';

export type PhoneTool = {
  id: string;
  label: string;
  icon: PhoneIconKey;
  /** Opens the next row. */
  children?: PhoneTool[];
  /** Runs when tapped (a tool with children only opens them). */
  action?: PhoneToolAction;
  destructive?: boolean;
};

export type PhoneToolOptions = {
  /** The host can use "Make with AI". */
  canGenerate: boolean;
  /** Voice recording ships with Phase 4. */
  voice: boolean;
  /** Sound from a video, separate sound and music ducking ship with Phase 4. */
  soundTools: boolean;
  /** Auto captions ship with Phase 6. */
  captions: boolean;
  /** The project already has caption lines (the tool becomes "Edit captions"). */
  hasCaptions: boolean;
};

export const DEFAULT_PHONE_TOOL_OPTIONS: PhoneToolOptions = {
  canGenerate: false,
  voice: false,
  soundTools: false,
  captions: false,
  hasCaptions: false,
};

export function rootTools(options: PhoneToolOptions): PhoneTool[] {
  const audioChildren: PhoneTool[] = [
    { id: 'audio.music', label: 'Music', icon: 'music', action: 'audio-music' },
    ...(options.voice
      ? [
          {
            id: 'audio.record',
            label: 'Record voice',
            icon: 'mic',
            action: 'audio-record',
          } as const,
        ]
      : []),
    ...(options.soundTools
      ? [
          {
            id: 'audio.sound',
            label: 'Sound from video',
            icon: 'sound',
            action: 'audio-from-video',
          } as const,
        ]
      : []),
    { id: 'audio.upload', label: 'Upload audio', icon: 'upload', action: 'audio-upload' },
  ];

  const textChildren: PhoneTool[] = [
    { id: 'text.add', label: 'Add text', icon: 'text', action: 'text-add' },
    { id: 'text.styles', label: 'Text styles', icon: 'style', action: 'text-styles' },
    ...(options.captions
      ? [
          {
            id: 'text.captions',
            label: options.hasCaptions ? 'Edit captions' : 'Auto captions',
            icon: 'captions',
            action: options.hasCaptions ? 'captions-edit' : 'captions-make',
          } as const,
        ]
      : []),
  ];

  return [
    { id: 'audio', label: 'Audio', icon: 'audio', children: audioChildren },
    { id: 'text', label: 'Text', icon: 'text', children: textChildren },
    ...(options.captions
      ? [
          {
            id: 'captions',
            label: 'Captions',
            icon: 'captions',
            action: options.hasCaptions ? 'captions-edit' : 'captions-make',
          } as const,
        ]
      : []),
    {
      id: 'media',
      label: 'Media',
      icon: 'media',
      children: [
        { id: 'media.add', label: 'Photos and videos', icon: 'media', action: 'media-add' },
        { id: 'media.on-top', label: 'Add on top', icon: 'overlay', action: 'media-add-on-top' },
      ],
    },
    { id: 'templates', label: 'Templates', icon: 'templates', action: 'open-templates' },
    { id: 'size', label: 'Size', icon: 'size', action: 'open-size' },
    { id: 'background', label: 'Background', icon: 'background', action: 'open-background' },
    ...(options.canGenerate
      ? [{ id: 'ai', label: 'AI', icon: 'ai', action: 'open-ai' } as const]
      : []),
    {
      id: 'more',
      label: 'More',
      icon: 'more',
      children: [
        { id: 'more.reviews', label: 'Guest reviews', icon: 'text', action: 'open-reviews' },
        { id: 'more.reset', label: 'Start over', icon: 'replace', action: 'open-reset' },
        { id: 'more.guide', label: 'Screen guide', icon: 'size', action: 'open-guide' },
      ],
    },
  ];
}

/** What the current selection is, in words the tool row cares about. */
export type SelectionKind =
  'none' | 'multi' | 'video' | 'photo' | 'text' | 'caption' | 'music' | 'voice' | 'sound';

export function selectionKind(project: VideoProjectV2, selectedIds: string[]): SelectionKind {
  if (selectedIds.length === 0) return 'none';
  if (selectedIds.length > 1) return 'multi';
  const item = findItem(project, selectedIds[0]!)?.item;
  if (!item) return 'none';
  switch (item.type) {
    case 'video':
      return 'video';
    case 'image':
      return 'photo';
    case 'layer':
      return 'text';
    case 'audio':
      return 'music';
    default:
      return 'none';
  }
}

const DUPLICATE: PhoneTool = {
  id: 'clip.duplicate',
  label: 'Copy',
  icon: 'duplicate',
  action: 'clip-duplicate',
};
const DELETE: PhoneTool = {
  id: 'clip.delete',
  label: 'Delete',
  icon: 'delete',
  action: 'clip-delete',
  destructive: true,
};
const SPLIT: PhoneTool = { id: 'clip.split', label: 'Split', icon: 'split', action: 'clip-split' };
const REPLACE: PhoneTool = {
  id: 'clip.replace',
  label: 'Replace',
  icon: 'replace',
  action: 'clip-replace',
};

/** The row shown while something is selected. */
export function toolsForSelection(
  kind: SelectionKind,
  options: PhoneToolOptions = DEFAULT_PHONE_TOOL_OPTIONS
): PhoneTool[] {
  const tools = rawToolsForSelection(kind);
  return tools.filter((tool) => {
    if (tool.action === 'clip-separate-sound' || tool.action === 'clip-duck') {
      return options.soundTools;
    }
    if (tool.action === 'captions-make' || tool.action === 'captions-delete') {
      return options.captions;
    }
    return true;
  });
}

function rawToolsForSelection(kind: SelectionKind): PhoneTool[] {
  switch (kind) {
    case 'video':
      return [
        { id: 'clip.trim', label: 'Trim', icon: 'trim', action: 'clip-trim' },
        SPLIT,
        { id: 'clip.speed', label: 'Speed', icon: 'speed', action: 'clip-speed' },
        { id: 'clip.volume', label: 'Volume', icon: 'volume', action: 'clip-volume' },
        {
          id: 'clip.separate',
          label: 'Separate sound',
          icon: 'sound',
          action: 'clip-separate-sound',
        },
        { id: 'clip.adjust', label: 'Adjust', icon: 'adjust', action: 'clip-adjust' },
        { id: 'clip.fit', label: 'Fit', icon: 'fit', action: 'clip-fit' },
        REPLACE,
        DUPLICATE,
        DELETE,
      ];
    case 'photo':
      return [
        { id: 'clip.duration', label: 'Duration', icon: 'duration', action: 'clip-duration' },
        SPLIT,
        { id: 'clip.motion', label: 'Motion', icon: 'motion', action: 'clip-motion' },
        { id: 'clip.adjust', label: 'Adjust', icon: 'adjust', action: 'clip-adjust' },
        { id: 'clip.fit', label: 'Fit', icon: 'fit', action: 'clip-fit' },
        REPLACE,
        DUPLICATE,
        DELETE,
      ];
    case 'text':
      return [
        { id: 'clip.edit', label: 'Edit', icon: 'edit', action: 'clip-edit' },
        { id: 'clip.style', label: 'Style', icon: 'style', action: 'clip-style' },
        { id: 'clip.animation', label: 'Animation', icon: 'animation', action: 'clip-animation' },
        { id: 'clip.duration', label: 'Duration', icon: 'duration', action: 'clip-duration' },
        DUPLICATE,
        DELETE,
      ];
    case 'caption':
      return [
        { id: 'clip.edit', label: 'Edit', icon: 'edit', action: 'clip-edit' },
        { id: 'clip.style', label: 'Style', icon: 'style', action: 'clip-style' },
        SPLIT,
        DELETE,
        {
          id: 'clip.captions-delete',
          label: 'Delete all',
          icon: 'delete',
          action: 'captions-delete',
          destructive: true,
        },
      ];
    case 'music':
    case 'sound':
      return [
        { id: 'clip.volume', label: 'Volume', icon: 'volume', action: 'clip-volume' },
        { id: 'clip.fade', label: 'Fade', icon: 'fade', action: 'clip-fade' },
        SPLIT,
        { id: 'clip.duck', label: 'Lower for voice', icon: 'duck', action: 'clip-duck' },
        REPLACE,
        DUPLICATE,
        DELETE,
      ];
    case 'voice':
      return [
        { id: 'clip.volume', label: 'Volume', icon: 'volume', action: 'clip-volume' },
        { id: 'clip.fade', label: 'Fade', icon: 'fade', action: 'clip-fade' },
        SPLIT,
        { id: 'clip.captions', label: 'Make captions', icon: 'captions', action: 'captions-make' },
        DUPLICATE,
        DELETE,
      ];
    case 'multi':
      return [DUPLICATE, DELETE];
    case 'none':
      return [];
  }
}

/** Follow a path of tool ids from the root; returns the row to show, or null when it is stale. */
export function rowAtPath(root: PhoneTool[], path: string[]): PhoneTool[] | null {
  let row = root;
  for (const id of path) {
    const next = row.find((tool) => tool.id === id)?.children;
    if (!next) return null;
    row = next;
  }
  return row;
}

/** Whether a selected clip can be split at `frame` (the playhead is strictly inside it). */
export function canSplitAt(item: VideoItem | null, frame: number, minFrames: number): boolean {
  if (!item) return false;
  return frame >= item.from + minFrames && frame <= item.from + item.durationInFrames - minFrames;
}
