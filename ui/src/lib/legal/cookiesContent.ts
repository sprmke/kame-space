import { LEGAL_LAST_UPDATED, type LegalDocument } from '@/lib/legal/legalMeta';
import { PLATFORM_APP_NAME, PLATFORM_CONTACT_EMAIL } from '@/lib/platformBranding';

const subject = PLATFORM_APP_NAME || 'We';

export const cookiesDocument: LegalDocument = {
  id: 'cookies',
  title: 'Cookie Policy',
  description: PLATFORM_APP_NAME
    ? `How ${PLATFORM_APP_NAME} uses cookies and browser storage on the public site, guest flows, and dashboards.`
    : 'How we use cookies and browser storage on the public site, guest flows, and dashboards.',
  sections: [
    {
      id: 'overview',
      title: 'Overview',
      paragraphs: [
        `${subject} uses cookies and similar browser storage to keep you signed in, protect forms from bots, remember your preferences, save unfinished forms, and, when enabled, measure product usage. We do not use advertising pixels or third-party ad trackers.`,
        `This policy was last updated on ${LEGAL_LAST_UPDATED}. Contact: ${PLATFORM_CONTACT_EMAIL}.`,
      ],
    },
    {
      id: 'required',
      title: 'Required',
      paragraphs: [
        'These keep the service working and secure. They cannot be turned off in the app.',
      ],
      items: [
        'Sign-in session (Supabase Auth) for host dashboards and guest accounts.',
        'Booking access key in session storage, so only you can open your booking links. Cleared when you close the tab.',
        'Cloudflare Turnstile, which checks that a person is sending a form or signing in.',
        'App files saved by the service worker so pages load fast and work offline.',
      ],
    },
    {
      id: 'preferences',
      title: 'Preferences',
      paragraphs: [],
      items: [
        'Theme (light or dark), dismissed tips, layout choices, and whether you have seen a notice such as the voice receptionist disclosure.',
        'Guest or host mode when you switch between them.',
      ],
    },
    {
      id: 'drafts',
      title: 'Saved drafts',
      paragraphs: [
        'If you leave a booking form before sending it, your answers and files are saved on your device so you do not lose them. Drafts are never sent to us until you submit, expire after 7 days, and are cleared when you submit or sign out.',
      ],
    },
    {
      id: 'analytics',
      title: 'Analytics and errors',
      paragraphs: [
        'We ask first, with a cookie banner on your first visit. PostHog only starts, and only then sets first-party cookies or local storage to measure how the product is used, if you choose Accept. Choosing Necessary only keeps it off. Session replay stays off unless we turn it on with input masking.',
        'Sentry records errors without setting advertising cookies and is not part of this choice.',
      ],
    },
    {
      id: 'third-parties',
      title: 'Third parties',
      paragraphs: [
        'Google sign-in, Google Maps, PayMongo checkout, and Meta may set their own cookies when you use those features. Their policies apply to that activity.',
      ],
    },
    {
      id: 'controls',
      title: 'Your controls',
      paragraphs: [
        'Change your analytics cookie choice any time with the button on this page. You can also clear site data or block cookies in your browser settings. Blocking required storage stops sign-in and some forms from working. Signing out clears saved drafts and offline data on that device.',
        `For other privacy questions, see the Privacy Policy or email ${PLATFORM_CONTACT_EMAIL}.`,
      ],
    },
  ],
};
