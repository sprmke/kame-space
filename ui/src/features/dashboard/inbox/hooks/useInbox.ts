import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import {
  completeMetaOAuthPage,
  disconnectMetaInbox,
  fetchInboxAutomationSettings,
  fetchInboxConnections,
  fetchInboxMessages,
  fetchInboxTemplates,
  fetchInboxThreads,
  fetchMetaOAuthPages,
  listChatTemplates,
  markInboxConversationRead,
  patchInboxAutomationSettings,
  resolveGuestRequest as resolveGuestRequestApi,
  resubscribeMetaInbox,
  saveInboxTemplate,
  deleteInboxTemplate,
  editInboxMessage,
  inboxSendBody,
  inboxSendUrl,
  sendInboxReply,
  unsendInboxMessage,
  startMetaInboxOAuth,
  suggestInboxAiReply,
  requestMetaInboxSync,
  fetchInboxThreadDelta,
  fetchInboxMessageDelta,
  type InboxApiScope,
} from '@/features/dashboard/inbox/lib/inboxApi';
import { uploadInboxChatAttachment } from '@/features/dashboard/inbox/lib/inboxChatAttachment';
import { handleFeatureUnavailableMutationError } from '@/lib/featureAvailability/featureUnavailableError';
import { isInboxMockMode } from '@/features/dashboard/inbox/lib/inboxMockMode';
import {
  mockAiSuggest,
  mockConnectMeta,
  mockDeleteTemplate,
  mockDisconnectMeta,
  mockFetchAutomation,
  mockFetchChatTemplates,
  mockFetchConnections,
  mockFetchMessages,
  mockFetchTemplates,
  mockFetchThreads,
  mockMarkRead,
  mockPatchAutomation,
  mockSaveTemplate,
  mockSendReply,
  resetInboxMockStore,
} from '@/features/dashboard/inbox/lib/inboxMockStore';
import { inboxFiltersBlockMetaScrollSync } from '@/features/dashboard/inbox/lib/inboxThreadPagination';
import type {
  ChatTemplateListItem,
  InboxConversation,
  InboxMessage,
  SaveInboxTemplatePayload,
  ThreadPlatformFilter,
  ThreadStatusFilter,
} from '@/features/dashboard/inbox/types/inbox';

import {
  markDirectionMessagesDeliveredInCache,
  markDirectionMessagesReadInCache,
} from '@/lib/chat/chatMessageCache';
import { useChatReadReceiptSync } from '@/lib/chat/useChatReadReceiptSync';
import { runOfflineMutation } from '@/lib/pwa/offlineMutation';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

export const INBOX_THREADS_KEY = 'inbox-threads';
export const INBOX_MESSAGES_KEY = 'inbox-messages';
export const INBOX_CONNECTIONS_KEY = 'inbox-connections';
export const INBOX_TEMPLATES_KEY = 'inbox-templates';
export const INBOX_CHAT_TEMPLATES_KEY = 'inbox-chat-templates';
export const INBOX_SETTINGS_KEY = 'inbox-settings';
export const INBOX_SYNC_STATUS_KEY = 'inbox-sync-status';
export const META_OAUTH_PAGES_KEY = 'meta-oauth-pages';

type InboxThreadsPage = {
  conversations: InboxConversation[];
  nextCursor: string | null;
  metaHasMore: boolean;
  /**
   * False when the caller has no org-wide inbox Realtime, so the list has to poll to stay
   * live. Removed once the inbox moves to Broadcast plus a delta fetch.
   */
  realtimeSupported?: boolean;
};

const REALTIME_INVALIDATE_MS = 400;

/**
 * Poll interval for a caller without org-wide inbox Realtime.
 *
 * Removed once the inbox moves to Broadcast plus a delta fetch.
 */
const INBOX_FALLBACK_POLL_MS = 60_000;

function emptyInboxThreadsData(): InfiniteData<InboxThreadsPage> {
  return {
    pages: [{ conversations: [], nextCursor: null, metaHasMore: false }],
    pageParams: [null],
  };
}

