import {
  QUICK_REPLY_GROUP_TABS,
  quickReplyGroupLabel,
  type QuickReplyGroupTab,
} from '@/features/dashboard/inbox/lib/quickReplyGroups';

import { SegmentedControl } from '@/components/ui/sliding-tabs';

type Props = {
  value: QuickReplyGroupTab;
  onChange: (value: QuickReplyGroupTab) => void;
};

/** Channel filter for Manage → Quick replies (sliding pill, not route tabs). */
export function QuickReplyGroupFilters({ value, onChange }: Props) {
  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      size="compact"
      aria-label="Filter by group"
      options={QUICK_REPLY_GROUP_TABS.map((tab) => ({
        value: tab,
        label: quickReplyGroupLabel(tab),
      }))}
    />
  );
}
