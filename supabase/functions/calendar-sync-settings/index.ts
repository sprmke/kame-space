/**
 * calendar-sync-settings — property Channel sync config (Pricing → Channel sync modal).
 * Plan: docs/workflow/done/airbnb-calendar-sync.md §10
 *
 * GET   ?property=<id|slug>  → { feeds[], export{}, recentEvents[], connectableProviders[] }   (pricing.channels:view)
 * PATCH { action, ... }                                                 (pricing.channels:edit + calendarSync plan)
 *   addFeed         { provider?: connectable provider, label?, icsUrl, createBookings? }
 *   updateFeed      { feedId, label?, icsUrl?, isActive?, createBookings? }
 *   removeFeed      { feedId, deleteData?: boolean }
 *   setExportEnabled { enabled: boolean }
 *   syncNow         { feedId }
 *
 * addFeed also turns date sharing on (when it is off and not paused), so every channel is two-way
 * (it gets our dates, we get its dates) without a second step.
 * New Airbnb feeds create booking rows by default (`create_bookings = true`). Existing
 * feeds keep their stored value until the host flips the toggle.
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  assertExternalIcsUrlShape,
  ExternalFetchError,
  normalizeExternalIcsUrl,
  type CalendarFeedProvider,
} from '../_shared/calendarSyncService.ts';
import { loadCalendarFeed, recordFeedRun, runFeedSync } from '../_shared/calendarSyncRun.ts';
import {
  CALENDAR_FEED_LIMIT,
  calendarChannel,
  isCalendarProvider,
} from '../_shared/calendarChannels.ts';
import { connectableProvidersFor } from '../_shared/calendarChannelRollout.ts';
import { checkAddFeed } from '../_shared/calendarFeedAdd.ts';
import { enableExportOnConnect } from '../_shared/calendarExportEnable.ts';
import type { RunFeedResult } from '../_shared/calendarSyncRun.ts';
import {
  buildCalendarExportUrls,
  resolvePublicExportOrigin,
} from '../_shared/calendarExportUrls.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { decryptIntegrationSecret, encryptIntegrationSecret } from '../_shared/secretsCrypto.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';
import { buildActorContext } from '../_shared/activityLog.ts';
import { featureUnavailableResponse } from '../_shared/featureAvailability.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FEED_COLUMNS =
  'id, property_id, provider, label, is_active, create_bookings, last_attempted_at, last_success_at, last_error, consecutive_failures, echo_warning_at, export_never_read_at, created_at';

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.length > 8 ? '…' + u.pathname.slice(-6) : u.pathname;
    return `${u.protocol}//${u.hostname}${tail}?••••`;
  } catch {
    return '••••';
  }
}

function feedHealth(row: {
  consecutive_failures?: number | null;
  last_error?: string | null;
}): 'ok' | 'warning' | 'error' {
  const n = row.consecutive_failures ?? 0;
  if (n >= 4) return 'error';
  if (n >= 1) return 'warning';
  return 'ok';
}

async function ensureExportRow(
  supabase: ReturnType<typeof createServiceClient>,
  propertyId: string
) {
  const { data } = await supabase
    .from('property_calendar_export')
    .select('token, is_enabled, rotated_at, last_served_at')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (data) return data;
  const token = newToken();
  const { data: created, error } = await supabase
    .from('property_calendar_export')
    .insert({ property_id: propertyId, token, is_enabled: false })
    .select('token, is_enabled, rotated_at, last_served_at')
    .single();
  if (error) throw new Error(`create export row: ${error.message}`);
  return created;
}

function exportUrls(req: Request, propertySlug: string, token: string): Record<string, string> {
  return buildCalendarExportUrls(resolvePublicExportOrigin(req), propertySlug, token);
}

serveAuthenticated('calendar-sync-settings', async (req) => {
  const supabase = createServiceClient();

  // ── GET ────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { property } = await resolveScopedPropertyAccess(req, 'pricing.channels:view');
    // Preview-open: hosts below Pro can browse the Channel sync UI; writes stay plan-gated.
    const [{ data: feedRows }, exportRow, { data: readRows }, { data: runRows }] =
      await Promise.all([
        supabase
          .from('property_calendar_feeds')
          .select(
            'id, property_id, provider, label, is_active, create_bookings, last_attempted_at, last_success_at, last_error, consecutive_failures, echo_warning_at, export_never_read_at, created_at, ics_url_encrypted'
          )
          .eq('property_id', property.id)
          .order('created_at', { ascending: true }),
        ensureExportRow(supabase, property.id),
        supabase
          .from('calendar_export_reads')
          .select('channel, last_read_at, read_count')
          .eq('property_id', property.id)
          .order('last_read_at', { ascending: false })
          .limit(60),
        supabase
          .from('calendar_sync_runs')
          .select('feed_id, status, duration_ms, error_code, started_at')
          .eq('property_id', property.id)
          .order('started_at', { ascending: false })
          .limit(100),
      ]);

    const feeds = feedRows ?? [];
    const feedIds = feeds.map((f) => f.id as string);
    // Per feed, so one busy channel cannot push a quiet channel's activity out of the list.
    const perFeedEvents = await Promise.all(
      feedIds.map((feedId) =>
        supabase
          .from('calendar_sync_events')
          .select(
            'id, feed_id, action, external_uid, start_date, end_date, summary, detail, created_at'
          )
          .eq('feed_id', feedId)
          .order('created_at', { ascending: false })
          .limit(20)
      )
    );
    const events = perFeedEvents
      .flatMap((r) => r.data ?? [])
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    // Latest run per feed. `calendar_sync_runs` is retention-pruned, so this is recent only.
    const latestRunByFeed = new Map<string, Record<string, unknown>>();
    for (const run of runRows ?? []) {
      const id = run.feed_id as string;
      if (!latestRunByFeed.has(id)) latestRunByFeed.set(id, run);
    }
    // Most recent read per channel, so the UI can say "Agoda last read your link 40 min ago".
    const exportReads: Record<string, { lastReadAt: string; readCount: number }> = {};
    for (const read of readRows ?? []) {
      const channel = read.channel as string;
      if (exportReads[channel]) continue;
      exportReads[channel] = {
        lastReadAt: read.last_read_at as string,
        readCount: read.read_count as number,
      };
    }

    const shapedFeeds = await Promise.all(
      feeds.map(async (f) => {
        const enc = f.ics_url_encrypted as string | undefined;
        let maskedUrl = '••••';
        if (enc) {
          try {
            maskedUrl = maskUrl(await decryptIntegrationSecret(enc));
          } catch {
            maskedUrl = '••••';
          }
        }
        return {
          id: f.id,
          provider: f.provider,
          label: f.label,
          isActive: f.is_active,
          createBookings: f.create_bookings,
          maskedUrl,
          hasUrl: Boolean(enc),
          health: feedHealth(f),
          lastAttemptedAt: f.last_attempted_at,
          lastSuccessAt: f.last_success_at,
          lastError: f.last_error,
          consecutiveFailures: f.consecutive_failures,
          createdAt: f.created_at,
          lastRun: latestRunByFeed.get(f.id as string) ?? null,
          echoWarning: Boolean(f.echo_warning_at),
          exportNeverRead: Boolean(f.export_never_read_at),
        };
      })
    );

    return jsonSuccess(req, {
      feeds: shapedFeeds,
      export: {
        enabled: exportRow.is_enabled,
        rotatedAt: exportRow.rotated_at,
        lastServedAt: exportRow.last_served_at,
        // Per-channel read health (200 and 304), keyed by channel or `all`.
        reads: exportReads,
        urls: exportUrls(req, property.slug, exportRow.token),
      },
      recentEvents: events ?? [],
      // What this org may connect today (Airbnb always; Agoda / Booking.com per rollout).
      connectableProviders: connectableProvidersFor(property.organization_id),
    });
  }

  if (req.method !== 'PATCH') return jsonError(req, 'Method not allowed', 405);

  // ── PATCH ───────────────────────────────────────────────────────────────
  const access = await resolveScopedPropertyAccess(req, 'pricing.channels:edit');
  const { property, user } = access;
  const actor = buildActorContext('dashboard', { propertyAccess: access }, req);
  const body = await readJsonBody(req);
  const action = String(body.action ?? '');

  const importActions = new Set(['addFeed', 'updateFeed', 'removeFeed', 'syncNow']);
  if (importActions.has(action)) {
    const blocked = await featureUnavailableResponse(req, 'pricing.channel_sync.import', {
      user,
    });
    if (blocked) return blocked;
  }
  if (action === 'setExportEnabled' && body.enabled === true) {
    const blocked = await featureUnavailableResponse(req, 'pricing.channel_sync', { user });
    if (blocked) return blocked;
  }

  const emitCalendarActivity = (
    calAction:
      'integrations.connected' | 'integrations.disconnected' | 'integrations.config_changed',
    metadata: Record<string, unknown>
  ) =>
    logAssetActivity({
      req,
      user,
      action: calAction,
      propertyId: property.id,
      organizationId: access.org.id,
      accessKind: access.accessKind,
      memberId: access.memberId,
      targetType: 'integration',
      targetId: property.id,
      targetLabel: property.name,
      metadata: { provider: 'calendar_sync', ...metadata },
    });

  // Opt-out: turning Share with Airbnb off must work without the Pro plan (hosts who
  // landed on an auto-enabled row need to disable it without hitting the upgrade modal).
  if (action === 'setExportEnabled' && body.enabled === false) {
    await ensureExportRow(supabase, property.id);
    const { error } = await supabase
      .from('property_calendar_export')
      .update({ is_enabled: false })
      .eq('property_id', property.id);
    if (error) throw new Error(error.message);
    await emitCalendarActivity('integrations.config_changed', {
      setting: 'export_enabled',
      enabled: false,
    });
    return jsonSuccess(req, { enabled: false });
  }

  try {
    await requirePropertyFeature(property.id, 'calendarSync');
  } catch (err) {
    const gate = catchPlanFeatureError(req, err);
    if (gate) return gate;
    throw err;
  }

  try {
    switch (action) {
      case 'addFeed': {
        // Channel, rollout, URL shape, cap and duplicate checks live in `calendarFeedAdd.ts`.
        // The paused-channel switch is async (feature availability), so it runs first when the
        // provider is known.
        const requested = String(body.provider ?? 'airbnb');
        if (isCalendarProvider(requested)) {
          const availabilityKey = calendarChannel(requested).availabilityKey;
          if (availabilityKey) {
            const channelPaused = await featureUnavailableResponse(req, availabilityKey, { user });
            if (channelPaused) return channelPaused;
          }
        }
        const { data: existingFeeds, error: existingFeedsError } = await supabase
          .from('property_calendar_feeds')
          .select('id, is_active, ics_url_encrypted')
          .eq('property_id', property.id);
        if (existingFeedsError) throw new Error(existingFeedsError.message);
        const existingForCheck = await Promise.all(
          (existingFeeds ?? []).map(async (f) => {
            const encrypted = f.ics_url_encrypted as string | null;
            let url: string | null = null;
            if (encrypted) {
              try {
                url = await decryptIntegrationSecret(encrypted);
              } catch {
                /* unreadable stored URL: skip it, the insert will surface the real problem */
              }
            }
            return { isActive: Boolean(f.is_active), url };
          })
        );
        const check = checkAddFeed({
          provider: body.provider,
          organizationId: access.org.id,
          rawUrl: body.icsUrl,
          existing: existingForCheck,
        });
        if (!check.ok) return jsonError(req, check.error, 400);
        const { provider, icsUrl } = check;

        const label =
          typeof body.label === 'string' && body.label.trim()
            ? body.label.trim().slice(0, 120)
            : null;
        const { data, error } = await supabase
          .from('property_calendar_feeds')
          .insert({
            property_id: property.id,
            provider,
            label,
            ics_url_encrypted: await encryptIntegrationSecret(icsUrl),
            create_bookings:
              typeof body.createBookings === 'boolean'
                ? body.createBookings
                : calendarChannel(provider).createBookingsDefault,
            created_by: user.id,
          })
          .select(FEED_COLUMNS)
          .single();
        if (error) throw new Error(error.message);

        // Two-way from the first minute: connecting a channel also starts sending our dates to
        // it. Skipped (never fails the connect) when the host already turned sharing on, or the
        // module is paused by the super-admin switch.
        try {
          const exportRow = await ensureExportRow(supabase, property.id);
          await enableExportOnConnect({
            isEnabled: () => Promise.resolve(Boolean(exportRow.is_enabled)),
            isPaused: async () =>
              Boolean(await featureUnavailableResponse(req, 'pricing.channel_sync', { user })),
            enable: async () => {
              const { error: enableError } = await supabase
                .from('property_calendar_export')
                .update({ is_enabled: true })
                .eq('property_id', property.id);
              if (enableError) throw new Error(enableError.message);
            },
            record: () =>
              emitCalendarActivity('integrations.config_changed', {
                setting: 'export_enabled',
                enabled: true,
                auto: 'channel_connected',
                feed_provider: provider,
              }),
          });
        } catch (enableErr) {
          console.error(
            '[calendar-sync-settings] auto-enable sharing failed (non-fatal):',
            enableErr
          );
        }

        await capturePostHogEvent('calendar_sync_connected', {
          logPrefix: 'calendar-sync-settings',
          request: req,
          distinctId: user.id,
          groups: {
            organization: property.organization_id,
            property: property.id,
          },
          properties: { provider },
        });

        let initialSync = null;
        const inserted = await loadCalendarFeed(supabase, data.id as string);
        if (inserted) {
          const runStartedAt = Date.now();
          try {
            initialSync = await runFeedSync(inserted, {
              runId: crypto.randomUUID(),
              force: true,
              supabase,
              actor,
            });
            await recordFeedRun(supabase, inserted, initialSync, Date.now() - runStartedAt);
          } catch (syncErr) {
            console.error('[calendar-sync-settings] initial sync failed (non-fatal):', syncErr);
            initialSync = {
              feedId: inserted.id,
              runId: crypto.randomUUID(),
              ok: false,
              status: 'error' as const,
              blocksCreated: 0,
              blocksUpdated: 0,
              blocksRemoved: 0,
              bookingsCreated: 0,
              bookingsUpdated: 0,
              bookingsCancelled: 0,
              bookingsLinked: 0,
              conflicts: 0,
              error: syncErr instanceof Error ? syncErr.message : String(syncErr),
            };
          }
        }

        await emitCalendarActivity('integrations.connected', {
          feed_provider: provider,
          feed_id: data.id,
          label,
        });
        return jsonSuccess(req, { feed: data, initialSync });
      }

      case 'updateFeed': {
        const feedId = String(body.feedId ?? '');
        if (!UUID_RE.test(feedId)) return jsonError(req, 'Invalid feedId', 400);
        const existing = await loadCalendarFeed(supabase, feedId);
        if (!existing || existing.property_id !== property.id)
          return jsonError(req, 'Feed not found', 404);

        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (typeof body.label === 'string') patch.label = body.label.trim().slice(0, 120) || null;
        if (typeof body.isActive === 'boolean') patch.is_active = body.isActive;
        if (typeof body.createBookings === 'boolean') patch.create_bookings = body.createBookings;

        // Re-activating a feed must not slip past the active-feed cap.
        if (patch.is_active === true && !existing.is_active) {
          const { data: activeRows, error: activeError } = await supabase
            .from('property_calendar_feeds')
            .select('id')
            .eq('property_id', property.id)
            .eq('is_active', true);
          if (activeError) throw new Error(activeError.message);
          if ((activeRows ?? []).length >= CALENDAR_FEED_LIMIT) {
            return jsonError(
              req,
              `This listing already has ${CALENDAR_FEED_LIMIT} calendars connected.`,
              400
            );
          }
        }

        if (typeof body.icsUrl === 'string' && body.icsUrl.trim()) {
          const icsUrl = assertExternalIcsUrlShape(body.icsUrl, existing.provider);
          // Pointing this feed at another connected calendar duplicates the same nights.
          const normalizedNew = normalizeExternalIcsUrl(body.icsUrl);
          if (normalizedNew) {
            const { data: otherFeeds, error: otherError } = await supabase
              .from('property_calendar_feeds')
              .select('id, ics_url_encrypted')
              .eq('property_id', property.id)
              .neq('id', feedId);
            if (otherError) throw new Error(otherError.message);
            for (const other of otherFeeds ?? []) {
              const encrypted = other.ics_url_encrypted as string | null;
              if (!encrypted) continue;
              try {
                const connectedUrl = normalizeExternalIcsUrl(
                  await decryptIntegrationSecret(encrypted)
                );
                if (connectedUrl && connectedUrl === normalizedNew) {
                  return jsonError(req, 'This calendar is already connected', 400);
                }
              } catch {
                /* unreadable stored URL: keep going */
              }
            }
          }
          patch.ics_url_encrypted = await encryptIntegrationSecret(icsUrl);
          // A URL change resets health so a previously-failing feed retries cleanly.
          patch.consecutive_failures = 0;
          patch.last_error = null;
          patch.last_feed_hash = null;
          patch.last_etag = null;
          patch.last_modified_header = null;
        }
        const { data, error } = await supabase
          .from('property_calendar_feeds')
          .update(patch)
          .eq('id', feedId)
          .select(FEED_COLUMNS)
          .single();
        if (error) throw new Error(error.message);
        await emitCalendarActivity('integrations.config_changed', {
          feed_id: feedId,
          fields: Object.keys(patch).filter((k) => k !== 'updated_at'),
        });

        // Turning ingestion on should populate bookings now, not on the next 30-minute sweep.
        let sync: RunFeedResult | null = null;
        if (patch.create_bookings === true && !existing.create_bookings) {
          const updatedFeed = await loadCalendarFeed(supabase, feedId);
          if (updatedFeed) {
            const runStartedAt = Date.now();
            try {
              sync = await runFeedSync(updatedFeed, {
                runId: crypto.randomUUID(),
                force: true,
                supabase,
                actor,
              });
              await recordFeedRun(supabase, updatedFeed, sync, Date.now() - runStartedAt);
            } catch (syncErr) {
              console.error(
                '[calendar-sync-settings] enable-ingest sync failed (non-fatal):',
                syncErr
              );
            }
          }
        }
        return jsonSuccess(req, { feed: data, sync });
      }

      case 'removeFeed': {
        const feedId = String(body.feedId ?? '');
        if (!UUID_RE.test(feedId)) return jsonError(req, 'Invalid feedId', 400);
        const existing = await loadCalendarFeed(supabase, feedId);
        if (!existing || existing.property_id !== property.id)
          return jsonError(req, 'Feed not found', 404);

        const deleteData = body.deleteData === true;
        if (!deleteData) {
          // Keep imported blocks as historical owner blocks (they may be real stays).
          await supabase
            .from('property_blocked_dates')
            .update({ source: 'manual', feed_id: null, external_uid: null })
            .eq('feed_id', feedId);
        }
        // ON DELETE CASCADE removes calendar_sync_events + any remaining ical_import blocks.
        const { error } = await supabase.from('property_calendar_feeds').delete().eq('id', feedId);
        if (error) throw new Error(error.message);
        await emitCalendarActivity('integrations.disconnected', {
          feed_id: feedId,
          feed_provider: existing.provider,
          deleted_imported_blocks: deleteData,
        });
        return jsonSuccess(req, { removed: feedId, keptImportedBlocks: !deleteData });
      }

      case 'setExportEnabled': {
        if (typeof body.enabled !== 'boolean')
          return jsonError(req, 'enabled must be boolean', 400);
        await ensureExportRow(supabase, property.id);
        const { error } = await supabase
          .from('property_calendar_export')
          .update({ is_enabled: body.enabled })
          .eq('property_id', property.id);
        if (error) throw new Error(error.message);
        await emitCalendarActivity('integrations.config_changed', {
          setting: 'export_enabled',
          enabled: body.enabled,
        });
        return jsonSuccess(req, { enabled: body.enabled });
      }

      case 'syncNow': {
        const feedId = String(body.feedId ?? '');
        if (!UUID_RE.test(feedId)) return jsonError(req, 'Invalid feedId', 400);
        const feed = await loadCalendarFeed(supabase, feedId);
        if (!feed || feed.property_id !== property.id) return jsonError(req, 'Feed not found', 404);
        const runStartedAt = Date.now();
        const result = await runFeedSync(feed, {
          runId: crypto.randomUUID(),
          force: true,
          supabase,
          actor,
        });
        await recordFeedRun(supabase, feed, result, Date.now() - runStartedAt);
        return jsonSuccess(req, { result });
      }

      default:
        return jsonError(req, `Unknown action "${action}"`, 400);
    }
  } catch (err) {
    if (err instanceof ExternalFetchError) return jsonError(req, err.message, 400);
    return jsonError(req, (err as Error).message, 400);
  }
});
