import { Link } from 'react-router-dom';

import { NoticeCallout } from '@/components/help/NoticeCallout';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import type { HowItWorksStep } from '@/lib/help/types';
import { cn } from '@/lib/utils';

export type HowItWorksDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Panel heading, e.g. "How pricing works". */
  title: string;
  /** Three to four steps. */
  steps: HowItWorksStep[];
  /**
   * Optional callout above `tip` (e.g. live platform rates moved off the page).
   * Keep under 200 characters when sourced from `*HelpCopy.ts`.
   */
  notice?: string;
  /** Optional single tip under the steps. */
  tip?: string;
  /** Internal Help Center path. Omit when no article exists. */
  learnMoreHref?: string;
  className?: string;
};

function howItWorksColumnsClass(stepCount: number): string {
  if (stepCount >= 4) return 'md:grid-cols-2 lg:grid-cols-4';
  if (stepCount === 3) return 'md:grid-cols-3';
  if (stepCount === 2) return 'md:grid-cols-2';
  return '';
}

/**
 * Feature intro panel: dialog on desktop, bottom sheet on phone. Renders as an
 * ordered list so screen readers announce the step count and order.
 */
export function HowItWorksDialog({
  open,
  onOpenChange,
  title,
  steps,
  notice,
  tip,
  learnMoreHref,
  className,
}: HowItWorksDialogProps) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        className={cn('md:max-w-[min(94vw,56rem)]', className)}
        sheetLayout="scroll"
      >
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            {title} in {steps.length} steps.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="py-2">
          <ol className={cn('grid grid-cols-1 gap-5 md:gap-6', howItWorksColumnsClass(steps.length))}>
            {steps.map((step, index) => (
              <li key={step.title} className="flex min-w-0 gap-3 md:h-full md:flex-col md:gap-3">
                {/* Equal columns: connector spans the cell remainder + gap to the next icon. */}
                <div className="relative flex shrink-0 items-center md:w-full">
                  <div className="bg-primary/10 text-primary relative z-[1] flex size-10 shrink-0 items-center justify-center rounded-full">
                    <step.icon className="size-4" aria-hidden />
                  </div>
                  {index < steps.length - 1 ? (
                    <span
                      aria-hidden
                      className="bg-border absolute left-10 top-1/2 hidden h-px w-[calc(100%-2.5rem+1.5rem)] -translate-y-1/2 md:block"
                    />
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-1 flex-col space-y-1">
                  <p className="text-primary text-[11px] font-semibold uppercase tracking-wide">
                    Step {index + 1}
                  </p>
                  <p className="text-sm font-semibold leading-snug">{step.title}</p>
                  <p className="text-muted-foreground text-[13px] leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {notice || tip ? (
          <div className="space-y-2">
            {notice ? <NoticeCallout tone="info">{notice}</NoticeCallout> : null}
            {tip ? <NoticeCallout tone="info">{tip}</NoticeCallout> : null}
          </div>
        ) : null}

        <ResponsiveModalFooter className="pt-1">
          {learnMoreHref ? (
            <Link
              to={learnMoreHref}
              className="text-primary mr-auto self-center text-xs font-medium underline-offset-4 hover:underline"
            >
              Learn more
            </Link>
          ) : null}
          <ResponsiveModalClose asChild>
            <Button type="button" variant="secondary" size="sm">
              Close
            </Button>
          </ResponsiveModalClose>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
