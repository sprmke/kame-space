import { Component, type ErrorInfo, type ReactNode } from 'react';

import { RotateCw } from 'lucide-react';


import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNearViewport } from '@/hooks/useNearViewport';
import { captureRenderError } from '@/lib/sentry/capture';

import type { LucideIcon } from 'lucide-react';

type Props = {
  id: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
};

type State = { error: Error | null };

/**
 * One anchored block of the organization hub.
 *
 * Each section owns its error boundary: a section card that receives an unexpected
 * payload shape (a partial response, a 500, a schema change) must not replace the
 * whole organization page with the router error screen. Heading stays mounted and
 * the operator can retry just that section.
 *
 * Content also waits until it is near the viewport, so opening the hub no longer
 * fires every section's queries at once (it used to make 16 edge calls on mount).
 */
export class SuperAdminOrgHubSection extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SuperAdminOrgHubSection]', this.props.id, error, info.componentStack);
    captureRenderError(error, info.componentStack);
  }

  render() {
    return <HubSectionBody {...this.props} error={this.state.error} onRetry={this.reset} />;
  }

  private reset = () => this.setState({ error: null });
}

function HubSectionBody({
  id,
  title,
  icon: Icon,
  children,
  error,
  onRetry,
}: Props & { error: Error | null; onRetry: () => void }) {
  const { ref, near } = useNearViewport<HTMLDivElement>();

  return (
    <div id={`section-${id}`} ref={ref} className="scroll-mt-2 space-y-3">
      <h2 className="text-section-title flex items-center gap-2">
        <Icon className="size-4 shrink-0" aria-hidden />
        {title}
      </h2>
      {error ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-foreground text-sm font-medium">This section did not load</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              The rest of the organization is still available.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={onRetry}
          >
            <RotateCw className="size-4" aria-hidden />
            Try again
          </Button>
        </Card>
      ) : near ? (
        children
      ) : (
        <Card className="space-y-2 p-4" aria-hidden>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </Card>
      )}
    </div>
  );
}

