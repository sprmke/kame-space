import { LEGAL_LAST_UPDATED, type LegalDocument } from '@/lib/legal/legalMeta';
import {
  PLATFORM_APP_NAME,
  PLATFORM_CONTACT_EMAIL,
  platformFormerNameNote,
  platformLegalIntro,
  platformLegalSubject,
} from '@/lib/platformBranding';

const we = platformLegalSubject();
const platform = PLATFORM_APP_NAME || 'the platform';

export const termsDocument: LegalDocument = {
  id: 'terms',
  title: 'Terms of Service',
  description: PLATFORM_APP_NAME
    ? `These terms govern your use of ${PLATFORM_APP_NAME} as a guest, host, team member, or visitor.`
    : 'These terms govern your use of the platform as a guest, host, team member, or visitor.',
  sections: [
    {
      id: 'about',
      title: 'Who we are',
      paragraphs: [
        platformLegalIntro(),
        `${platformFormerNameNote()} These terms were last updated on ${LEGAL_LAST_UPDATED}.`,
        `These terms cover the public site, guest booking and parking flows, guest accounts, and host dashboards. ${we} provides software. Hosts run their own stays and parking spaces and are not our agents or employees. Each property may add its own house rules, which apply to stays there.`,
      ],
    },
    {
      id: 'accounts',
      title: 'Accounts and eligibility',
      paragraphs: [
        'You must be at least 18 to create an account. Keep your sign-in details secure and your information accurate. One account is for one person.',
        'Guest accounts (profile, trips, messages, vouchers) are separate from host access. Team members act for the organization that invited them. The organization owner is responsible for who they invite and what those members do.',
      ],
    },
    {
      id: 'bookings',
      title: 'Bookings and property rules',
      paragraphs: [
        'Submitting a booking form sends a request to the host. The host may approve, ask for documents, or decline it. Rates, fees, pet and parking rules, documents, and cancellation terms are set by the host and shown in the form, emails, or stay guide.',
        'The house rules and cancellation policy shown when you book are part of your agreement with the host. The cancellation policy you accept is saved with your booking.',
        'Hosts are responsible for accurate listings, local rules (including tax, safety, and building requirements), guest communication, and their decisions on approvals, cancellations, and refunds.',
      ],
    },
    {
      id: 'payments',
      title: 'Stay payments and deposits',
      paragraphs: [
        'For stays, you pay the host directly using the payment details the host provides. You upload proof of payment, we may check the receipt automatically, and the host confirms it. We do not hold stay payments.',
        "Security deposits and their refunds follow the property's workflow: the host records any final balance after check-out, then sends the refund to the payout details you choose. Refunds after a cancellation follow the cancellation policy you accepted.",
        `${we} does not guarantee occupancy, that a host will refund on time, or that every transfer between you and a host will succeed. Disputes about a stay, deposit, or property condition are between the guest and the host, but you can ask us for help at ${PLATFORM_CONTACT_EMAIL}.`,
      ],
    },
    {
      id: 'parking',
      title: 'Parking payments',
      paragraphs: [
        `When a parking request is accepted, you pay through PayMongo on ${platform}. We collect the payment and pay the host their share. The price shown at checkout is the full price you pay.`,
        'A request that is not paid within the time shown expires and the space is released. Parking payments are non-refundable once paid, unless the space cannot be provided or the law requires a refund.',
      ],
    },
    {
      id: 'billing',
      title: 'Host plans and billing',
      paragraphs: [
        'Paid plans are billed monthly in Philippine pesos for each property your organization covers, through PayMongo. Prices, volume discounts, and what each plan includes are shown on the Pricing page and in Plans & Billing.',
        'Renewal is a payment link, not an automatic charge. If a payment is late, your organization becomes past due and keeps access during a grace period. After that, paid features are suspended until you pay. Guest booking pages keep working.',
        'Upgrading starts a new billing period today, with credit for unused time on your current plan. Downgrades and switching to Free apply right away. Unused time is never refunded in cash. We may change prices for future periods with advance notice.',
      ],
    },
    {
      id: 'vouchers',
      title: 'Vouchers and rewards',
      paragraphs: [
        'Vouchers are issued by the host. They have no cash value, cannot be sold or transferred, and can only be used as shown on the voucher, including any expiry date or conditions.',
        'We may cancel vouchers, rewards, or badges obtained through abuse, duplicate accounts, or fake bookings.',
      ],
    },
    {
      id: 'verification',
      title: 'Identity and account verification',
      paragraphs: [
        'Hosts may ask guests to verify their identity, and we may ask hosts to verify their identity, ownership, or authority to list a property. We may decline, pause, or remove a booking, listing, or account when a document appears false or altered.',
        "Verification checks a document. It does not guarantee a person's identity, conduct, or ownership claims.",
      ],
    },
    {
      id: 'reviews',
      title: 'Reviews',
      paragraphs: [
        'After check-out, guests and hosts may review each other during a 14-day window. Reviews stay hidden until both sides submit or the window closes. Do not offer money, refunds, discounts, or other value in exchange for a review or a rating.',
        'Public review text and responses may not include phone numbers, emails, or URLs. Each side may post one public response. Either side may report a published review, and we decide removals. Hosts may use published guest-reputation summaries when screening a booking from that guest.',
      ],
    },
    {
      id: 'ai',
      title: 'AI features',
      paragraphs: [
        'Some features use AI, such as receipt and document checks, reply suggestions, automatic chat replies, the voice receptionist, the dashboard assistant, pricing suggestions, and marketing drafts. AI output can be wrong or incomplete.',
        'Hosts should review AI suggestions, replies, prices, and posts before relying on them, and stay responsible for what they send, publish, or approve. Guests may receive automatic replies in chat and on calls. Ask for the host if you need a person.',
      ],
    },
    {
      id: 'content',
      title: 'Your content',
      paragraphs: [
        'You keep ownership of the listings, photos, messages, and posts you add. You give us a non-exclusive license to store, display, and adapt that content to run the service, and to publish it where you ask us to, such as your connected Meta pages.',
        'Only upload content you have the right to use. We may remove content that breaks these terms or the law.',
      ],
    },
    {
      id: 'host-data',
      title: 'Host responsibilities for guest data',
      paragraphs: [
        'Hosts decide what guest information they collect and are responsible for having a lawful reason to collect, import, or share it. Use guest data only to run stays, parking, and related services, and help us respond when a guest asks to access or delete their data.',
        'Do not import or upload data about people unless you are allowed to use it for that purpose.',
      ],
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable use',
      paragraphs: [
        'Do not upload fake IDs, receipts, or documents; harass others; take payments outside the agreed method to defraud someone; scrape data; create accounts by automated means; bypass access controls; or use messaging and marketing tools for spam or illegal content.',
        'We may limit or suspend access when we reasonably believe these terms, property rules, or the law have been broken.',
      ],
    },
    {
      id: 'third-parties',
      title: 'Availability and third parties',
      paragraphs: [
        'The service relies on providers for hosting, payments (PayMongo), email, maps and sign-in (Google), messaging (Meta), and AI. Features may change, and outages can happen.',
        'Links to other sites and apps are for convenience. Their own terms and privacy practices apply.',
      ],
    },
    {
      id: 'termination',
      title: 'Ending your account',
      paragraphs: [
        `You can stop using ${platform} at any time. To close your account, email ${PLATFORM_CONTACT_EMAIL}. Organization owners can delete an organization from its settings.`,
        'We may suspend or close accounts for breaking these terms or for unpaid billing. Some records are kept after closure as described in the Privacy Policy.',
      ],
    },
    {
      id: 'liability',
      title: 'Limitation of liability',
      paragraphs: [
        `To the fullest extent allowed by Philippine law, ${platform} is provided as is and as available. ${we} is not liable for indirect, incidental, special, or consequential damages from using the platform, including disputes between guests and hosts over stays, deposits, parking, or property conditions.`,
        'Nothing in these terms limits liability that cannot be limited by law.',
      ],
    },
    {
      id: 'changes',
      title: 'Governing law and changes',
      paragraphs: [
        'These terms are governed by the laws of the Republic of the Philippines. Courts in Metro Manila have exclusive jurisdiction, subject to consumer protections that cannot be waived.',
        `We may update these terms by posting a new version here. For material changes we will also tell account holders by email or in the app. Using the service after changes take effect means you accept them. Questions: ${PLATFORM_CONTACT_EMAIL}.`,
      ],
    },
  ],
};
