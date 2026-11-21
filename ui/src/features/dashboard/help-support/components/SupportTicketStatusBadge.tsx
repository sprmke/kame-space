import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { SupportTicketStatus } from '../lib/supportTicketApi';

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_CLASSES: Record<SupportTicketStatus, string> = {
  open: 'border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-300',
  in_progress: 'border-transparent bg-amber-500/10 text-amber-800 dark:text-amber-300',
  resolved: 'border-transparent bg-emerald-600/10 text-emerald-800 dark:text-emerald-300',
  closed: 'bg-muted text-muted-foreground border-transparent',
};

export function SupportTicketStatusBadge({
  status,
  compact = false,
}: {
  status: SupportTicketStatus;
  compact?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(STATUS_CLASSES[status], compact && 'px-1.5 py-0 text-[10px] font-medium')}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
