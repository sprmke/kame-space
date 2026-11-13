import { definePageCoverage } from '../shared/pageCoverage/definePageCoverage';

/**
 * `/properties/:propertySlug/calendar` — public availability calendar and the entry point to
 * the guest form.
 */
export default definePageCoverage({
  guide: 'docs/guides/routes/calendar.md',
  routes: ['/properties/:propertySlug/calendar'],
  archetype: 'G',
  levels: ['property'],
  sections: {
    'Query params': 'ui/e2e/features/guest-form/guestCalendarSmoke.spec.ts',
  },
  na: {},
  gates: [],
  permissions: [],
  edgeFunctions: ['get-booked-dates', 'get-public-property'],
  activity: [],
  unit: ['ui/src/features/guest/calendar/lib/guestCalendarAvailability.test.ts'],
});
