/**
 * Auth page configuration per audience (host vs guest).
 *
 * One sign-in page per audience. Email OTP creates the account on first code entry, so a
 * separate register page would render the same form; `/register` redirects here instead.
 */

export type AuthAudience = 'host' | 'guest';

export interface AuthPageConfig {
  badge: string;
  title: string;
  subtitle: string;
  /** Cross-audience exit (guest ↔ host). Carries no `redirect`: the path is invalid on the other side. */
  otherPrompt: string;
  otherLinkLabel: string;
  otherHref: string;
}

const hostBase = '/for-hosts';
const guestBase = '/for-guests';

export const AUTH_PAGE_CONFIG: Record<AuthAudience, AuthPageConfig> = {
  host: {
    badge: 'Host / Property Manager',
    title: 'Log in or sign up',
    subtitle: 'Sign in to manage your properties and bookings',
    otherPrompt: 'Booking a stay?',
    otherLinkLabel: 'Sign in as guest',
    otherHref: `${guestBase}/login`,
  },
  guest: {
    badge: 'Guest / Explore',
    title: 'Log in or sign up',
    subtitle: 'Sign in to browse and book your next stay',
    otherPrompt: 'Own or manage a property?',
    otherLinkLabel: 'Sign in as host',
    otherHref: `${hostBase}/login`,
  },
};
