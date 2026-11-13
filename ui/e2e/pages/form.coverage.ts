import { definePageCoverage } from '../shared/pageCoverage/definePageCoverage';

/**
 * `/properties/:propertySlug/form` — the guest intake form, the app's primary money path.
 */
export default definePageCoverage({
  guide: 'docs/guides/routes/form.md',
  routes: ['/properties/:propertySlug/form'],
  archetype: 'G',
  levels: ['property'],
  sections: {
    Steps: 'ui/e2e/features/guest-form/guestFormSubmit.spec.ts',
    Fields: 'ui/e2e/features/guest-form/guestFormLoad.spec.ts',
  },
  na: {
    'Developer controls (non-production only)':
      'Dev panel is gated on a non-production build; it never renders in the shipped app.',
    'Pending / follow-ups': 'Backlog notes for this page, not behaviour.',
  },
  gates: [],
  permissions: [],
  edgeFunctions: ['submit-form', 'submit-form-completion', 'get-form', 'get-form-completion'],
  activity: ['booking.guest_form_submitted'],
  unit: [
    'ui/src/features/guest/form/lib/bookingFormatter.test.ts',
    'ui/src/features/guest/form/lib/bookingSourceFromSearchParams.test.ts',
    'ui/src/features/guest/form/lib/guestBookingAccess.test.ts',
    'supabase/functions/_shared/guestFormSubmitValidation_test.ts',
  ],
});