function clearInboxThreadCaches(qc: QueryClient) {
  if (threadsInvalidateTimer) {
    clearTimeout(threadsInvalidateTimer);
    threadsInvalidateTimer = null;
  }
  if (inboxInvalidateTimer) {
    clearTimeout(inboxInvalidateTimer);
    inboxInvalidateTimer = null;
  }
  void qc.cancelQueries({ queryKey: [INBOX_THREADS_KEY] });
  void qc.cancelQueries({ queryKey: [INBOX_MESSAGES_KEY] });
  qc.setQueriesData<InfiniteData<InboxThreadsPage>>(
    { queryKey: [INBOX_THREADS_KEY] },
    emptyInboxThreadsData()
  );
  void qc.removeQueries({ queryKey: [INBOX_MESSAGES_KEY] });
}

let threadsInvalidateTimer: ReturnType<typeof setTimeout> | null = null;
let inboxInvalidateTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleThreadsInvalidate(qc: QueryClient) {
  if (threadsInvalidateTimer) clearTimeout(threadsInvalidateTimer);
  threadsInvalidateTimer = setTimeout(() => {
    threadsInvalidateTimer = null;
    void qc.invalidateQueries({ queryKey: [INBOX_THREADS_KEY] });
  }, REALTIME_INVALIDATE_MS);
}

const mockMode = isInboxMockMode();

if (mockMode) {
  resetInboxMockStore();
}

function inboxScopeKey(scope?: InboxApiScope | null): [string | null, string | null] {
  return [scope?.propertyId ?? null, scope?.parkingId ?? null];
}

function inboxMessagesQueryKey(conversationId: string, scope?: InboxApiScope | null) {
  return [INBOX_MESSAGES_KEY, conversationId, ...inboxScopeKey(scope), mockMode] as const;
}

function patchConversationIdentityInThreadsCache(qc: QueryClient, conversation: InboxConversation) {
  const name = conversation.participant_name?.trim();
  const avatar = conversation.participant_avatar_url?.trim();
  if (!name && !avatar) return;

  qc.setQueriesData<InfiniteData<InboxThreadsPage>>({ queryKey: [INBOX_THREADS_KEY] }, (old) => {
    if (!old?.pages) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        conversations: page.conversations.map((c) => {
          if (c.id !== conversation.id) return c;
          return {
            ...c,
            participant_name: name || c.participant_name,
            participant_avatar_url: avatar || c.participant_avatar_url,
          };
        }),
      })),
    };
  });
}

export function useInboxMockActive(): boolean {
  return mockMode;
}

export function useInboxConnections(
  orgSlug: string | null,
  orgId: string | null,
  scope?: InboxApiScope | null
) {
  return useQuery({
    queryKey: [INBOX_CONNECTIONS_KEY, orgSlug, orgId, ...inboxScopeKey(scope), mockMode],
    queryFn: () =>
      mockMode ? mockFetchConnections() : fetchInboxConnections(orgSlug, orgId, scope),
    enabled: mockMode || !!(orgSlug || orgId),
    refetchInterval: (query) => {
      if (mockMode) return false;
      return query.state.data?.metaSyncInProgress ? 5000 : false;
    },
  });
}

const metaSyncAbortByOrg = new Map<string, AbortController>();

/**
 * Ask the server to sync this inbox.
 *
 * The import used to run in the browser, one chunk per scroll, so closing the tab stopped
 * it. The cursor and schedule are server state now: this only nudges a check when the inbox
 * opens or regains focus, and keeps the connection status fresh while an import runs.
 */
export function useMetaInboxSync(
  orgSlug: string | null,
  orgId: string | null,
  metaSyncInProgress: boolean,
  scope?: InboxApiScope | null,
  /** When false, skip syncing (feature availability `inbox.meta.sync` off). */
  syncEnabled = true
): { active: boolean } {
  const qc = useQueryClient();

  useEffect(() => {
    if (mockMode || !orgId || !orgSlug || !syncEnabled) return;
    void requestMetaInboxSync(orgSlug, orgId, 'check_now', scope).catch(() => undefined);
  }, [orgId, orgSlug, scope?.propertyId, scope?.parkingId, syncEnabled]);

  useEffect(() => {
    if (mockMode || !orgId || !orgSlug || !syncEnabled) return;
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      void requestMetaInboxSync(orgSlug, orgId, 'check_now', scope).catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [orgId, orgSlug, scope?.propertyId, scope?.parkingId, syncEnabled]);

  // While the server reports an import in progress, refresh the connection counters.
  useEffect(() => {
    if (mockMode || !metaSyncInProgress) return;
    const timer = setInterval(() => {
      void qc.invalidateQueries({ queryKey: [INBOX_CONNECTIONS_KEY] });
      void qc.invalidateQueries({ queryKey: [INBOX_THREADS_KEY] });
    }, 5_000);
    return () => clearInterval(timer);
  }, [metaSyncInProgress, qc]);

  return { active: metaSyncInProgress && syncEnabled };
}

/** Browser reachability, without a dependency. */
function useBrowserOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('online', onChange);
      window.addEventListener('offline', onChange);
      return () => {
        window.removeEventListener('online', onChange);
        window.removeEventListener('offline', onChange);
      };
    },
    () => (typeof navigator === 'undefined' ? true : navigator.onLine),
    () => true
  );
}

