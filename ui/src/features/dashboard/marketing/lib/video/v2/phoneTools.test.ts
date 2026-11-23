import { describe, expect, it } from 'vitest';

import {
  canSplitAt,
  DEFAULT_PHONE_TOOL_OPTIONS,
  rootTools,
  rowAtPath,
  selectionKind,
  toolsForSelection,
  type PhoneTool,
  type SelectionKind,
} from '@/features/dashboard/marketing/lib/video/v2/phoneTools';
import {
  caption,
  clip,
  photo,
  project,
  song,
  track,
} from '@/features/dashboard/marketing/lib/video/v2/videoV2Fixtures';

const JARGON = /\b(overlay|main|scrim|wash|letterbox|snap|lower third|safe area|animate)\b/i;

function walk(tools: PhoneTool[], visit: (tool: PhoneTool) => void) {
  for (const tool of tools) {
    visit(tool);
    if (tool.children) walk(tool.children, visit);
  }
}

describe('rootTools', () => {
  it('starts with the tools a host looks for first', () => {
    const labels = rootTools(DEFAULT_PHONE_TOOL_OPTIONS).map((tool) => tool.label);
    expect(labels.slice(0, 3)).toEqual(['Audio', 'Text', 'Media']);
    expect(labels).toContain('Templates');
  });

  it('hides AI, voice and captions until they are available', () => {
    const tools = rootTools(DEFAULT_PHONE_TOOL_OPTIONS);
    const ids: string[] = [];
    walk(tools, (tool) => ids.push(tool.id));
    expect(ids).not.toContain('ai');
    expect(ids).not.toContain('audio.record');
    expect(ids).not.toContain('captions');
    expect(ids).not.toContain('audio.sound');
  });

  it('adds voice, captions and AI when switched on', () => {
    const ids: string[] = [];
    walk(
      rootTools({
        canGenerate: true,
        voice: true,
        soundTools: true,
        captions: true,
        hasCaptions: false,
      }),
      (tool) => ids.push(tool.id)
    );
    expect(ids).toEqual(
      expect.arrayContaining(['ai', 'audio.record', 'captions', 'text.captions'])
    );
  });

  it('turns Auto captions into Edit captions once captions exist', () => {
    const tools = rootTools({
      canGenerate: false,
      voice: false,
      soundTools: false,
      captions: true,
      hasCaptions: true,
    });
    const captions = tools.find((tool) => tool.id === 'captions');
    expect(captions?.label).toBe('Captions');
    expect(captions?.action).toBe('captions-edit');
    const text = tools.find((tool) => tool.id === 'text');
    expect(text?.children?.find((tool) => tool.id === 'text.captions')?.label).toBe(
      'Edit captions'
    );
  });

  it('has unique ids and an action or children on every tool', () => {
    const tools = rootTools({
      canGenerate: true,
      voice: true,
      soundTools: true,
      captions: true,
      hasCaptions: false,
    });
    const seen = new Set<string>();
    walk(tools, (tool) => {
      expect(seen.has(tool.id)).toBe(false);
      seen.add(tool.id);
      expect(Boolean(tool.action) || Boolean(tool.children?.length)).toBe(true);
    });
  });

  it('uses plain words in every label', () => {
    const labels: string[] = [];
    walk(
      rootTools({
        canGenerate: true,
        voice: true,
        soundTools: true,
        captions: true,
        hasCaptions: false,
      }),
      (tool) => labels.push(tool.label)
    );
    const kinds: SelectionKind[] = ['video', 'photo', 'text', 'caption', 'music', 'voice', 'multi'];
    const all = {
      canGenerate: true,
      voice: true,
      soundTools: true,
      captions: true,
      hasCaptions: false,
    };
    for (const kind of kinds) walk(toolsForSelection(kind, all), (tool) => labels.push(tool.label));
    for (const label of labels) expect(label).not.toMatch(JARGON);
  });
});

describe('selectionKind', () => {
  const video = clip();
  const still = photo();
  const text = caption();
  const music = song();
  const p = project([
    track('main', [video, still]),
    track('text', [text]),
    track('audio', [music]),
  ]);

  it('reads the kind of the single selected clip', () => {
    expect(selectionKind(p, [])).toBe('none');
    expect(selectionKind(p, [video.id])).toBe('video');
    expect(selectionKind(p, [still.id])).toBe('photo');
    expect(selectionKind(p, [text.id])).toBe('text');
    expect(selectionKind(p, [music.id])).toBe('music');
  });

  it('treats several selected clips as multi and a stale id as nothing', () => {
    expect(selectionKind(p, [video.id, still.id])).toBe('multi');
    expect(selectionKind(p, ['gone'])).toBe('none');
  });
});

describe('toolsForSelection', () => {
  it('shows tools that fit the clip', () => {
    const labels = (kind: SelectionKind) => toolsForSelection(kind).map((tool) => tool.label);
    expect(labels('video')).toEqual(expect.arrayContaining(['Trim', 'Speed', 'Volume']));
    expect(labels('photo')).toEqual(expect.arrayContaining(['Duration', 'Motion']));
    expect(labels('photo')).not.toContain('Speed');
    expect(labels('text')).toEqual(expect.arrayContaining(['Edit', 'Style', 'Animation']));
    expect(labels('music')).toEqual(expect.arrayContaining(['Volume', 'Fade']));
    expect(labels('none')).toEqual([]);
  });

  it('hides sound tools and caption tools until they ship', () => {
    const ids = (kind: SelectionKind) => toolsForSelection(kind).map((tool) => tool.id);
    expect(ids('video')).not.toContain('clip.separate');
    expect(ids('music')).not.toContain('clip.duck');
    expect(ids('caption')).not.toContain('clip.captions-delete');
    const all = {
      canGenerate: false,
      voice: true,
      soundTools: true,
      captions: true,
      hasCaptions: true,
    };
    expect(toolsForSelection('video', all).map((tool) => tool.id)).toContain('clip.separate');
    expect(toolsForSelection('music', all).map((tool) => tool.id)).toContain('clip.duck');
  });

  it('keeps Delete last and marks it destructive for a single clip', () => {
    for (const kind of ['video', 'photo', 'text', 'music'] as const) {
      const tools = toolsForSelection(kind);
      expect(tools[tools.length - 1]?.id).toBe('clip.delete');
      expect(tools[tools.length - 1]?.destructive).toBe(true);
    }
  });

  it('only offers copy and delete for a multi selection', () => {
    expect(toolsForSelection('multi').map((tool) => tool.id)).toEqual([
      'clip.duplicate',
      'clip.delete',
    ]);
  });
});

describe('rowAtPath', () => {
  const root = rootTools(DEFAULT_PHONE_TOOL_OPTIONS);

  it('returns the root row for an empty path and a child row for a tool id', () => {
    expect(rowAtPath(root, [])).toBe(root);
    expect(rowAtPath(root, ['audio'])?.map((tool) => tool.id)).toContain('audio.music');
  });

  it('returns null when the path no longer exists', () => {
    expect(rowAtPath(root, ['audio', 'nope'])).toBeNull();
    expect(rowAtPath(root, ['templates'])).toBeNull();
  });
});

describe('canSplitAt', () => {
  const item = photo(90, { from: 30 });
  it('needs the playhead strictly inside the clip', () => {
    expect(canSplitAt(item, 60, 3)).toBe(true);
    expect(canSplitAt(item, 30, 3)).toBe(false);
    expect(canSplitAt(item, 119, 3)).toBe(false);
    expect(canSplitAt(null, 60, 3)).toBe(false);
  });
});
