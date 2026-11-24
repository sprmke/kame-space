import { Link } from 'react-router-dom';

import { Building2, ChevronRight } from 'lucide-react';

import { OrgPropertyStatusBadge } from '@/features/dashboard/org/components/org-properties/OrgPropertyStatusBadge';
import { orgPropertyCardModel } from '@/features/dashboard/org/lib/orgPropertyCardModel';
import { orgPropertyTypeLabel } from '@/features/dashboard/org/lib/orgPropertyDisplay';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { platformPropertyToProperty } from '@/features/dashboard/super-admin/lib/platformPropertyAdapter';
import type { PlatformProperty } from '@/features/dashboard/super-admin/types/platformProperty';

import { cn } from '@/lib/utils';

/**
 * Phone row for the platform property list.
 *
 * The shared host card is photo-first (a full-width image before any text), which is
 * right for a host browsing their own listing and wrong for an operator scanning 50
 * properties. This keeps a small thumbnail and puts the identity first.
 */
export function SuperAdminPlatformPropertyRow({ platformProperty }: { platformProperty: PlatformProperty }) {
  const property = platformPropertyToProperty(platformProperty);
  const model = orgPropertyCardModel(property);
  const href = propertySectionPath(platformProperty.organizationSlug, property.slug, 'dashboard');
  const location = [platformProperty.organizationName, model.locationLine]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      to={href}
      className="surface-card hover:border-primary/40 flex items-center gap-3 p-2.5 transition-colors"
    >
      <div className="bg-muted size-14 shrink-0 overflow-hidden rounded-lg">
        {model.thumbnailUrl ? (
          <img
            src={model.thumbnailUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground flex size-full items-center justify-center">
            <Building2 className="size-5" aria-hidden />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{model.title}</p>
          <OrgPropertyStatusBadge
            status={property.status}
            className="shrink-0 normal-case tracking-normal"
          />
        </div>
        <p className={cn('text-muted-foreground truncate text-xs')}>
          {orgPropertyTypeLabel(property.type)}
          {location ? ` · ${location}` : ''}
        </p>
      </div>

      <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
    </Link>
  );
}