export type MetaInboxSyncStatusData = {
  connected: boolean;
  status: string;
  importComplete: boolean;
  importRunning: boolean;
  conversationsImported: number;
  lastCheckedAt: string | null;
  consecutiveFailures: number;
  lastErrorCode: string | null;
  syncPaused: boolean;
};

/**
 * Server-side sync status for the header pill.
 *
 * Polled once a minute while the tab is visible. The server owns the schedule, so this is a
 * read, not a nudge.
 */
export function useMetaInboxSyncStatus(
  orgSlug: string | null,
  orgId: string | null,
  scope?: InboxApiScope | null,
  enabled = true
) {
  const query = useQuery({
    queryKey: [INBOX_SYNC_STATUS_KEY, orgSlug, orgId, ...inboxScopeKey(scope), mockMode],
    queryFn: async (): Promise<MetaInboxSyncStatusData | null> => {
      if (mockMode) return null;
      const payload = (await requestMetaInboxSync(
        orgSlug,
        orgId,
        'status',
        scope
      )) as unknown as MetaInboxSyncStatusData & { connected?: boolean };
      if (!payload || typeof payload !== 'object') return null;
      return {
        connected: payload.connected !== false,
        status: String(payload.status ?? 'unknown'),
        importComplete: Boolean(payload.importComplete),
        importRunning: Boolean(payload.importRunning),
        conversationsImported: Number(payload.conversationsImported ?? 0),
        lastCheckedAt: (payload.lastCheckedAt as string | null) ?? null,
        consecutiveFailures: Number(payload.consecutiveFailures ?? 0),
        lastErrorCode: (payload.lastErrorCode as string | null) ?? null,
        syncPaused: Boolean(payload.syncPaused),
      };
    },
    enabled: enabled && !mockMode && !!(orgSlug || orgId),
    refetchInterval: (q) => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return false;
      return q.state.data?.connected === false ? 30_000 : 60_000;
    },
    refetchOnWindowFocus: true,
  });

  return { data: query.data ?? null, online: useBrowserOnline() };
}

