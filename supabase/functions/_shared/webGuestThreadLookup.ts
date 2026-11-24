import type { SocialPlatform } from './socialInboxTypes.ts';

/**
 * Which column identifies an existing website-chat row for this guest.
 *
 * `social_conversations` has unique indexes on `(property_id, guest_user_id)` and
 * `(parking_id, guest_user_id)` for web threads, so an older row can exist with a different
 * `external_thread_id` (legacy ids, imports). When an insert trips that unique index the
 * caller must adopt the row by guest rather than retrying the same insert forever.
 */
export function webGuestConversationLookup(fields: {
  platform: SocialPlatform;
  guest_user_id?: string | null;
  property_id?: string | null;
  parking_id?: string | null;
}): { column: 'parking_id' | 'property_id'; value: string } | null {
  if (fields.platform !== 'web' || !fields.guest_user_id) return null;
  if (fields.parking_id) return { column: 'parking_id', value: fields.parking_id };
  if (fields.property_id) return { column: 'property_id', value: fields.property_id };
  return null;
}
