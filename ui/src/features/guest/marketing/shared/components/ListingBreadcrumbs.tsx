import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

export type BreadcrumbItem = {
  label: string;
  /** Omit on the current page. */
  to?: string;
};

/**
 * Visible breadcrumb trail for a listing detail page. The same items feed the page's
 * `BreadcrumbList` JSON-LD, so the markup and the structured data can never disagree.
 *
 * Mobile: wraps to a second line and truncates the current page, never scrolls sideways.
 */
export function ListingBreadcrumbs({
  items,
  className,
}: {
  items: readonly BreadcrumbItem[];
  className?: string;
}) {
  if (items.length < 2) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? (
                <span aria-hidden className="text-border">
                  /
                </span>
              ) : null}
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="hover:text-foreground focus-visible:ring-ring truncate rounded transition-colors focus-visible:outline-none focus-visible:ring-2"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className="text-foreground/80 max-w-[22ch] truncate"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