export function useInboxMutations(
  orgSlug: string | null,
  orgId: string | null,
  scope?: InboxApiScope | null
) {
  const qc = useQueryClient();

  const onFeatureUnavailableError = (error: unknown) => {
    handleFeatureUnavailableMutationError(error, qc);
  };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: [INBOX_CONNECTIONS_KEY] });
    void qc.invalidateQueries({ queryKey: [INBOX_THREADS_KEY] });
    void qc.invalidateQueries({ queryKey: [INBOX_MESSAGES_KEY] });
  };

  const connectMeta = useMutation({
    mutationFn: (returnPath: string) =>
      mockMode ? mockConnectMeta() : startMetaInboxOAuth(orgSlug, orgId, returnPath, scope),
    onSuccess: (url) => {
      if (!mockMode) window.location.href = url;
      else invalidate();
    },
    onError: onFeatureUnavailableError,
  });

  const disconnectMeta = useMutation({
    mutationFn: () =>
      mockMode ? mockDisconnectMeta() : disconnectMetaInbox(orgSlug, orgId, 'meta', scope),
    onMutate: async () => {
      if (orgId) {
        metaSyncAbortByOrg.get(orgId)?.abort();
        metaSyncAbortByOrg.delete(orgId);
      }
      clearInboxThreadCaches(qc);
    },
    onSuccess: () => {
      clearInboxThreadCaches(qc);
      void qc.invalidateQueries({ queryKey: [INBOX_CONNECTIONS_KEY] });
      void qc.invalidateQueries({ queryKey: [INBOX_THREADS_KEY] });
      void qc.invalidateQueries({ queryKey: [INBOX_MESSAGES_KEY] });
    },
    onError: onFeatureUnavailableError,
  });

  const resubscribeMeta = useMutation({
    mutationFn: () =>
      mockMode
        ? Promise.resolve({ verified: true, resubscribed: true })
        : resubscribeMetaInbox(orgSlug, orgId, scope),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [INBOX_CONNECTIONS_KEY] });
    },
    onError: onFeatureUnavailableError,
  });

  const sendReply = useMutation({
    mutationFn: async (opts: {
      conversationId: string;
      text: string;
      replyToMessageId?: string;
      useHumanAgentTag?: boolean;
      attachments?: Array<{ kind: 'image' | 'file'; url: string; label?: string }>;
      templateKey?: string;
      bookingId?: string | null;
      aiDrafted?: boolean;
    }) => {
      if (mockMode) {
        await mockSendReply(opts.conversationId, opts.text, opts.templateKey);
        return undefined;
      }
      // Template replies need the server renderer, so they never go through the
      // text-only offline outbox.
      // Text-only replies survive going offline via the durable outbox; replies
      // with attachments need an online upload first, so stay online-only.
      if (!opts.attachments?.length && !opts.templateKey) {
        await runOfflineMutation(
          {
            kind: 'inbox-reply',
            label: 'Reply to a guest message',
            url: inboxSendUrl(orgSlug, orgId, scope),
            body: inboxSendBody(opts, scope),
            invalidateKeys: [INBOX_MESSAGES_KEY, INBOX_THREADS_KEY],
          },
          qc
        );
        return undefined;
      }
      return sendInboxReply(orgSlug, orgId, opts.conversationId, opts.text, {
        replyToMessageId: opts.replyToMessageId,
        useHumanAgentTag: opts.useHumanAgentTag,
        attachments: opts.attachments,
        templateKey: opts.templateKey,
        bookingId: opts.bookingId,
        aiDrafted: opts.aiDrafted,
        scope,
      });
    },
    onMutate: async (vars) => {
      if (vars.templateKey) return { prev: undefined };
      const msgKey = inboxMessagesQueryKey(vars.conversationId, scope);
      await qc.cancelQueries({ queryKey: msgKey });
      const prev = qc.getQueryData<{
        pages: Array<{ messages: unknown[]; conversation: unknown }>;
      }>(msgKey);
      if (prev?.pages?.length && !mockMode) {
        const lastPage = prev.pages[prev.pages.length - 1];
        qc.setQueryData(msgKey, {
          ...prev,
          pages: [
            ...prev.pages.slice(0, -1),
            {
              ...lastPage,
              messages: [
                ...lastPage.messages,
                {
                  id: `optimistic-${Date.now()}`,
                  conversation_id: vars.conversationId,
                  direction: 'outbound',
                  body_text: vars.text,
                  attachments: vars.attachments ?? [],
                  sent_at: new Date().toISOString(),
                  delivery_status: 'sending',
                  is_ai_generated: false,
                },
              ],
            },
          ],
        });
      }
      return { prev };
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prev && !mockMode) {
        qc.setQueryData(inboxMessagesQueryKey(vars.conversationId, scope), ctx.prev);
      }
      onFeatureUnavailableError(err);
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: inboxMessagesQueryKey(vars.conversationId, scope) });
      scheduleThreadsInvalidate(qc);
    },
  });

  const uploadAttachment = useMutation({
    mutationFn: (opts: { conversationId: string; file: File }) =>
      mockMode
        ? Promise.reject(new Error('Upload not available in preview mode'))
        : uploadInboxChatAttachment(orgSlug, orgId, opts.conversationId, opts.file, scope),
  });

  const aiSuggest = useMutation({
    mutationFn: (conversationId: string) =>
      mockMode
        ? mockAiSuggest(conversationId)
        : suggestInboxAiReply(orgSlug, orgId, conversationId, scope),
    onError: onFeatureUnavailableError,
  });

  const editMessage = useMutation({
    mutationFn: (opts: { conversationId: string; messageId: string; text: string }) =>
      mockMode
        ? Promise.reject(new Error('Edit not available in preview mode'))
        : editInboxMessage(orgSlug, orgId, opts.conversationId, opts.messageId, opts.text, scope),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: inboxMessagesQueryKey(vars.conversationId, scope) });
      scheduleThreadsInvalidate(qc);
    },
    onError: onFeatureUnavailableError,
  });

  const unsendMessage = useMutation({
    mutationFn: (opts: { conversationId: string; messageId: string }) =>
      mockMode
        ? Promise.reject(new Error('Unsend not available in preview mode'))
        : unsendInboxMessage(orgSlug, orgId, opts.conversationId, opts.messageId, scope),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: inboxMessagesQueryKey(vars.conversationId, scope) });
      scheduleThreadsInvalidate(qc);
    },
    onError: onFeatureUnavailableError,
  });

  const resolveGuestRequestMutation = useMutation({
    mutationFn: (opts: {
      conversationId: string;
      requestId: string;
      status: 'approved' | 'declined';
    }) =>
      mockMode
        ? Promise.reject(new Error('Not available in preview mode'))
        : resolveGuestRequestApi(
            orgSlug,
            orgId,
            opts.conversationId,
            opts.requestId,
            opts.status,
            scope
          ),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: inboxMessagesQueryKey(vars.conversationId, scope) });
    },
    onError: onFeatureUnavailableError,
  });

  return {
    connectMeta,
    disconnectMeta,
    resubscribeMeta,
    sendReply,
    uploadAttachment,
    editMessage,
    unsendMessage,
    aiSuggest,
    resolveGuestRequest: resolveGuestRequestMutation,
  };
}

