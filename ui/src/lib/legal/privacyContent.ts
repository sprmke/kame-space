import { LEGAL_LAST_UPDATED, type LegalDocument } from '@/lib/legal/legalMeta';
import {
  PLATFORM_APP_NAME,
  PLATFORM_CONTACT_EMAIL,
  platformFormerNameNote,
} from '@/lib/platformBranding';

const scopeLabel = PLATFORM_APP_NAME ? `${PLATFORM_APP_NAME} ` : '';

export const privacyDocument: LegalDocument = {
  id: 'privacy',
  title: 'Privacy Policy',
  description: PLATFORM_APP_NAME
    ? `How ${PLATFORM_APP_NAME} collects, uses, and shares personal information about guests, hosts, and team members.`
    : 'How we collect, use, and share personal information about guests, hosts, and team members.',
  sections: [
    {
      id: 'scope',
      title: 'Scope',
      paragraphs: [
        `This policy covers the ${scopeLabel}public site, guest booking and parking flows, guest accounts, and host dashboards. It follows the Philippine Data Privacy Act of 2012 (RA 10173).`,
        `${platformFormerNameNote()} This policy was last updated on ${LEGAL_LAST_UPDATED}.`,
      ],
    },
    {
      id: 'controller',
      title: 'Who is responsible',
      paragraphs: [
        `${PLATFORM_APP_NAME || 'We'} decides how account, billing, security, and platform data is used. Contact: ${PLATFORM_CONTACT_EMAIL}, Manila, Philippines.`,
        "Each host decides what it asks guests for and how it uses guest records for its stays and parking. For those records the host is a separate controller, and we process them on the host's behalf. House rules or host messages may add stay instructions but do not change this policy.",
      ],
    },
    {
      id: 'collect',
      title: 'Information we collect',
      paragraphs: [],
      items: [
        'Booking details: guest names and ages, email, phone number, address, nationality, stay dates, how you found the property, special requests, and pet and vehicle details when you add them.',
        'Documents: payment receipts, government IDs, pet records and photos, parking papers, and building forms.',
        'Identity verification: ID photos, a selfie, and the details read from the ID (see below).',
        'Payments: amounts, payment status, method type, and references. For refunds, the GCash or bank details you choose.',
        'Messages and calls: chat messages with hosts, voice receptionist captions, and support tickets.',
        'Reviews: ratings, text, photos, and private notes.',
        'Hosts and teams: profile, organization and property details, verification documents, roles, payout details, and billing history.',
        'Device and usage: browser, device, IP address, pages used, and error details needed for security and reliability.',
      ],
    },
    {
      id: 'use',
      title: 'How we use information',
      paragraphs: [
        'We use personal data to process bookings and parking, check documents and identity, send emails and notifications, process refunds, run host tools (calendar and channel sync, inbox, finance, maintenance, pricing, marketing, and the dashboard assistant), prevent fraud and spam, improve the product, and meet legal duties.',
        'We do not sell personal information and do not use it for third-party advertising.',
      ],
    },
    {
      id: 'basis',
      title: 'Lawful basis',
      paragraphs: [],
      items: [
        'Contract: to handle a booking, parking request, account, or subscription you ask for.',
        'Consent: for identity verification, the voice receptionist, push notifications, and optional analytics. You can withdraw consent at any time.',
        'Legitimate interests: for security, fraud and spam prevention, support, and product improvement.',
        'Legal obligation: for tax, accounting, and requests from authorities.',
      ],
    },
    {
      id: 'payments',
      title: 'Payments',
      paragraphs: [
        'Parking payments and host subscriptions are processed by PayMongo on its own secure pages. PayMongo collects your card or e-wallet details. We receive the payment status, amount, method type, and reference, never your full card number.',
        'Stay payments go directly to the host. The receipt you upload is stored privately and shown only to the host and, when needed, to our support team. Refund payout details are used only to send that refund.',
      ],
    },
    {
      id: 'identity',
      title: 'Identity verification',
      paragraphs: [
        'When you verify your identity, we read your ID with an AI model to check it is genuine and belongs to you. Face movement checks run on your device and are not stored.',
        'ID photos and selfies are kept privately for 7 days and then deleted. We keep the result, your name, and the document type and expiry for up to a year or until the document expires. Document numbers are stored only as a one-way code. Hosts see that you are verified, not your ID number. You can delete your verification at any time.',
      ],
    },
    {
      id: 'ai',
      title: 'AI processing',
      paragraphs: [
        'AI features send the content they need to Google Gemini or Groq to return a result: receipts and documents for checks, messages for reply suggestions and automatic replies, host data for dashboard assistant answers, and listing details for marketing drafts. Providers process this data to return the result.',
        'Guests may get automatic replies from an AI assistant in chat. Hosts can turn automatic replies off. We do not use your personal data to train our own AI models.',
      ],
    },
    {
      id: 'voice',
      title: 'Voice receptionist',
      paragraphs: [
        'When you start the voice receptionist, microphone audio is sent to Google Gemini for live processing. We do not store raw voice audio. Live captions may be stored as an unverified session transcript.',
        'Captions are kept for 30 days by default. The platform may set a period from 1 to 90 days. You can delete captions from the completed call, which also removes their safety flags. Call timing, outcome, model, and estimated usage stay with account and property records for security, reliability, and billing.',
      ],
    },
    {
      id: 'reviews',
      title: 'Reviews',
      paragraphs: [
        'Guests may leave a stay review (overall and category ratings, optional text, photos, and a private note to the host). Hosts may leave a guest review (ratings, would-host-again, optional text, a private note to the guest, and a team-only internal note).',
        'Published guest reviews appear on the listing and the host page. Published host reviews of a guest are shown to that guest and to hosts at properties the guest later requests or books, for screening. Screening hosts see averages, tags, and recent review text with the stay location generalized to an area. Internal notes never leave the authoring organization.',
        `You can read and respond to reviews about you after they publish. Ask for a correction or removal by emailing ${PLATFORM_CONTACT_EMAIL} or by reporting the review in the app. Removed reviews drop out of public and screening totals. We keep published reviews while the property exists and delete removed reviews after 24 months.`,
      ],
    },
    {
      id: 'sharing',
      title: 'Who we share data with',
      paragraphs: [
        'Hosts and their authorized team members see the guest and booking data they need to run their properties and parking. We also use these service providers:',
      ],
      items: [
        'Supabase: database, file storage, sign-in, and server functions.',
        'PayMongo: parking and subscription payments.',
        'Resend: transactional email and inbound document approvals.',
        'Google: sign-in, Maps and Places, and Gemini AI.',
        'Groq: AI features when Gemini is unavailable.',
        'Meta: Facebook and Instagram messages and posts, when a host connects a page.',
        'Cloudflare Turnstile: bot and spam protection on forms and sign-in.',
        'PostHog: product analytics, when enabled.',
        'Sentry: error monitoring.',
        'Telegram: internal notifications for host teams.',
        'Browser push services (Apple, Google, Mozilla): push notifications you turn on.',
        'Calendar channels a host connects, such as Airbnb: booked dates only, through calendar sync.',
        'Jamendo: music for the video editor. It receives no guest data.',
      ],
    },
    {
      id: 'sharing-law',
      title: 'Legal requests',
      paragraphs: [
        'We may disclose information when the law requires it, or to protect the rights, safety, and integrity of our users and the service.',
      ],
    },
    {
      id: 'transfers',
      title: 'International transfers',
      paragraphs: [
        'Some providers store or process data outside the Philippines. We use providers that protect personal data under contract and apply safeguards at least as strong as Philippine law requires.',
      ],
    },
    {
      id: 'security',
      title: 'Security',
      paragraphs: [
        'Every request for private data is checked against your role, organization, and property before data is returned. Documents and IDs are kept in private storage, and integration secrets are encrypted.',
        'No system is perfectly secure. Use a strong sign-in method and share booking links only with people who need them. If a breach affects your personal data, we will notify you and the National Privacy Commission as the law requires.',
      ],
    },
    {
      id: 'retention',
      title: 'Retention',
      paragraphs: [
        'We keep booking, document, and account records for as long as needed to run stays, support hosts, meet accounting and legal requirements, and resolve disputes. When data is no longer needed, we delete or anonymize it.',
        'ID photos and selfies are deleted after 7 days. Unfinished booking form drafts stay only on your device for up to 7 days and are cleared when you submit or sign out. Voice captions follow the period above.',
      ],
    },
    {
      id: 'analytics',
      title: 'Analytics and error reporting',
      paragraphs: [
        'When enabled, we use PostHog to understand how the product is used. Events use pseudonymous IDs and avoid message bodies, government IDs, and payment details. Host dashboards may include your email on the analytics profile; guest sessions do not.',
        'We use Sentry to record technical details when something breaks, with a pseudonymous user ID and the page. It does not store names, emails, phone numbers, message content, or IP addresses, and keeps reports for 90 days by default.',
      ],
    },
    {
      id: 'rights',
      title: 'Your rights',
      paragraphs: ['Under the Data Privacy Act you have the right to:'],
      items: [
        'Be informed about how your data is used.',
        'Access a copy of your data.',
        'Correct inaccurate data.',
        'Object to processing, or withdraw consent.',
        'Ask us to delete or block your data.',
        'Get your data in a portable format.',
        'Claim damages for unlawful processing.',
        'File a complaint with the National Privacy Commission (privacy.gov.ph).',
      ],
    },
    {
      id: 'rights-request',
      title: 'How to make a request',
      paragraphs: [
        `Email ${PLATFORM_CONTACT_EMAIL} from the address on your account or booking. We may ask you to confirm your identity and aim to reply within 15 days. For data a host holds about your stay, we will pass your request to that host and help them respond. We may keep some records when the law requires it.`,
        'Cookie and browser storage choices are described in the Cookie Policy.',
      ],
    },
    {
      id: 'children',
      title: 'Children',
      paragraphs: [
        `${PLATFORM_APP_NAME || 'The platform'} is not for account holders under 18. A booking may list minors as guests under an adult's booking. That information is used only for the stay.`,
      ],
    },
    {
      id: 'changes',
      title: 'Changes and contact',
      paragraphs: [
        `We may update this policy by posting a new version here with a new date. For material changes we will also tell account holders by email or in the app. Our data protection contact is ${PLATFORM_CONTACT_EMAIL}.`,
      ],
    },
  ],
};
