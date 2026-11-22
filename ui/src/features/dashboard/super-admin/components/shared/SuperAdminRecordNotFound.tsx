import { Link } from 'react-router-dom';

import { SearchX } from 'lucide-react';

import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { Button } from '@/components/ui/button';

type Props = {
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
};

/**
 * Console-scoped not-found state. Used when a record id or slug does not resolve,
 * so the operator keeps the admin shell and a way back.
 */
export function SuperAdminRecordNotFound({
  title,
  description,
  backTo = superAdminPaths.root,
  backLabel = 'Back to Overview',
}: Props) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-10">
      <div className="border-border bg-card w-full max-w-md rounded-xl border p-6 text-center">
        <SearchX className="text-muted-foreground mx-auto mb-3 size-8" aria-hidden />
        <h1 className="text-foreground text-lg font-semibold">{title}</h1>
        {description ? <p className="text-muted-foreground mt-2 text-sm">{description}</p> : null}
        <Button asChild variant="outline" className="mt-5">
          <Link to={backTo}>{backLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