export function useMetaOAuthPagePicker(
  orgSlug: string | null,
  orgId: string | null,
  pickerState: string | null,
  scope?: InboxApiScope | null
) {
  const qc = useQueryClient();

  const pagesQuery = useQuery({
    queryKey: [
      META_OAUTH_PAGES_KEY,
      orgSlug,
      orgId,
      pickerState,
      ...inboxScopeKey(scope),
      mockMode,
    ],
    queryFn: () => fetchMetaOAuthPages(orgSlug, orgId, pickerState!),
    enabled: !mockMode && !!(orgSlug || orgId) && !!pickerState,
    retry: false,
  });

  const complete = useMutation({
    mutationFn: (pageId: string) =>
      completeMetaOAuthPage(orgSlug, orgId, pickerState!, pageId, scope),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [INBOX_CONNECTIONS_KEY] });
      void qc.invalidateQueries({ queryKey: [INBOX_THREADS_KEY] });
    },
  });

  return { pagesQuery, complete };
}

export function useInboxThreads(
  orgSlug: string | null,
  orgId: string | null,
  filters: {
    status: ThreadStatusFilter;
    platform: ThreadPlatformFilter;
    search: string;
  },
  scope?: InboxApiScope | null
) {
  const qc = useQueryClient();
  const queryKey = [INBOX_THREADS_KEY, orgSlug, orgId, ...inboxScopeKey(scope), filters, mockMode];
  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }): Promise<InboxThreadsPage> => {
      if (mockMode) {
        return mockFetchThreads(filters);
      }

      // The server owns the Meta import, so a page is only ever a read of threads we have.
      const list = await fetchInboxThreads(
        orgSlug,
        orgId,
        { ...filters, cursor: typeof pageParam === 'string' ? pageParam : null },
        scope
      );
      return list;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last): string | undefined => {
      return last.nextCursor ?? undefined;
    },
    enabled: mockMode || !!(orgSlug || orgId),
    // The app-wide default is off, but the inbox is the surface where a stale list is
    // most visible: coming back to the tab should show what arrived while it was away.
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      if (mockMode) return false;
      const firstPage = query.state.data?.pages?.[0];
      // A property-level member has `inbox:view` but no org-wide Realtime, so their list
      // polls instead. Phase 4 replaces this with Broadcast plus a delta fetch.
      if (firstPage?.realtimeSupported !== false) return false;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return false;
      return INBOX_FALLBACK_POLL_MS;
    },
    retry: 1,
  });

  const [loadingOlderFromMeta, setLoadingOlderFromMeta] = useState(false);

  const canLoadOlderFromMeta =
    !mockMode &&
    !inboxFiltersBlockMetaScrollSync(filters) &&
    !!query.data?.pages.length &&
    !query.hasNextPage &&
    !loadingOlderFromMeta &&
    !!query.data.pages[query.data.pages.length - 1]?.metaHasMore;

  const loadOlderFromMeta = useCallback(async () => {
    if (!canLoadOlderFromMeta || loadingOlderFromMeta) return;
    setLoadingOlderFromMeta(true);
    try {
      // One more page of older chats, imported on the server. The list is refetched rather
      // than patched, because the import may have created threads above the current page.
      await requestMetaInboxSync(orgSlug, orgId, 'load_older', scope);
      void qc.invalidateQueries({ queryKey: [INBOX_CONNECTIONS_KEY] });
      void qc.invalidateQueries({ queryKey: [INBOX_THREADS_KEY] });
    } finally {
      setLoadingOlderFromMeta(false);
    }
  }, [
    canLoadOlderFromMeta,
    filters,
    loadingOlderFromMeta,
    orgId,
    orgSlug,
    qc,
    query.data?.pages,
    queryKey,
    scope,
  ]);

  return {
    ...query,
    canLoadOlderFromMeta,
    loadOlderFromMeta,
    loadingOlderFromMeta,
  };
}

