/**
 * Data-subject access and deletion requests (ledger PR-145, RA 10173).
 *
 * Export is synchronous and self-service: the caller receives their own personal data as
 * JSON. Deletion is a reviewable request with a 15-day due date; the daily cron alerts the
 * operator, who executes the runbook. Bookings are financial records with a lawful retention
 * basis, so an automated hard delete would be both unsafe and non-compliant.
 */

import { createServiceClient } from './orgAuth.ts';

export type DataSubjectUser = { id: string; email?: string | null };

const MAX_ROWS = 500;

function notFoundOrEmpty<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function noteTruncation<T>(rows: T[]): { rows: T[]; truncated: boolean } {
  return { rows, truncated: rows.length >= MAX_ROWS };
}

export async function buildDataSubjectExport(
  user: DataSubjectUser
): Promise<Record<string, unknown>> {
  const sb = createServiceClient();
  const email = (user.email ?? '').trim().toLowerCase();

  const [
    profile,
    bookings,
    reviews,
    savedProperties,
    verifications,
    guestRequests,
    ticketRows,
    ticketMessageRows,
    chatFeedback,
    ownedOrgs,
    orgMemberships,
    propertyMemberships,
  ] = await Promise.all([
    sb.from('guest_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    sb
      .from('guest_submissions')
      .select(
        'id,status,property_id,booking_source,check_in_date,check_out_date,number_of_nights,check_in_time,check_out_time,number_of_adults,number_of_children,primary_guest_name,guest_email,guest_phone_number,guest_address,guest_special_requests,guest2_name,guest2_age,guest3_name,guest3_age,guest4_name,guest4_age,guest5_name,guest5_age,booking_rate,down_payment,balance,security_deposit,created_at'
      )
      .eq('guest_auth_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS),
    sb
      .from('guest_reviews')
      .select(
        'id,property_id,booking_id,star_rating,review_text,guest_display_name,category_ratings,status,created_at,published_at,response_text,response_at'
      )
      .eq('guest_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS),
    sb
      .from('guest_saved_properties')
      .select('property_slug,created_at')
      .eq('user_id', user.id)
      .limit(MAX_ROWS),
    sb
      .from('identity_verifications')
      .select(
        'id,subject_kind,booking_id,guest_slot,verdict,method,document_type,document_expiry,full_name,date_of_birth,sex,nationality,liveness_passed,face_match_verdict,verified_at,created_at'
      )
      .eq('guest_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS),
    sb
      .from('guest_requests')
      .select('id,property_id,booking_id,kind,status,payload,resolved_at,created_at')
      .eq('guest_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS),
    sb
      .from('support_tickets')
      .select(
        'id,property_id,organization_id,category,subject,status,priority,created_at,updated_at'
      )
      .eq('submitted_by_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS),
    sb
      .from('support_ticket_messages')
      .select('id,ticket_id,sender_type,sender_name,body,created_at')
      .eq('sender_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS),
    sb
      .from('guest_chat_ai_feedback')
      .select('id,conversation_id,message_id,rating,reason,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS),
    sb
      .from('organizations')
      .select('id,name,slug,created_at')
      .eq('owner_id', user.id)
      .limit(MAX_ROWS),
    sb
      .from('organization_members')
      .select('organization_id,role_id,status,permissions,assigned_at,created_at')
      .eq('user_id', user.id)
      .limit(MAX_ROWS),
    sb
      .from('property_members')
      .select('property_id,role_id,status,permissions,assigned_at,created_at')
      .eq('user_id', user.id)
      .limit(MAX_ROWS),
  ]);

  // Tickets filed under the same verified email but before the account existed.
  const emailTicketsResult = email
    ? await sb
        .from('support_tickets')
        .select('id,category,subject,status,priority,created_at,updated_at')
        .eq('submitted_by_email', email)
        .order('created_at', { ascending: false })
        .limit(MAX_ROWS)
    : { data: null, error: null };
  const emailTickets = notFoundOrEmpty(emailTicketsResult.data);

  const propertyIds = [
    ...new Set(
      notFoundOrEmpty(propertyMemberships.data).map((row) => String(row.property_id ?? ''))
    ),
  ].filter(Boolean);
  const propertiesResult = propertyIds.length
    ? await sb
        .from('properties')
        .select('id,name,slug,type,status,city,created_at')
        .in('id', propertyIds)
        .limit(MAX_ROWS)
    : { data: null, error: null };
  const properties = notFoundOrEmpty(propertiesResult.data);

  // A partial export would be misleading, so fail loudly instead of returning half the data.
  const failed = (
    [
      ['profile', profile.error],
      ['bookings', bookings.error],
      ['reviews', reviews.error],
      ['saved_properties', savedProperties.error],
      ['identity_verifications', verifications.error],
      ['guest_requests', guestRequests.error],
      ['support_tickets', ticketRows.error],
      ['support_ticket_messages', ticketMessageRows.error],
      ['chat_ai_feedback', chatFeedback.error],
      ['organizations', ownedOrgs.error],
      ['organization_members', orgMemberships.error],
      ['property_members', propertyMemberships.error],
      ['properties', propertiesResult.error],
      ['support_tickets_by_email', emailTicketsResult.error],
    ] as Array<[string, { message: string } | null]>
  ).filter(([, error]) => Boolean(error));
  if (failed.length > 0) {
    throw new Error(`Could not assemble every part of your data: ${failed[0][0]}`);
  }

  const bookingsResult = noteTruncation(notFoundOrEmpty(bookings.data));

  return {
    generated_at: new Date().toISOString(),
    subject: { user_id: user.id, email: user.email ?? null },
    retention_note:
      'Bookings are retained as financial records after an account is deleted. Personal fields are anonymised; dates, amounts and status remain for accounting and tax.',
    profile: profile.data ?? null,
    guest: {
      bookings: bookingsResult.rows,
      bookings_truncated: bookingsResult.truncated,
      reviews: notFoundOrEmpty(reviews.data),
      saved_properties: notFoundOrEmpty(savedProperties.data),
      identity_verifications: notFoundOrEmpty(verifications.data),
      guest_requests: notFoundOrEmpty(guestRequests.data),
      support_tickets: notFoundOrEmpty(ticketRows.data),
      support_ticket_messages: notFoundOrEmpty(ticketMessageRows.data),
      support_tickets_by_email: emailTickets,
      chat_ai_feedback: notFoundOrEmpty(chatFeedback.data),
    },
    host: {
      owned_organizations: notFoundOrEmpty(ownedOrgs.data),
      organization_memberships: notFoundOrEmpty(orgMemberships.data),
      property_memberships: notFoundOrEmpty(propertyMemberships.data),
      properties: properties,
    },
  };
}

export type DataSubjectRequest = {
  id: string;
  kind: 'export' | 'delete';
  status: string;
  requested_at: string;
  due_at: string;
};

export async function requestAccountDeletion(
  user: DataSubjectUser,
  note?: string | null
): Promise<DataSubjectRequest> {
  const sb = createServiceClient();

  const { data: existing } = await sb
    .from('data_subject_requests')
    .select('id,kind,status,requested_at,due_at')
    .eq('user_id', user.id)
    .eq('kind', 'delete')
    .in('status', ['pending', 'processing'])
    .maybeSingle();
  if (existing) return existing as DataSubjectRequest;

  const { data, error } = await sb
    .from('data_subject_requests')
    .insert({
      user_id: user.id,
      email: user.email ?? null,
      kind: 'delete',
      status: 'pending',
      note: note ? String(note).slice(0, 500) : null,
    })
    .select('id,kind,status,requested_at,due_at')
    .single();

  if (error) throw new Error(`Could not record the deletion request: ${error.message}`);
  return data as DataSubjectRequest;
}

/** Rows the daily cron should alert about. Ids and counts only, never email or names. */
export async function listDueDeletionRequests(
  now: Date = new Date()
): Promise<Array<{ id: string; requested_at: string; due_at: string }>> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('data_subject_requests')
    .select('id,requested_at,due_at')
    .eq('kind', 'delete')
    .eq('status', 'pending')
    .lte('due_at', now.toISOString())
    .order('due_at', { ascending: true })
    .limit(100);
  if (error) throw new Error(`Could not load due deletion requests: ${error.message}`);
  return Array.isArray(data) ? data : [];
}

/** Marks an export as delivered so the request table is a complete audit trail. */
export async function recordExportDelivered(user: DataSubjectUser): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb.from('data_subject_requests').insert({
    user_id: user.id,
    email: user.email ?? null,
    kind: 'export',
    status: 'completed',
    processed_at: new Date().toISOString(),
  });
  if (error) console.error('[data-subject] export record failed:', error.message);
}
