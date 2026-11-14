import { useState } from 'react';

import { ThumbsDown, ThumbsUp } from 'lucide-react';

import {
  versionAspect,
  type AiVersion,
} from '@/features/dashboard/marketing/lib/aiStudioSessions';

import { captureAppEvent } from '@/lib/posthog/capture';
import { cn } from '@/lib/utils';

type PostVersion = Extract<AiVersion, { kind: 'post' }>;

type Props = {
  versions: PostVersion[];
  onOpen: (version: PostVersion) => void;
};

/**
 * A new batch lands as a 2x2 grid so the host compares at a glance, then opens one.
 * Thumbs only record a signal (layout id, no copy) so weak layouts can be pruned.
 */
export function AiStudioPostGrid({ versions, onOpen }: Props) {
  const [votes, setVotes] = useState<Record<string, 'up' | 'down'>>({});
  const first = versions[0];
  if (!first) return null;
  const aspect = versionAspect(first);

  const vote = (version: PostVersion, value: 'up' | 'down') => {
    if (votes[version.key]) return;
    setVotes((current) => ({ ...current, [version.key]: value }));
    captureAppEvent('ai_post_thumb', {
      value,
      layout: String(version.post.spec.archetype ?? ''),
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
      <p className="sr-only" role="status" aria-live="polite">
        {versions.length} versions ready. Press a version to open it.
      </p>
      <ul
        className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:gap-4"
        aria-label="New versions"
      >
        {versions.map((version) => (
          <li key={version.key} className="space-y-2">
            <button
              type="button"
              onClick={() => {
                captureAppEvent('ai_post_variant_opened', {
                  layout: String(version.post.spec.archetype ?? ''),
                });
                onOpen(version);
              }}
              aria-label={`Open version ${version.number}`}
              className="bg-card focus-visible:ring-ring block w-full overflow-hidden rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.25)] focus-visible:outline-none focus-visible:ring-2"
              style={{ aspectRatio: aspect }}
            >
              {version.post.previewUrl ? (
                <img
                  src={version.post.previewUrl}
                  alt={`Version ${version.number}: ${String(version.post.spec.label ?? '') || 'post'}`}
                  className="size-full object-contain"
                />
              ) : null}
            </button>
            <div className="flex items-center justify-between gap-1">
              <span className="text-muted-foreground text-xs tabular-nums">
                Version {version.number}
              </span>
              <span className="flex">
                {(['up', 'down'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={value === 'up' ? 'Like this post' : 'Dislike this post'}
                    aria-pressed={votes[version.key] === value}
                    disabled={Boolean(votes[version.key])}
                    onClick={() => vote(version, value)}
                    className={cn(
                      'text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 lg:size-9',
                      votes[version.key] === value && 'text-foreground'
                    )}
                  >
                    {value === 'up' ? (
                      <ThumbsUp className="size-4" aria-hidden />
                    ) : (
                      <ThumbsDown className="size-4" aria-hidden />
                    )}
                  </button>
                ))}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
