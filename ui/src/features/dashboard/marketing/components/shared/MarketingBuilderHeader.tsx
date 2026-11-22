import type { ReactNode } from 'react';

type Props = {
  /** Optional leading control (rarely used; prefer `actions` for theme). */
  leading?: ReactNode;
  /** Calendar / Posts / Videos / AI Studio switcher. */
  tabs?: ReactNode;
  status?: ReactNode;
  /** Compact trailing controls (theme switcher). Same row as tabs. */
  actions?: ReactNode;
};

/**
 * Studio chrome: one row. Tabs scroll; trailing actions stay pinned so nothing
 * wraps onto a second control strip on phone.
 */
export function MarketingBuilderHeader({ leading, tabs, status, actions }: Props) {
  return (
    <div className="border-border bg-card flex items-center gap-2 border-b px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
      {leading ? <div className="min-w-0 shrink">{leading}</div> : null}
      {tabs ? <div className="min-w-0 flex-1 overflow-x-auto">{tabs}</div> : null}
      <div className="ml-auto flex shrink-0 items-center gap-1.5 empty:hidden">{status}{actions}</div>
    </div>
  );
}
