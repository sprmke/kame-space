import { useEffect, useMemo, useRef, useState } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { TelegramTemplateEditor } from '@/features/dashboard/bookings/components/TelegramTemplateEditor';
import { TelegramTemplateDialogProvider } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramTemplateDialogContext';
import { TelegramPlaceholdersNestedDialog } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramPlaceholdersNestedDialog';
import { buildValidPlaceholderKeySet } from '@/features/dashboard/bookings/lib/telegramPlaceholderGroups';
import {
  applyInboxQuickReplyMerge,
  buildSampleQuickReplyMergeContext,
  INBOX_QUICK_REPLY_MERGE_FIELDS,
} from '@/features/dashboard/inbox/lib/inboxQuickReplyMerge';
import {
  platformFromQuickReplyGroup,
  quickReplyGroupFromPlatform,
  QUICK_REPLY_ASSIGN_GROUPS,
  quickReplyGroupLabel,
  type QuickReplyGroup,
} from '@/features/dashboard/inbox/lib/quickReplyGroups';
import type {
  InboxTemplate,
  SaveInboxTemplatePayload,
} from '@/features/dashboard/inbox/types/inbox';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGuardedClose } from '@/hooks/useGuardedClose';

type Props = {
  open: boolean;
  template: InboxTemplate | null;
  defaultGroup: QuickReplyGroup;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: SaveInboxTemplatePayload) => Promise<void>;
};

const QUICK_REPLY_PLACEHOLDER_LINES = [
  'guest_name: Guest display name',
  'property_name: Property name',
  'check_in_date: Check-in date',
  'check_out_date: Check-out date',
  'inquiry_dates: Stay date range',
  'calendar_link: Public calendar link',
  'property_link: Property page link',
  'form_link: Booking form link',
  'messages_link: Guest messages link',
  'showcase_link: Showcase page link',
  'map_link: Map link',
  'stay_guide_link: Stay guide link',
] as const;

function buildQuickReplySampleVars(): Record<string, string> {
  const ctx = buildSampleQuickReplyMergeContext();
  const vars: Record<string, string> = {};
  for (const token of INBOX_QUICK_REPLY_MERGE_FIELDS) {
    const key = token.slice(2, -2);
    vars[key] = applyInboxQuickReplyMerge(token, ctx);
  }
  return vars;
}

export function InboxQuickReplyFormDialog({
  open,
  template,
  defaultGroup,
  saving,
  onOpenChange,
  onSave,
}: Props) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [group, setGroup] = useState<QuickReplyGroup>('all');
  const [placeholdersOpen, setPlaceholdersOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const insertTokenRef = useRef<((token: string) => void) | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(template?.title ?? '');
    setBody(template?.body_text ?? '');
    setGroup(template ? quickReplyGroupFromPlatform(template.platform) : defaultGroup);
    setPlaceholdersOpen(false);
    setResetOpen(false);
  }, [open, template, defaultGroup]);

  const { canUse: canUseQuickReplies, isLoading: quickRepliesLoading } =
    useFeatureGate('quickReplies');
  const { open: openUpgradeModal } = useUpgradeModal();

  const sampleVars = useMemo(() => buildQuickReplySampleVars(), []);
  const validPlaceholderKeys = useMemo(
    () => buildValidPlaceholderKeySet([...QUICK_REPLY_PLACEHOLDER_LINES]),
    []
  );

  const baselineTitle = template?.title ?? '';
  const baselineBody = template?.body_text ?? '';
  const initialGroup = template ? quickReplyGroupFromPlatform(template.platform) : defaultGroup;

  const handleSubmit = async (): Promise<boolean> => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and message required');
      return false;
    }
    if (!canUseQuickReplies) {
      if (!quickRepliesLoading) openUpgradeModal('quickReplies');
      return false;
    }
    try {
      await onSave({
        id: template?.id,
        title: title.trim(),
        bodyText: body.trim(),
        platform: platformFromQuickReplyGroup(group),
      });
      toast.success(template ? 'Updated' : 'Saved');
      onOpenChange(false);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  };

  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty: title !== baselineTitle || body !== baselineBody || group !== initialGroup,
    onSave: handleSubmit,
    onDiscard: () => {
      setTitle(baselineTitle);
      setBody(baselineBody);
      setGroup(initialGroup);
    },
  });

  const handleResetConfirm = () => {
    setTitle(baselineTitle);
    setBody(baselineBody);
    setGroup(initialGroup);
    setResetOpen(false);
  };

  const dialogActions = useMemo(
    () => ({
      openPlaceholders: () => setPlaceholdersOpen(true),
      disabled: saving,
      insertTokenRef,
    }),
    [saving]
  );

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title={template ? 'Edit reply' : 'New reply'}
        sizeClassName="max-w-[min(calc(100vw-1.5rem),36rem)] sm:max-w-[min(90vw,40rem)]"
        heightClassName="max-h-[min(92dvh,44rem)]"
        contentClassName="z-[103]"
        overlayClassName="z-[102]"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] sm:min-h-10"
              disabled={saving}
              onClick={requestClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-[44px] sm:min-h-10"
              disabled={saving || !title.trim() || !body.trim()}
              onClick={() => void handleSubmit()}
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Save'}
            </Button>
          </>
        }
      >
        <TelegramTemplateDialogProvider value={dialogActions}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inbox-qr-form-title">Title</Label>
              <Input
                id="inbox-qr-form-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Availability check"
                className="h-10"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inbox-qr-form-group">Group</Label>
              <Select
                value={group}
                onValueChange={(value) => setGroup(value as QuickReplyGroup)}
                disabled={saving}
              >
                <SelectTrigger id="inbox-qr-form-group" className="h-10 min-h-[44px] sm:min-h-10">
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent className="z-[104]">
                  {QUICK_REPLY_ASSIGN_GROUPS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {quickReplyGroupLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TelegramTemplateEditor
              id="inbox-qr-form-body"
              label="Message"
              value={body}
              onChange={setBody}
              disabled={saving}
              onReset={() => setResetOpen(true)}
              validPlaceholderKeys={validPlaceholderKeys}
              rows={8}
              minHeightClassName="min-h-[180px]"
            />
          </div>
        </TelegramTemplateDialogProvider>
      </AdminDialogShell>

      <TelegramPlaceholdersNestedDialog
        open={placeholdersOpen}
        onOpenChange={setPlaceholdersOpen}
        lines={[...QUICK_REPLY_PLACEHOLDER_LINES]}
        sampleVars={sampleVars}
        onInsertToken={(token) => {
          insertTokenRef.current?.(token);
        }}
      />

      <ResponsiveModal open={resetOpen} onOpenChange={setResetOpen}>
        <ResponsiveModalContent className="z-[105] sm:max-w-[28rem]" overlayClassName="z-[104]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Reset message?</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              {template
                ? 'This clears your edits and restores the saved title, group, and message.'
                : 'This clears the title, group, and message on this form.'}
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ResponsiveModalFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleResetConfirm}>
              Reset
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