export function useInboxMessages(
  orgSlug: string | null,
  orgId: string | null,
  conversationId: string | null,
  scope?: InboxApiScope | null
) {
  const qc = useQueryClient();
  const scopePropertyId = scope?.propertyId ?? null;
  const scopeParkingId = scope?.parkingId ?? null;
  const msgKey = useMemo(
    () => (conversationId ? inboxMessagesQueryKey(conversationId, scope) : null),
    [conversationId, scopePropertyId, scopeParkingId]
  );
  const query = useInfiniteQuery({
    queryKey: msgKey ?? [INBOX_MESSAGES_KEY, null, ...inboxScopeKey(scope), mockMode],
    queryFn: ({ pageParam }) =>
      mockMode
        ? mockFetchMessages(conversationId!)
        : fetchInboxMessages(orgSlug, orgId, conversationId!, pageParam, scope),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.hasMore && last.messages.length > 0 ? last.messages[0]?.sent_at : undefined,
    enabled: (mockMode || !!(orgSlug || orgId)) && !!conversationId,
    refetchOnWindowFocus: true,
  });

  const applyGuestReadToCache = useCallback(
    (readAt: string) => {
      if (!conversationId || !msgKey) return;
      markDirectionMessagesReadInCache(qc, msgKey, 'outbound', readAt);
    },
    [conversationId, msgKey, qc]
  );

  const applyGuestDeliveredToCache = useCallback(() => {
    if (!conversationId || !msgKey) return;
    markDirectionMessagesDeliveredInCache(qc, msgKey, 'outbound');
  }, [conversationId, msgKey, qc]);

  const { notifyPeerRead } = useChatReadReceiptSync(
    conversationId,
    'host',
    applyGuestReadToCache,
    applyGuestDeliveredToCache,
    !mockMode && !!conversationId
  );

  const filledConversation = query.data?.pages[0]?.conversation;
  useEffect(() => {
    if (!filledConversation) return;
    patchConversationIdentityInThreadsCache(qc, filledConversation);
  }, [filledConversation, qc]);

  useEffect(() => {
    if (!conversationId) return;
    if (mockMode) {
      void mockMarkRead(conversationId).then(() => {
        scheduleThreadsInvalidate(qc);
      });
      return;
    }
    if (!orgId) return;
    void markInboxConversationRead(orgSlug, orgId, conversationId, scope).then(async () => {
      await notifyPeerRead();
      scheduleThreadsInvalidate(qc);
    });
  }, [conversationId, orgId, orgSlug, scopePropertyId, scopeParkingId, notifyPeerRead, qc]);

  return query;
}

/** A signal from the org Broadcast topic. Ids only, never a name or a message body. */
type InboxBroadcastSignal = {
  v?: number;
  kind?: string;
  conversation_id?: string | null;
  connection_id?: string | null;
  platform?: string | null;
  property_id?: string | null;
  parking_id?: string | null;
  at?: string;
};

/** Patch changed thread rows in place, and add a brand new thread at the top. */
function mergeThreadRowsIntoCache(qc: QueryClient, rows: InboxConversation[]) {
  if (!rows.length) return;
  const byId = new Map(rows.map((row) => [row.id, row]));
  qc.setQueriesData<InfiniteData<InboxThreadsPage>>({ queryKey: [INBOX_THREADS_KEY] }, (old) => {
    if (!old?.pages?.length) return old;
    const seen = new Set<string>();
    const pages = old.pages.map((page) => ({
      ...page,
      conversations: page.conversations.map((conversation) => {
        seen.add(conversation.id);
        return byId.get(conversation.id) ?? conversation;
      }),
    }));
    const fresh = rows.filter((row) => !seen.has(row.id) && !row.id.startsWith('mock-'));
    if (fresh.length) {
      pages[0] = {
        ...pages[0]!,
        conversations: [...fresh, ...pages[0]!.conversations].sort((a, b) =>
          (b.last_message_at ?? '').localeCompare(a.last_message_at ?? '')
        ),
      };
    }
    return { ...old, pages };
  });
}

