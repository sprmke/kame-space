import { useState } from 'react';

import { EyeOff, Loader2, Pin, PinOff, Plus, RefreshCw, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

import { SuperAdminPage } from '@/features/dashboard/super-admin/components/shared/SuperAdminPage';
import {
  useMarketingTrendsAdmin,
  useMarketingTrendsModeration,
  type TrendRun,
  type TrendTopicRow,
} from '@/features/dashboard/super-admin/hooks/useMarketingTrendsAdmin';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const SOURCE_LABELS: Record<string, string> = {
  google_trends: 'Google Trends',
  wikimedia_ph: 'Wikipedia',
  wikimedia_tl: 'Wikipedia (Tagalog)',
  apple_music: 'Apple Music',
  netflix: 'Netflix',
  editor: 'Added by staff',
};

const STATUS_TONE: Record<TrendRun['status'], string> = {
  published: 'bg-success/10 text-success',
  failed: 'bg-destructive/10 text-destructive',
  running: 'bg-warning/10 text-warning',
  skipped: 'bg-muted text-muted-foreground',
};

function RunLedger({ runs }: { runs: TrendRun[] }) {
  if (!runs.length) {
    return <p className="text-muted-foreground text-sm">No runs yet.</p>;
  }
  return (
    <ol className="space-y-2">
      {runs.map((run) => (
        <li key={run.id} className="border-border rounded-xl border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                STATUS_TONE[run.status]
              )}
            >
              {run.status}
            </span>
            <span className="text-sm font-medium">{run.run_date}</span>
            <span className="text-caption">
              {run.trigger} · {run.topic_count} topics · {run.candidate_count} candidates
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(run.source_stats ?? {}).map(([source, stat]) => (
              <span
                key={source}
                title={stat.error ?? undefined}
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs',
                  stat.ok ? 'bg-muted text-muted-foreground' : 'bg-destructive/10 text-destructive'
                )}
              >
                {SOURCE_LABELS[source] ?? source}: {stat.ok ? stat.count : 'failed'}
              </span>
            ))}
          </div>
          {run.ai_error ? (
            <p className="text-destructive mt-2 text-xs">{run.ai_error}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function TopicRow({
  topic,
  hidden,
  onHide,
  onPin,
  onUnhide,
  busy,
}: {
  topic: TrendTopicRow;
  hidden: boolean;
  onHide: () => void;
  onPin: () => void;
  onUnhide: () => void;
  busy: boolean;
}) {
  return (
    <li className="border-border rounded-xl border p-3">
      <div className="flex items-start gap-2">
        <span className="text-caption w-5 shrink-0 pt-0.5 tabular-nums">{topic.rank}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{topic.title}</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{topic.summary}</p>
          <p className="text-caption mt-1">
            {topic.category} · stay fit {topic.stay_fit} · {topic.momentum} ·{' '}
            {topic.sources.map((source) => SOURCE_LABELS[source.source] ?? source.source).join(' · ')}
          </p>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        {hidden ? (
          <Button type="button" variant="outline" size="sm" onClick={onUnhide} disabled={busy}>
            <PinOff className="size-4" aria-hidden />
            Unhide
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onHide} disabled={busy}>
            <EyeOff className="size-4" aria-hidden />
            Hide
          </Button>
        )}
        {hidden ? null : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPin}
            disabled={busy || topic.pinned}
          >
            <Pin className="size-4" aria-hidden />
            {topic.pinned ? 'Pinned' : 'Pin'}
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Marketing Trends moderation (`/admin/marketing-trends`).
 *
 * The run ledger, today's list, the manual topics and a Run now button. A hide
 * applies at read time, so it reaches hosts within five minutes without a rerun.
 */
export function SuperAdminMarketingTrendsPage() {
  const { data, isLoading, error } = useMarketingTrendsAdmin();
  const moderate = useMarketingTrendsModeration();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const runs = data?.runs ?? [];
  const topics = data?.topics ?? [];
  const overrides = data?.overrides ?? [];
  const manualTopics = data?.manualTopics ?? [];
  const hidden = new Set(
    overrides.filter((entry) => entry.action === 'hide').map((entry) => entry.topic_key)
  );

  const addTopic = () => {
    const value = title.trim();
    if (!value) {
      toast.error('Give the topic a title');
      return;
    }
    moderate.mutate(
      { action: 'add-topic', title: value, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          setTitle('');
          setNotes('');
          toast.success('Topic added');
        },
      }
    );
  };

  const runNow = () => {
    moderate.mutate(
      { action: 'run-now' },
      {
        onSuccess: () => toast.success('Run finished'),
      }
    );
  };

  return (
    <SuperAdminPage
      title="Marketing trends"
      subtitle="The daily list of what people in the Philippines are talking about. A hide reaches hosts within five minutes."
      isLoading={isLoading && !data}
      error={error}
      errorMessage="Could not load the Marketing Trends data."
      actions={
        <Button type="button" onClick={runNow} disabled={moderate.isPending}>
          {moderate.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          Run now
        </Button>
      }
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-card-title">Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <RunLedger runs={runs} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-card-title">Add a topic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="trend-title" className="settings-field-label">
                Title
              </Label>
              <Input
                id="trend-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="A TikTok sound or a local event"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trend-notes" className="settings-field-label">
                Notes
              </Label>
              <Textarea
                id="trend-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional context for the classifier"
                rows={3}
              />
            </div>
            <Button type="button" onClick={addTopic} disabled={moderate.isPending}>
              <Plus className="size-4" aria-hidden />
              Add topic
            </Button>
            {manualTopics.length ? (
              <ul className="space-y-1.5 border-border border-t pt-3">
                {manualTopics.map((topic) => (
                  <li key={topic.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{topic.title}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        moderate.mutate({ action: 'remove-topic', id: topic.id })
                      }
                      disabled={moderate.isPending}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">Today's list</CardTitle>
        </CardHeader>
        <CardContent>
          {topics.length ? (
            <ul className="space-y-2">
              {topics.map((topic) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  hidden={hidden.has(topic.topic_key)}
                  busy={moderate.isPending}
                  onHide={() =>
                    moderate.mutate({ action: 'hide', topicKey: topic.topic_key })
                  }
                  onUnhide={() =>
                    moderate.mutate({ action: 'unhide', topicKey: topic.topic_key })
                  }
                  onPin={() => moderate.mutate({ action: 'pin', topicKey: topic.topic_key })}
                />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <TrendingUp className="size-4" aria-hidden />
              No published list yet.
            </p>
          )}
        </CardContent>
      </Card>
    </SuperAdminPage>
  );
}
