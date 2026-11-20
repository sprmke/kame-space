import { useMemo, useState } from 'react';

import { Link, Navigate } from 'react-router-dom';

import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';
import {
  SUPER_ADMIN_NAV_GROUPS,
} from '@/features/dashboard/super-admin/lib/superAdminPlatformNav';

import { AdminMobilePage } from '@/components/mobile/AdminMobilePage';
import { IconTile } from '@/components/mobile/native/IconTile';
import { ListRow } from '@/components/mobile/native/ListRow';
import { ListSection } from '@/components/mobile/native/ListSection';
import { SearchField } from '@/components/mobile/native/SearchField';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { usePageTitle } from '@/lib/pageTitle';

/** D9 Console hub: Work-style index of every `/admin/*` tool below Overview. */
export function SuperAdminConsolePage() {
  const isMobile = useIsBelowLg();
  const [query, setQuery] = useState('');
  usePageTitle('Kame Space - Console');

  const normalized = query.trim().toLowerCase();
  const groups = useMemo(() => {
    if (!normalized) return SUPER_ADMIN_NAV_GROUPS;
    return SUPER_ADMIN_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(normalized)),
    })).filter((group) => group.items.length > 0);
  }, [normalized]);

  if (!isMobile) {
    return <Navigate to={superAdminPaths.root} replace />;
  }

  return (
    <AdminMobilePage title="Console" superAdmin>
      <div className="space-y-4">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search console"
          aria-label="Search console"
        />
        {groups.map((group) => (
          <ListSection key={group.label} title={group.label}>
            {group.items.map((item) => (
              <Link key={item.href} to={item.href} className="block">
                <ListRow
                  lead={<IconTile icon={item.Icon} />}
                  title={item.label}
                  chevron
                />
              </Link>
            ))}
          </ListSection>
        ))}
      </div>
    </AdminMobilePage>
  );
}