/** Patch changed messages in the open thread, keeping send order. */
function mergeMessageRowsIntoCache(
  qc: QueryClient,
  msgKey: readonly unknown[],
  rows: InboxMessage[]
) {
  if (!rows.length) return false;
  let patched = false;
  qc.setQueryData<InfiniteData<{ messages: InboxMessage[] }>>(msgKey, (old) => {
    if (!old?.pages?.length) return old;
    const byId = new Map(rows.map((row) => [row.id, row]));
    const pages = old.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) => byId.get(message.id) ?? message),
    }));
    const existing = new Set(pages.flatMap((page) => page.messages.map((message) => message.id)));
    const fresh = rows.filter((row) => !existing.has(row.id));
    if (fresh.length) {
      pages[0] = {
        ...pages[0]!,
        messages: [...pages[0]!.messages, ...fresh].sort((a, b) =>
          (a.sent_at ?? '').localeCompare(b.sent_at ?? '')
        ),
      };
    }
    patched = true;
    return { ...old, pages };
  });
  return patched;
}

const INBOX_DELTA_DEBOUNCE_MS = 250;
const INBOX_SAFETY_DELTA_MS = 5 * 60_000;
const INBOX_DEGRADE_POLL_MS = 30_000;
const INBOX_CHANNEL_ERROR_WINDOW_MS = 5 * 60_000;

/**
 * One private Broadcast channel per tab, plus a delta fetch on catch-up.
 *
 * Postgres Changes was 84% of database time and only admitted the org owner and org ADMIN
 * members, so a property-level member watched a frozen list. This subscribes to
 * `inbox:org:<id>`, patches from a small delta call, and catches up after a drop, a wake or
 * a reconnect. Three channel errors in five minutes degrade to a 30-second delta poll.
 */
export function useInboxRealtime(
  orgId: string | null,
  openConversationId?: string | null,
  scope?: InboxApiScope | null
) {
  const qc = useQueryClient();
  const scopePropertyId = scope?.propertyId ?? null;
  const scopeParkingId = scope?.parkingId ?? null;

  // Refs so the channel subscription is created once per org, not once per open thread.
  const openConversationIdRef = useRef<string | null>(openConversationId ?? null);
  openConversationIdRef.current = openConversationId ?? null;
  const scopeRef = useRef({ propertyId: scopePropertyId, parkingId: scopeParkingId });
  scopeRef.current = { propertyId: scopePropertyId, parkingId: scopeParkingId };

  useEffect(() => {
    if (mockMode || !orgId) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cursor = new Date().toISOString();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let safetyTimer: ReturnType<typeof setInterval> | null = null;
    let degradeTimer: ReturnType<typeof setInterval> | null = null;
    let errorTimestamps: number[] = [];

    const currentScope = () => scopeRef.current;

    const runDelta = async () => {
      if (cancelled) return;
      const since = cursor;
      try {
        const delta = await fetchInboxThreadDelta(null, orgId, since, currentScope());
        cursor = delta.serverTime;
        mergeThreadRowsIntoCache(qc, delta.conversations);

        // Foreground signal only. The OS notification comes from the push pipeline, so
        // there is exactly one system notification per message.
        if (document.visibilityState === 'visible') {
          const waiting = delta.conversations.find(
            (row) => row.reply_status === 'pending' && (row.unread_count ?? 0) > 0
          );
          if (waiting) {
            toast.message('New guest message', {
              description:
                waiting.subject_preview?.trim().slice(0, 120) ||
                waiting.participant_name?.trim() ||
                'New message',
            });
          }
        }

        const openId = openConversationIdRef.current;
        const openChanged = Boolean(openId && delta.conversations.some((row) => row.id === openId));
        if (openId && openChanged) {
          const msgKey = inboxMessagesQueryKey(openId, currentScope());
          const messages = await fetchInboxMessageDelta(null, orgId, openId, since, currentScope());
          if (!mergeMessageRowsIntoCache(qc, msgKey, messages.messages)) {
            void qc.invalidateQueries({ queryKey: msgKey });
          }
        }
      } catch {
        // A failed delta is retried by the next signal or the safety tick.
      }
    };

    const scheduleDelta = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void runDelta();
      }, INBOX_DELTA_DEBOUNCE_MS);
    };

    const startDegradePoll = () => {
      if (degradeTimer) return;
      degradeTimer = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        scheduleDelta();
      }, INBOX_DEGRADE_POLL_MS);
    };

    const stopDegradePoll = () => {
      if (!degradeTimer) return;
      clearInterval(degradeTimer);
      degradeTimer = null;
    };

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) return;
      await supabase.realtime.setAuth(token);

      channel = supabase
        .channel(`inbox:org:${orgId}`, { config: { private: true } })
        .on('broadcast', { event: 'inbox' }, (payload) => {
          const signal = (payload ?? {}) as InboxBroadcastSignal;
          // Signals outside this tab's scope are ignored, so a property inbox does not
          // react to another property's traffic.
          const { propertyId, parkingId } = currentScope();
          if (signal.property_id && propertyId && signal.property_id !== propertyId) return;
          if (signal.parking_id && parkingId && signal.parking_id !== parkingId) return;
          scheduleDelta();
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            const now = Date.now();
            errorTimestamps = [...errorTimestamps, now].filter(
              (at) => now - at < INBOX_CHANNEL_ERROR_WINDOW_MS
            );
            if (errorTimestamps.length >= 3) startDegradePoll();
            return;
          }
          if (status !== 'SUBSCRIBED') return;
          stopDegradePoll();
          errorTimestamps = [];
          // Whatever arrived while the socket was down was never delivered.
          void runDelta();
        });

      if (cancelled && channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    })();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void runDelta();
    };
    const onOnline = () => void runDelta();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    safetyTimer = setInterval(() => {
      if (document.visibilityState === 'visible') void runDelta();
    }, INBOX_SAFETY_DELTA_MS);

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (safetyTimer) clearInterval(safetyTimer);
      if (degradeTimer) clearInterval(degradeTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [orgId, qc]);
}

