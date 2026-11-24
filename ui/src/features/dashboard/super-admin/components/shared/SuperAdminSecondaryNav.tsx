import { useCallback, useEffect, useRef, useState } from 'react';

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
 * Pill tabs for Super Admin detail shells. On phones the row scrolls horizontally and keeps the
 * active pill in view; five tabs cannot wrap without the active one reading as a stray button.
 */
export function SuperAdminSecondaryNav({
  items,
  className,
  ariaLabel = 'Sections',
}: SuperAdminSecondaryNavProps) {
  const activeRef = useRef<HTMLSpanElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const updateEdges = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    setEdges({
      left: node.scrollLeft > 4,
      right: node.scrollLeft + node.clientWidth < node.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
    updateEdges();
    const node = scrollerRef.current;
    if (!node) return;
    node.addEventListener('scroll', updateEdges, { passive: true });
    const observer = new ResizeObserver(updateEdges);
    observer.observe(node);
    return () => {
      node.removeEventListener('scroll', updateEdges);
      observer.disconnect();
    };
  }, [updateEdges]);

  return (
    <nav aria-label={ariaLabel} className={cn('relative min-w-0 pb-0.5', className)}>
      {edges.left ? (
        <div
          className="from-background pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-gradient-to-r to-transparent sm:hidden"
          aria-hidden
        />
      ) : null}
      {edges.right ? (
        <div
          className="from-background pointer-events-none absolute inset-y-0 right-0 z-10 w-5 bg-gradient-to-l to-transparent sm:hidden"
          aria-hidden
        />
      ) : null}
      <div
        ref={scrollerRef}
        data-testid="super-admin-tabs"
        className="-mx-1 flex min-w-0 snap-x items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const renderPill = (active: boolean) => (
            <span
              ref={active ? activeRef : undefined}
              data-active={active}
              className={cn(
                'inline-flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
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
              <NavLink key={item.to} to={item.to} className="shrink-0">
                {renderPill(item.active)}
              </NavLink>
            );
          }

          return (
            <NavLink key={item.to} to={item.to} end={item.end ?? true} className="shrink-0">
              {({ isActive }) => renderPill(isActive)}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
