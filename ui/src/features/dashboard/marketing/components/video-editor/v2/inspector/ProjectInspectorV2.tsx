import { ColorPicker } from '@/features/dashboard/marketing/components/calendar-builder/components/controls/ColorPicker';
import { OptionSelect } from '@/features/dashboard/marketing/components/video-editor/v2/inspector/InspectorShared';
import { InstagramSongCard } from '@/features/dashboard/marketing/components/video-editor/v2/InstagramSongCard';
import { projectWarnings } from '@/features/dashboard/marketing/lib/video/v2/editorCommands';
import {
  formatTimecode,
  projectDurationInFrames,
} from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  VIDEO_V2_LIMITS,
  type VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

type Props = {
  project: VideoProjectV2;
  onChange: (updater: (project: VideoProjectV2) => VideoProjectV2) => void;
};

function withoutInstagramSong(project: VideoProjectV2): VideoProjectV2 {
  const { instagramSong: _removed, ...rest } = project;
  return rest;
}

function warningText(code: ReturnType<typeof projectWarnings>[number]): string {
  switch (code.code) {
    case 'too_many_videos':
      return `${code.peak} videos play at once. Previews may lag. Keep it to ${VIDEO_V2_LIMITS.maxVisibleVideos}.`;
    case 'missing_media':
      return code.count === 1 ? '1 clip has no media.' : `${code.count} clips have no media.`;
    case 'nearly_full':
      return 'The video is at its 60 second limit.';
  }
}

export function ProjectInspectorV2({ project, onChange }: Props) {
  const propertyId = usePropertyIdParam();
  const total = projectDurationInFrames(project);
  const warnings = projectWarnings(project);
  const song = project.instagramSong;
  return (
    <div className="space-y-4">
      <p className="text-sm">
        <span className="font-medium tabular-nums">{formatTimecode(total, project.fps)}</span>
        <span className="text-muted-foreground">
          {' '}
          / {formatTimecode(VIDEO_V2_LIMITS.maxDurationFrames, project.fps)}
        </span>
      </p>
      {warnings.length > 0 ? (
        <ul className="space-y-1" aria-label="Notes">
          {warnings.map((warning) => (
            <li
              key={warning.code}
              className="rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700"
            >
              {warningText(warning)}
            </li>
          ))}
        </ul>
      ) : null}
      {song ? (
        <div className="space-y-2">
          <p className="text-section-title">Reel song</p>
          <InstagramSongCard
            song={song}
            propertyId={propertyId}
            onRemove={() => onChange((p) => withoutInstagramSong(p))}
            onVolumeChange={(volume) =>
              onChange((p) =>
                p.instagramSong ? { ...p, instagramSong: { ...p.instagramSong, volume } } : p
              )
            }
          />
        </div>
      ) : null}
      <ColorPicker
        label="Background"
        value={project.background.color}
        onChange={(color) => onChange((p) => ({ ...p, background: { ...p.background, color } }))}
      />
      <OptionSelect<'color' | 'blur'>
        label="Fill empty space with"
        value={project.background.fill}
        options={[
          { value: 'color', label: 'Solid color' },
          { value: 'blur', label: 'Blurred copy' },
        ]}
        onChange={(fill) => onChange((p) => ({ ...p, background: { ...p.background, fill } }))}
      />
    </div>
  );
}
