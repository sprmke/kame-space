import type { PublicSupportFaq } from '@/features/guest/marketing/lib/publicSupportApi';

/**
 * Fallback guest help topics when `list-public-support-faqs` has no guest/public rows.
 * Same role as the Guests section fallbacks on `/support`, with categories for the topic grid.
 */
export const GUEST_HELP_FALLBACK_FAQS: PublicSupportFaq[] = [
  {
    id: 'fallback-trips-1',
    category: 'Trips',
    question: 'How do I see my bookings?',
    answer:
      'Open Trips in your account. Use the same email you entered on the booking form so stays can match.',
    audience: 'guest',
    sortOrder: 10,
  },
  {
    id: 'fallback-trips-2',
    category: 'Trips',
    question: 'What happens after I submit a booking form?',
    answer:
      'Your stay enters host review. You may be asked for documents such as ID, payment receipt, or pet and parking papers. When requirements are met, the booking moves toward check-in, then check-out, and finally the security-deposit refund if one was collected.',
    audience: 'guest',
    sortOrder: 20,
  },
  {
    id: 'fallback-docs-1',
    category: 'Documents & payments',
    question: 'Where do I upload IDs or receipts?',
    answer:
      'Use the booking form or the follow-up links in your email for that property. Upload only what the host requests for your stay.',
    audience: 'guest',
    sortOrder: 10,
  },
  {
    id: 'fallback-docs-2',
    category: 'Documents & payments',
    question: 'How do security deposit refunds work?',
    answer:
      'After check-out, eligible stays open a security-deposit refund form. You provide bank or GCash payout details, and the host processes the refund through the booking workflow.',
    audience: 'guest',
    sortOrder: 20,
  },
  {
    id: 'fallback-messages-1',
    category: 'Messages',
    question: 'Can I message the host?',
    answer:
      'Open Messages in your account for chats you already started, or use the property message link from your stay email when messaging is offered.',
    audience: 'guest',
    sortOrder: 10,
  },
  {
    id: 'fallback-vouchers-1',
    category: 'Vouchers & reviews',
    question: 'Where are my vouchers?',
    answer:
      'Open Vouchers in your account. Ready rewards can be used when you book the same property again. Used vouchers stay listed for history.',
    audience: 'guest',
    sortOrder: 10,
  },
  {
    id: 'fallback-reviews-1',
    category: 'Vouchers & reviews',
    question: 'Where do I leave a stay review?',
    answer:
      'Open Reviews in your account, use the trip page, or follow the review link in your email after checkout.',
    audience: 'guest',
    sortOrder: 20,
  },
  {
    id: 'fallback-account-1',
    category: 'Account',
    question: 'How do I update my profile?',
    answer: 'Open Profile in your account to change your display name, photo, and contact details.',
    audience: 'guest',
    sortOrder: 10,
  },
  {
    id: 'fallback-account-2',
    category: 'Account',
    question: 'How do I contact support?',
    answer:
      'Open Tickets in your account and send a new ticket, or use Contact support from Help. Replies show in the same ticket thread.',
    audience: 'guest',
    sortOrder: 20,
  },
];

export function resolveGuestHelpFaqs(apiFaqs: PublicSupportFaq[]): PublicSupportFaq[] {
  return apiFaqs.length > 0 ? apiFaqs : GUEST_HELP_FALLBACK_FAQS;
}
