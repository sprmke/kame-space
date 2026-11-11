/**
 * Page copy shared by a React page and its crawler snapshot.
 *
 * Google tolerates dynamic rendering only while the crawler HTML shows the same content as
 * the rendered page, so every string the snapshot renders for a static page is imported from
 * here by the page component too. Editing the page means editing this file; nothing else.
 *
 * Pure data, no imports: the middleware bundle resolves this by relative path.
 */

export type StaticPageCopy = {
  /** The page's single `<h1>`. */
  heading: string;
  /** Second half of the heading when the page styles it as a separate accent line. */
  headingAccent?: string;
  /** The hero paragraph under the heading. */
  intro: string;
};

export const STATIC_PAGE_COPY = {
  home: {
    heading: 'Condo stays, booked straight from the host',
    intro: 'Find a stay, a residence, or a parking slot close to it.',
  },
  about: {
    heading: 'Philippine stays, one operating system',
    intro:
      'Connect guest booking, host operations, messaging, marketing, finance, and parking so every stay has a clear path from calendar to check-out.',
  },
  contact: {
    heading: 'Send us a message',
    intro: 'Pick what your message is about. Sign in with your explore account to open a ticket.',
  },
  support: {
    heading: 'Answers for guests and hosts',
    intro: 'Short answers for the booking workflow you see in the product.',
  },
  forHosts: {
    heading: 'Run every stay',
    headingAccent: 'from one dashboard',
    intro:
      'Bookings, guest messages, finance, marketing, and operations stay connected, so work keeps moving when you step away.',
  },
  forHostsPricing: {
    heading: 'Plans that grow with you',
    intro:
      'Start free on one listing. Upgrade when you need automation, marketing, AI, or hands-off hosting.',
  },
} as const satisfies Record<string, StaticPageCopy>;

export type StaticPageKey = keyof typeof STATIC_PAGE_COPY;

/**
 * Legal page copy. Takes the product name because the rendered pages interpolate
 * `PLATFORM_APP_NAME`, so the snapshot must too.
 */
export function legalPageCopy(productName: string): {
  terms: StaticPageCopy;
  privacy: StaticPageCopy;
  cookies: StaticPageCopy;
} {
  const name = productName.trim();
  return {
    // Wording mirrors ui/src/lib/legal/{terms,privacy,cookies}Content.ts exactly. Those
    // modules import platform branding, so the middleware bundle cannot import them; these
    // strings are the snapshot's copy of the same text.
    terms: {
      heading: 'Terms of Service',
      intro: name
        ? `These terms govern your use of ${name} as a guest, host, team member, or visitor.`
        : 'These terms govern your use of the platform as a guest, host, team member, or visitor.',
    },
    privacy: {
      heading: 'Privacy Policy',
      intro: name
        ? `How ${name} collects, uses, and shares personal information about guests, hosts, and team members.`
        : 'How we collect, use, and share personal information about guests, hosts, and team members.',
    },
    cookies: {
      heading: 'Cookie Policy',
      intro: name
        ? `How ${name} uses cookies and browser storage on the public site, guest flows, and dashboards.`
        : 'How we use cookies and browser storage on the public site, guest flows, and dashboards.',
    },
  };
}
