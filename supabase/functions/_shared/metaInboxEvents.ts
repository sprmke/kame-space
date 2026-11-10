/**
 * Pure parsers for Meta webhook payloads.
 *
 * The platform comes from the webhook `object` field. The recipient id was used before, and
 * Facebook Page ids and guest ids can both start with 17, so Messenger messages and
 * Business Suite echoes were filed under Instagram.
 */

export type MetaMessagingPlatform = 'facebook' | 'instagram';

/** Platform from the webhook `object` field. `null` when the object is not a messaging one. */
export function platformFromMetaObject(object: string | undefined): MetaMessagingPlatform | null {
  if (object === 'page') return 'facebook';
  if (object === 'instagram') return 'instagram';
  return null;
}
