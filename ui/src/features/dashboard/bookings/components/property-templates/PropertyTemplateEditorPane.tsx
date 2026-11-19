import * as React from 'react';

import { Link } from 'react-router-dom';

import {
  Braces,
  ChevronLeft,
  Clock,
  Eye,
  FolderInput,
  Lock,
  Pencil,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';

import { PropertyTemplatePlaceholdersDialog } from '@/features/dashboard/bookings/components/property-templates/PropertyTemplatePlaceholdersDialog';
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from '@/features/dashboard/bookings/components/property-templates/RichTextEditor';
import { SendCustomTemplateDialog } from '@/features/dashboard/bookings/components/property-templates/SendCustomTemplateDialog';
import { TemplateSectionImageField } from '@/features/dashboard/bookings/components/property-templates/TemplateSectionImageField';
import {
  usePropertyTemplatePreview,
  useSendPropertyTemplateTestEmail,
  type GuestTemplatePhase,
} from '@/features/dashboard/bookings/hooks/usePropertyTemplates';
import { useUploadPropertyTemplateAsset } from '@/features/dashboard/bookings/hooks/useUploadPropertyTemplateAsset';
import { normalizePropertyTemplateEditorContent } from '@/features/dashboard/bookings/lib/normalizePropertyTemplateEditorContent';
import {
  PROPERTY_TEMPLATE_SAMPLE_VARS,
  previewPropertyTemplateSubject,
} from '@/features/dashboard/bookings/lib/propertyTemplatePlaceholders';
import { buildValidPlaceholderKeySet } from '@/features/dashboard/bookings/lib/telegramPlaceholderGroups';
import {
  templateMetaParts,
  type TemplateLibraryEntry,
} from '@/features/dashboard/bookings/lib/templateLibrary';
import { propertyPlaceholderLinesForDto } from '@/features/dashboard/bookings/lib/templatePlaceholderCatalog';
import { attachTemplatePreviewActionBlocker } from '@/features/dashboard/bookings/lib/templatePreviewReadonly';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { ResponsiveOverflowMenu } from '@/components/mobile/ResponsiveOverflowMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  SegmentedControl,
  cardHeaderSegmentedListClassName,
  cardHeaderSegmentedTriggerClassName,
} from '@/components/ui/sliding-tabs';
import { Switch } from '@/components/ui/switch';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { cn } from '@/lib/utils';

type EditorTab = 'edit' | 'preview';

const EDITOR_VIEW_OPTIONS = [
  {
    value: 'edit' as const,
    label: <span className="hidden sm:inline">Edit</span>,
    ariaLabel: 'Edit',
    icon: Pencil,
  },
  {
    value: 'preview' as const,
    label: <span className="hidden sm:inline">Preview</span>,
    ariaLabel: 'Preview',
    icon: Eye,
  },
];

type Props = {
  entry: TemplateLibraryEntry;
  onSave: (input: {
    content: string;
    sectionImageUrl?: string | null;
    guestVisible?: boolean;
    guestPhase?: GuestTemplatePhase;
    subject?: string | null;
  }) => Promise<void>;
  onReset?: () => Promise<void> | void;
  onDelete?: () => void;
  /** Custom templates only — opens the rename prompt the page owns. */
  onRename?: () => void;
  /** Custom templates only — opens the folder picker the page owns. */
  onMove?: () => void;
  /** Phone only — returns to the library list. */
  onBack?: () => void;
  saving?: boolean;
  /** When false, hides the section image uploader (Stay Guide images live in Page Editor). */
  showSectionImage?: boolean;
  /** When false, content is preview-only (no edit/save/reset/delete). */
  canEdit?: boolean;
  /** Property-data tokens that resolve to an empty string for this property. */
  emptyPlaceholders?: string[];
  /** Email automations section for the Automation fact link. */
  automationHref?: string;
};

