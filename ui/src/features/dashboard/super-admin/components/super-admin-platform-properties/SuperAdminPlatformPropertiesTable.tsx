import { Link, useNavigate } from 'react-router-dom';

import {
  AdminDataTable,
  AdminTableActionsTh,
  AdminTableHeadRow,
  AdminTableRowAffordance,
  AdminTableTh,
  adminTableBodyText,
  adminTableCell,
  adminTableRowClass,
} from '@/features/dashboard/bookings/components/AdminDataTable';
import { OrgPropertyStatusBadge } from '@/features/dashboard/org/components/org-properties/OrgPropertyStatusBadge';
import { orgPropertyCardModel } from '@/features/dashboard/org/lib/orgPropertyCardModel';
import { orgPropertyTypeLabel } from '@/features/dashboard/org/lib/orgPropertyDisplay';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { platformPropertyToProperty } from '@/features/dashboard/super-admin/lib/platformPropertyAdapter';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';
import type { PlatformProperty } from '@/features/dashboard/super-admin/types/platformProperty';

import { cn } from '@/lib/utils';

type Props = {
  properties: PlatformProperty[];
};

export function SuperAdminPlatformPropertiesTable({ properties }: Props) {
  const navigate = useNavigate();

  return (
    <AdminDataTable minWidth={760}>
      <AdminTableHeadRow>
        <AdminTableTh className="pl-4 pr-3 sm:pl-5">Property</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:table-cell sm:px-4">Organization</AdminTableTh>
        <AdminTableTh className="hidden px-3 md:table-cell md:px-4">Development</AdminTableTh>
        <AdminTableTh className="hidden px-3 lg:table-cell lg:px-4">Type</AdminTableTh>
        <AdminTableTh className="hidden px-3 xl:table-cell xl:px-4">Location</AdminTableTh>
        <AdminTableTh className="px-3 sm:px-4">Status</AdminTableTh>
        <AdminTableActionsTh><span className="sr-only">Open</span></AdminTableActionsTh>
      </AdminTableHeadRow>
      <tbody>
        {properties.map((platformProperty, index) => {
          const property = platformPropertyToProperty(platformProperty);
          const model = orgPropertyCardModel(property);
          const href = propertySectionPath(
            platformProperty.organizationSlug,
            property.slug,
            'dashboard'
          );
          const residence =
            platformProperty.developmentName?.trim() ||
            platformProperty.residenceName?.trim() ||
            null;

          return (
            <tr
              key={platformProperty.id}
              className={adminTableRowClass(index)}
              onClick={() => navigate(href)}
            >
              <td className={adminTableCell.body}>
                <div className="min-w-[140px]">
                  <Link
                    to={href}
                    onClick={(event) => event.stopPropagation()}
                    className={cn('truncate text-left hover:underline', adminTableBodyText.primary)}
                  >
                    {model.title}
                  </Link>
                  {model.subtitle ? (
                    <p className={cn('truncate', adminTableBodyText.secondary)}>{model.subtitle}</p>
                  ) : null}
                  <p className={cn('mt-1 sm:hidden', adminTableBodyText.secondary)}>
                    {platformProperty.organizationName || '-'}
                  </p>
                </div>
              </td>
              <td className={cn(adminTableCell.body, 'hidden sm:table-cell')}>
                <p className={cn('max-w-[10rem] truncate', adminTableBodyText.secondary)}>
                  {platformProperty.organizationName || '-'}
                </p>
              </td>
              <td className={cn(adminTableCell.body, 'hidden md:table-cell')}>
                {platformProperty.developmentSlug && platformProperty.developmentName ? (
                  <Link
                    to={superAdminPaths.developmentDetail(platformProperty.developmentSlug)}
                    className="text-brand-ink relative z-[2] truncate text-sm hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {platformProperty.developmentName}
                  </Link>
                ) : (
                  <p className={cn('max-w-[12rem] truncate', adminTableBodyText.secondary)}>
                    {residence ?? '-'}
                  </p>
                )}
              </td>
              <td className={cn(adminTableCell.body, 'hidden lg:table-cell')}>
                <p className={adminTableBodyText.secondary}>
                  {orgPropertyTypeLabel(property.type)}
                </p>
              </td>
              <td className={cn(adminTableCell.body, 'hidden xl:table-cell')}>
                <p className={cn('max-w-[14rem] truncate', adminTableBodyText.secondary)}>
                  {model.locationLine}
                </p>
              </td>
              <td className={adminTableCell.status}>
                <OrgPropertyStatusBadge
                  status={property.status}
                  className="normal-case tracking-normal"
                />
              </td>
              <td className={adminTableCell.action}>
                <AdminTableRowAffordance />
              </td>
            </tr>
          );
        })}
      </tbody>
    </AdminDataTable>
  );
}