export function useChatTemplates(
  orgSlug: string | null,
  orgId: string | null,
  scope?: InboxApiScope | null,
  enabled = true
) {
  return useQuery({
    queryKey: [INBOX_CHAT_TEMPLATES_KEY, orgSlug, orgId, ...inboxScopeKey(scope), mockMode],
    queryFn: (): Promise<ChatTemplateListItem[]> =>
      mockMode ? mockFetchChatTemplates() : listChatTemplates(orgSlug, orgId, scope),
    enabled: enabled && (mockMode || (!!(orgSlug || orgId) && !!scope?.propertyId)),
    retry: false,
    staleTime: 60_000,
  });
}

export function useInboxTemplates(
  orgSlug: string | null,
  orgId: string | null,
  scope?: InboxApiScope | null,
  enabled = true
) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: [INBOX_TEMPLATES_KEY, orgSlug, orgId, ...inboxScopeKey(scope), mockMode],
    queryFn: () => (mockMode ? mockFetchTemplates() : fetchInboxTemplates(orgSlug, orgId, scope)),
    enabled: enabled && (mockMode || !!(orgSlug || orgId)),
  });

  const save = useMutation({
    mutationFn: (payload: SaveInboxTemplatePayload) =>
      mockMode ? mockSaveTemplate(payload) : saveInboxTemplate(orgSlug, orgId, payload, scope),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [INBOX_TEMPLATES_KEY] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      mockMode ? mockDeleteTemplate(id) : deleteInboxTemplate(orgSlug, orgId, id, scope),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [INBOX_TEMPLATES_KEY] }),
  });

  return { ...query, save, remove };
}

export function useInboxAutomationSettings(
  orgSlug: string | null,
  orgId: string | null,
  scope?: InboxApiScope | null,
  enabled = true
) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: [INBOX_SETTINGS_KEY, orgSlug, orgId, ...inboxScopeKey(scope), mockMode],
    queryFn: () =>
      mockMode ? mockFetchAutomation() : fetchInboxAutomationSettings(orgSlug, orgId, scope),
    enabled: enabled && (mockMode || !!(orgSlug || orgId)),
  });

  const patch = useMutation({
    mutationFn: (patch: Parameters<typeof patchInboxAutomationSettings>[2]) =>
      mockMode
        ? mockPatchAutomation(patch)
        : patchInboxAutomationSettings(orgSlug, orgId, patch, scope),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [INBOX_SETTINGS_KEY] }),
  });

  return { ...query, patch };
}