export function PropertyTemplateEditorPane({
  entry,
  onSave,
  onReset,
  onDelete,
  onRename,
  onMove,
  onBack,
  saving,
  showSectionImage = true,
  canEdit = true,
  emptyPlaceholders = [],
  automationHref,
}: Props) {
  const { template, icon: Icon } = entry;
  const [content, setContent] = React.useState(() =>
    normalizePropertyTemplateEditorContent(template)
  );
  const [sectionImageUrl, setSectionImageUrl] = React.useState(template.sectionImageUrl);
  const [guestVisible, setGuestVisible] = React.useState(template.guestVisible);
  const [guestPhase, setGuestPhase] = React.useState<GuestTemplatePhase>(template.guestPhase);
  const [subject, setSubject] = React.useState(template.subject ?? '');
  const [sectionImagePreviewBust, setSectionImagePreviewBust] = React.useState(() =>
    template.updatedAt ? Date.parse(template.updatedAt) || 0 : 0
  );
  const [activeTab, setActiveTab] = React.useState<EditorTab>(canEdit ? 'edit' : 'preview');
  const [previewHtml, setPreviewHtml] = React.useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = React.useState('');
  const [previewFailed, setPreviewFailed] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [placeholdersOpen, setPlaceholdersOpen] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const editorRef = React.useRef<RichTextEditorHandle>(null);
  const previewIframeRef = React.useRef<HTMLIFrameElement>(null);
  const { mutateAsync: fetchPreview, isPending: previewPending } = usePropertyTemplatePreview();
  const { mutateAsync: sendTestEmail, isPending: sendingTest } = useSendPropertyTemplateTestEmail();
  const { canUse: canUseCustomTemplates, isLoading: customTemplatesLoading } =
    useFeatureGate('customTemplates');
  const { open: openUpgradeModal } = useUpgradeModal();

  React.useEffect(() => {
    if (!canEdit) setActiveTab('preview');
  }, [canEdit]);

  const baselineContent = React.useMemo(
    () => normalizePropertyTemplateEditorContent(template),
    [template.content, template.templateKey, template.category]
  );

  React.useEffect(() => {
    setContent(baselineContent);
    setSectionImageUrl(template.sectionImageUrl);
    setGuestVisible(template.guestVisible);
    setGuestPhase(template.guestPhase);
    setSubject(template.subject ?? '');
    setSectionImagePreviewBust(template.updatedAt ? Date.parse(template.updatedAt) || 0 : 0);
  }, [
    baselineContent,
    template.sectionImageUrl,
    template.guestVisible,
    template.guestPhase,
    template.subject,
    template.updatedAt,
  ]);

  const handleSectionImageUrlChange = React.useCallback((url: string | null) => {
    setSectionImageUrl(url);
    setSectionImagePreviewBust(url ? Date.now() : 0);
  }, []);

  const hasChanges =
    content !== baselineContent ||
    sectionImageUrl !== template.sectionImageUrl ||
    guestVisible !== template.guestVisible ||
    guestPhase !== template.guestPhase ||
    subject !== (template.subject ?? '');
  const isEmail = template.category === 'email' || template.category === 'message';
  const isAutomatedEmail = template.category === 'email';
  const isMessage = template.category === 'message';
  const isCustom = template.category === 'custom';
  const isStandard = template.category === 'standard';
  /** Automated emails and host-owned saves need Starter+; built-in guide sections and
   * built-in messages stay free. */
  const requiresStarterToPersist = isAutomatedEmail || entry.organisable;
  const allowSectionImage = isStandard && showSectionImage;
  const uploadTemplateAsset = useUploadPropertyTemplateAsset();

  const metaLine = React.useMemo(() => templateMetaParts(entry).join(' · '), [entry]);
  const subjectPlaceholder = React.useMemo(
    () =>
      template.defaultSubjectPreview ??
      previewPropertyTemplateSubject(template.defaultSubject ?? ''),
    [template]
  );

  const openStarterUpgradeIfNeeded = React.useCallback((): boolean => {
    if (!requiresStarterToPersist || canUseCustomTemplates) return false;
    if (!customTemplatesLoading) openUpgradeModal('customTemplates');
    return true;
  }, [canUseCustomTemplates, customTemplatesLoading, openUpgradeModal, requiresStarterToPersist]);

  useUnsavedChangesGuard({
    isDirty: hasChanges,
    enabled: canEdit,
    /* Selecting another template is a `?template=` change that unmounts this
     * editor, so the guard has to block on the full location, not just the path. */
    blocksOn: 'location',
    onSave: async () => {
      if (openStarterUpgradeIfNeeded()) return false;
      try {
        await onSave({
          content,
          sectionImageUrl,
          guestVisible,
          guestPhase,
          subject: subject.trim() || null,
        });
        return true;
      } catch {
        return false;
      }
    },
  });

  const placeholderLines = React.useMemo(
    () => propertyPlaceholderLinesForDto(template),
    [template]
  );

  const validPlaceholderKeys = React.useMemo(
    () => buildValidPlaceholderKeySet(placeholderLines),
    [placeholderLines]
  );

  const emptyTokensInTemplate = React.useMemo(() => {
    const present = new Set(
      [...content.matchAll(/\{\{([\w-]+)\}\}/g)].map((match) => match[1].replace(/-/g, '_'))
    );
    return emptyPlaceholders.filter((key) => present.has(key));
  }, [content, emptyPlaceholders]);

  const handleInlineImageUpload = React.useCallback(
    async (file: File) => {
      const result = await uploadTemplateAsset.mutateAsync({
        assetType: 'inline_image',
        file,
      });
      return result.url;
    },
    [uploadTemplateAsset]
  );

  const handleInsertPlaceholder = React.useCallback(
    (token: string) => {
      if (activeTab !== 'edit') {
        setActiveTab('edit');
      }
      window.setTimeout(() => {
        editorRef.current?.insertToken(token);
      }, 0);
    },
    [activeTab]
  );

  const handleSendTest = React.useCallback(() => {
    void sendTestEmail({
      templateKey: template.templateKey,
      category: template.category,
      content,
      subject: subject.trim() || null,
      name: template.name,
    });
  }, [content, sendTestEmail, subject, template.category, template.name, template.templateKey]);

  const loadPreview = React.useCallback(async () => {
    setPreviewHtml(null);
    setPreviewFailed(false);
    try {
      const result = await fetchPreview({
        templateKey: template.templateKey,
        category: template.category,
        content,
        subject: subject.trim() || null,
        name: template.name,
      });
      setPreviewHtml(result.html);
      setPreviewSubject(result.subject ?? '');
    } catch {
      setPreviewFailed(true);
    }
  }, [content, fetchPreview, subject, template.category, template.name, template.templateKey]);

  React.useEffect(() => {
    if (activeTab !== 'preview') return;
    void loadPreview();
  }, [activeTab, loadPreview]);

  React.useEffect(() => {
    if (activeTab !== 'preview' || !previewHtml) return;

    const iframe = previewIframeRef.current;
    if (!iframe) return;

    let detach: (() => void) | undefined;

    const bind = () => {
      detach?.();
      const doc = iframe.contentDocument;
      if (!doc) return;
      detach = attachTemplatePreviewActionBlocker(doc);
    };

    iframe.addEventListener('load', bind);
    bind();

    return () => {
      iframe.removeEventListener('load', bind);
      detach?.();
    };
  }, [activeTab, previewHtml]);

  const handleTabChange = (tab: EditorTab) => {
    setActiveTab(tab);
    if (tab === 'edit') {
      setPreviewHtml(null);
      setPreviewSubject('');
      setPreviewFailed(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Header and chrome stay put so Save is reachable from anywhere in a long template. */}
      <div className="bg-card border-separator shrink-0 border-b">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground flex min-h-[44px] w-full items-center gap-1 px-3 text-[13px] font-medium lg:hidden"
          >
            <ChevronLeft className="size-4 shrink-0" aria-hidden />
            All templates
          </button>
        ) : null}

        <div className="flex min-w-0 items-start gap-3 px-3 pb-3 pt-3 sm:px-4">
          {/* The open template is the one brand-tinted mark on the page; rail rows stay quiet. */}
          <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10">
            <Icon className="text-primary size-4 sm:size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-card-title min-w-0 truncate">{template.name}</h2>
              {requiresStarterToPersist ? <TierBadge feature="customTemplates" /> : null}
              {hasChanges ? (
                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px] font-medium">
                  <span className="bg-warning size-1.5 rounded-full" aria-hidden />
                  Unsaved
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground truncate text-xs">{metaLine}</p>
            {template.description ? (
              <p className="text-muted-foreground line-clamp-2 text-xs">{template.description}</p>
            ) : null}
          </div>
        </div>

        {template.newDefaultAvailable ? (
          <div className="border-primary/20 bg-primary/5 mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs sm:mx-4">
            <Sparkles className="text-primary size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">A newer default is available.</span>
            {onReset ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="relative h-8 shrink-0 before:absolute before:-inset-y-1.5 before:content-['']"
                onClick={() => setResetOpen(true)}
              >
                Use new default
              </Button>
            ) : null}
          </div>
        ) : null}

        {isEmail ? (
          <div className="border-separator space-y-3 border-t px-3 py-3 sm:px-4">
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
              {template.recipient ? (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5 shrink-0" aria-hidden />
                  {template.recipient === 'guest'
                    ? 'Guest'
                    : template.recipient === 'team'
                      ? 'Your team'
                      : 'Building admin'}
                </span>
              ) : null}
              {template.trigger ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5 shrink-0" aria-hidden />
                  {template.trigger}
                </span>
              ) : null}
              {template.automationToggleKey ? (
                automationHref ? (
                  <Link
                    to={automationHref}
                    className="hover:text-foreground inline-flex items-center gap-1.5 hover:underline"
                  >
                    <Zap className="size-3.5 shrink-0" aria-hidden />
                    {template.automationPlanBlocked
                      ? 'Automation needs plan'
                      : template.automationEnabled
                        ? 'Automation on'
                        : 'Automation off'}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Zap className="size-3.5 shrink-0" aria-hidden />
                    {template.automationPlanBlocked
                      ? 'Automation needs plan'
                      : template.automationEnabled
                        ? 'Automation on'
                        : 'Automation off'}
                  </span>
                )
              ) : null}
            </div>
            {isAutomatedEmail ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor={`template-subject-${template.templateKey}`}
                    className="text-foreground text-xs font-medium"
                  >
                    Subject
                  </label>
                  {template.subjectLocked ? (
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px] font-medium">
                      <Lock className="size-3" aria-hidden />
                      Fixed
                    </span>
                  ) : null}
                </div>
                <Input
                  id={`template-subject-${template.templateKey}`}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder={subjectPlaceholder}
                  disabled={!canEdit || template.subjectLocked}
                  className="h-10 text-sm"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="border-separator flex flex-wrap items-center gap-2 border-t px-3 py-2 sm:px-4">
          <SegmentedControl
            value={activeTab}
            onChange={handleTabChange}
            options={EDITOR_VIEW_OPTIONS}
            size="dense"
            aria-label={`${template.name} view`}
            listClassName={cn(cardHeaderSegmentedListClassName, 'shrink-0')}
            triggerClassName={cn(cardHeaderSegmentedTriggerClassName, 'px-2 sm:px-2.5')}
          />
          {canEdit ? (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="relative h-9 gap-1.5 px-2.5 before:absolute before:-inset-y-1 before:content-['']"
                onClick={() => setPlaceholdersOpen(true)}
                aria-label="Placeholders"
                title="Placeholders"
              >
                <Braces className="size-4 shrink-0" aria-hidden />
                <span className="hidden xl:inline">Placeholders</span>
              </Button>
              {isEmail ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="relative h-9 gap-1.5 px-2.5 before:absolute before:-inset-y-1 before:content-['']"
                  onClick={handleSendTest}
                  disabled={sendingTest}
                  aria-label="Send test"
                  title="Send test"
                >
                  <Send className="size-3.5 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">{sendingTest ? 'Sending…' : 'Send test'}</span>
                </Button>
              ) : null}
              {!isCustom && onReset ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="relative size-9 before:absolute before:-inset-1 before:content-['']"
                  onClick={() => setResetOpen(true)}
                  aria-label="Reset"
                  title="Reset"
                >
                  <RotateCcw className="size-4 shrink-0" aria-hidden />
                </Button>
              ) : null}
              {/* One ⋯ for the custom-template actions: four inline buttons never
               * fit beside Save on a phone. */}
              {entry.organisable || isMessage ? (
                <ResponsiveOverflowMenu
                  label={`Actions for ${template.name}`}
                  sheetTitle={template.name}
                  triggerClassName="admin-overflow-trigger shrink-0"
                  actionGroups={[
                    [
                      {
                        key: 'send',
                        label: 'Send to guest',
                        icon: <Send className="size-4" aria-hidden />,
                        /* Sending uses the saved copy, so hide it while edits are pending. */
                        disabled: hasChanges,
                        onSelect: () => setSendOpen(true),
                      },
                    ],
                    ...(entry.organisable
                      ? [
                          [
                            {
                              key: 'rename',
                              label: 'Rename',
                              icon: <Pencil className="size-4" aria-hidden />,
                              disabled: !onRename,
                              onSelect: () => onRename?.(),
                            },
                            {
                              key: 'move',
                              label: 'Move',
                              icon: <FolderInput className="size-4" aria-hidden />,
                              disabled: !onMove,
                              onSelect: () => onMove?.(),
                            },
                          ],
                          [
                            {
                              key: 'delete',
                              label: 'Delete template',
                              icon: <Trash2 className="size-4" aria-hidden />,
                              destructive: true,
                              disabled: !onDelete,
                              onSelect: () => setDeleteOpen(true),
                            },
                          ],
                        ]
                      : []),
                  ]}
                />
              ) : null}
              <Button
                type="button"
                size="sm"
                className="relative h-9 gap-1.5 px-2.5 before:absolute before:-inset-y-1 before:content-['']"
                disabled={!hasChanges || saving}
                onClick={() => {
                  if (openStarterUpgradeIfNeeded()) return;
                  void onSave({
                    content,
                    sectionImageUrl,
                    guestVisible,
                    guestPhase,
                    subject: subject.trim() || null,
                  }).catch(() => undefined);
                }}
                aria-label={saving ? 'Saving' : 'Save'}
                title={saving ? 'Saving…' : 'Save'}
              >
                <Save className="size-3.5 shrink-0" aria-hidden />
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* The pane owns the only scroll here, so the editor no longer chains into a page scrollport. */}
      <div
        data-template-pane-scroll
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col overscroll-contain p-3 sm:p-4',
          activeTab === 'preview' ? 'min-h-0 overflow-hidden' : 'overflow-y-auto',
          bottomTabBarOffsetClassName()
        )}
      >
        {activeTab === 'preview' ? (
          previewFailed ? (
            <div className="bg-muted/20 text-muted-foreground flex min-h-[200px] flex-1 flex-col items-center justify-center gap-3 rounded-lg border text-sm">
              <p>Preview did not load.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadPreview()}>
                Try again
              </Button>
            </div>
          ) : previewPending || !previewHtml ? (
            <div className="bg-muted/20 text-muted-foreground flex min-h-[200px] flex-1 items-center justify-center rounded-lg border text-sm">
              Loading preview…
            </div>
          ) : (
            <div className="bg-muted/20 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
              {previewSubject ? (
                <div className="border-border bg-card flex shrink-0 items-center gap-2 border-b px-3 py-2">
                  <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                    Subject
                  </span>
                  <span className="min-w-0 truncate text-xs">{previewSubject}</span>
                </div>
              ) : null}
              <iframe
                ref={previewIframeRef}
                title={`${template.name} preview`}
                srcDoc={previewHtml}
                className="min-h-0 w-full flex-1 border-0 bg-white"
                sandbox=""
              />
            </div>
          )
        ) : (
          <>
            {isCustom || isStandard ? (
              <div className="border-border bg-card space-y-4 rounded-xl border p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <label
                      htmlFor="template-guest-visible"
                      className="text-foreground block text-sm font-medium"
                    >
                      Show to guests
                    </label>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {isStandard
                        ? 'Shows in the stay guide.'
                        : 'Appears on the trip page and in the stay guide.'}
                    </p>
                  </div>
                  <Switch
                    id="template-guest-visible"
                    checked={guestVisible}
                    disabled={saving || !canEdit}
                    onCheckedChange={setGuestVisible}
                    aria-label="Show to guests"
                  />
                </div>
                {guestVisible && isCustom ? (
                  <div className="border-separator space-y-1.5 border-t pt-3">
                    <label
                      htmlFor="template-guest-phase"
                      className="text-foreground block text-sm font-medium"
                    >
                      When to show
                    </label>
                    <Select
                      value={guestPhase}
                      onValueChange={(value) => setGuestPhase(value as GuestTemplatePhase)}
                      disabled={saving || !canEdit}
                    >
                      <SelectTrigger id="template-guest-phase" className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="always">At every stage</SelectItem>
                        <SelectItem value="before">Before the stay</SelectItem>
                        <SelectItem value="arrival">On arrival</SelectItem>
                        <SelectItem value="stay">During the stay</SelectItem>
                        <SelectItem value="checkout">At check-out</SelectItem>
                        <SelectItem value="after">After the stay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ) : null}

            {emptyTokensInTemplate.length > 0 ? (
              <p className="text-muted-foreground text-xs leading-snug">
                Not set for this property:{' '}
                {emptyTokensInTemplate.map((key) => `{{${key}}}`).join(', ')}
              </p>
            ) : null}

            {allowSectionImage ? (
              <TemplateSectionImageField
                templateKey={template.templateKey}
                imageUrl={sectionImageUrl}
                previewBust={sectionImagePreviewBust}
                disabled={saving}
                onImageUrlChange={handleSectionImageUrlChange}
              />
            ) : null}
            <RichTextEditor
              ref={editorRef}
              content={content}
              onChange={setContent}
              fill
              minHeight="clamp(240px, 46dvh, 520px)"
              validPlaceholderKeys={validPlaceholderKeys}
              onImageUpload={isStandard ? handleInlineImageUpload : undefined}
            />
          </>
        )}
      </div>

      <PropertyTemplatePlaceholdersDialog
        open={placeholdersOpen}
        onOpenChange={setPlaceholdersOpen}
        lines={placeholderLines}
        sampleVars={PROPERTY_TEMPLATE_SAMPLE_VARS}
        onInsertToken={handleInsertPlaceholder}
      />

      {isCustom || isMessage ? (
        <SendCustomTemplateDialog
          templateKey={template.templateKey}
          templateName={template.name}
          open={sendOpen}
          onOpenChange={setSendOpen}
        />
      ) : null}

      <ResponsiveModal
        open={resetOpen}
        onOpenChange={(open) => {
          setResetOpen(open);
          if (!open) {
            window.requestAnimationFrame(() => {
              document.body.style.removeProperty('pointer-events');
            });
          }
        }}
      >
        <ResponsiveModalContent className="sm:max-w-[28rem]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Reset to default?</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              Your saved copy will be replaced with the original default text.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ResponsiveModalFooter className="gap-1">
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => {
                setResetOpen(false);
                void (async () => {
                  try {
                    await onReset?.();
                    setContent(template.defaultContent);
                    handleSectionImageUrlChange(null);
                  } catch {
                    /* OTP cancelled or save failed — keep the draft. */
                  }
                })();
              }}
            >
              Reset
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            window.requestAnimationFrame(() => {
              document.body.style.removeProperty('pointer-events');
            });
          }
        }}
      >
        <ResponsiveModalContent className="sm:max-w-[28rem]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Delete template?</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <ResponsiveModalFooter className="gap-1">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDeleteOpen(false);
                void onDelete?.();
              }}
            >
              Delete
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}
