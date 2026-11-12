import {
  guestCalendarPath,
  guestFormPath,
  guestPropertyPath,
  guestShowcasePath,
} from '@/features/guest/lib/guestPublicPaths';

import type { ChatUrlLinkResourceKind } from '@/lib/chat/parseChatRichBlocks';
import { urlLinkCardMeta } from '@/lib/chat/parseChatRichBlocks';

export type GuestChatResourceHubItem = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  resourceKind: ChatUrlLinkResourceKind;
};

/**
 * Self-serve links for a guest mid-conversation.
 *
 * A guest who has already booked gets the things they need for the stay (plan E2). They are
 * deliberately **not** offered the booking form or the listing calendar, which would invite a
 * second booking. A guest still deciding gets the browse-first set.
 *
 * `tripPath` is the signal: it is only set when the guest has a booking at this property.
 */
export function buildGuestChatResourceHubItems(
  propertySlug: string,
  opts?: {
    stayGuideUrl?: string | null;
    tripPath?: string | null;
  }
): GuestChatResourceHubItem[] {
  const slug = propertySlug.trim();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (!slug || !origin) return [];

  const tripPath = opts?.tripPath?.trim() ?? '';
  const stayGuideUrl = opts?.stayGuideUrl?.trim() ?? '';
  const isBooked = tripPath.startsWith('/');

  if (isBooked) {
    const items: GuestChatResourceHubItem[] = [
      {
        id: 'trip',
        href: `${origin}${tripPath}`,
        title: 'Your trip',
        subtitle: 'Booking, documents, payment',
        resourceKind: 'trip',
      },
    ];

    if (stayGuideUrl) {
      const meta = urlLinkCardMeta(stayGuideUrl);
      items.push({
        id: 'stay-guide',
        href: stayGuideUrl,
        title: meta.title,
        subtitle: meta.subtitle,
        resourceKind: 'stayGuide',
      });
    }

    // House rules and arrival steps live on the trip page, so link straight to the section.
    items.push(
      {
        id: 'house-rules',
        href: `${origin}${tripPath}#trip-arrival`,
        title: 'House rules',
        subtitle: 'What your host asks of you',
        resourceKind: 'trip',
      },
      {
        id: 'check-in-steps',
        href: `${origin}${tripPath}#trip-steps`,
        title: 'Check-in steps',
        subtitle: 'How to get in',
        resourceKind: 'trip',
      }
    );

    return items;
  }

  const paths: { id: string; path: string }[] = [
    { id: 'calendar', path: guestCalendarPath(slug) },
    { id: 'listing', path: guestPropertyPath(slug) },
    { id: 'form', path: guestFormPath(slug) },
    { id: 'showcase', path: guestShowcasePath(slug) },
  ];

  return paths.map(({ id, path }) => {
    const href = `${origin}${path}`;
    const meta = urlLinkCardMeta(href);
    return {
      id,
      href,
      title: meta.title,
      subtitle: meta.subtitle,
      resourceKind: meta.resourceKind,
    };
  });
}
