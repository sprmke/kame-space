import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

export type SuperAdminSecondaryNavItem = {
  label: string;
  to: string;
  /** Match child routes too (default: exact match on `end`). */
  end?: boolean;
  icon?: LucideIcon;
  /** Force active regardless of the route match (nested/aliased routes). */
  active?: boolean;
};

type SuperAdminSecondaryNavProps = {
  items: SuperAdminSecondaryNavItem[];
  className?: string;
  ariaLabel?: string;
};

/**
 * Pill tabs for Super Admin detail shells. Wraps onto a second line on phones so
 * every destination stays reachable without a hidden horizontal scroller.
 */
export function SuperAdminSecondaryNav({
  items,
  className,
  ariaLabel = 'Sections',
}: SuperAdminSecondaryNavProps) {
  return (
    <nav aria-label={ariaLabel} className={cn('pb-0.5', className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const pill = (active: boolean) => (
            <span
              data-active={active}
              className={cn(
                'inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-strong text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
              {item.label}
            </span>
          );

          if (item.active != null) {
            return (
              <NavLink key={item.to} to={item.to}>
                {pill(item.active)}
              </NavLink>
            );
          }

          return (
            <NavLink key={item.to} to={item.to} end={item.end ?? true}>
              {({ isActive }) => pill(isActive)}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
