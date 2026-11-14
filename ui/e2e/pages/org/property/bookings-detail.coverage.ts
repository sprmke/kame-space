import { definePageCoverage } from '../../../shared/pageCoverage/definePageCoverage';

/**
 * `/org/:orgSlug/property/:propertySlug/bookings/:bookingId` — the workflow page where every
 * booking transition happens.
 */
export default definePageCoverage({
  guide: 'docs/guides/routes/org/property/bookings-detail.md',
  routes: ['/org/:orgSlug/property/:propertySlug/bookings/:bookingId'],
  archetype: 'WF',
  levels: ['property'],
  sections: {
    'View mode': 'ui/e2e/features/bookings/propertyBookingProceed.spec.ts#host can open booking detail in pending review',
    'Edit mode':
      'ui/e2e/features/bookings/propertyBookingFreeManualWorkflow.spec.ts#Automation Triggers shows Send manually and sends GAF and ack emails',
    'Progress panel':
      'ui/e2e/features/bookings/propertyBookingProceed.spec.ts#host can proceed PENDING_REVIEW to PENDING_DOCUMENTS on paid plan',
    'Pay parking':
      'ui/e2e/features/bookings/propertyBookingParkingEdit.spec.ts#adding parking on Pending Documents keeps the current status',
  },
  na: {},
  gates: ['emailAutomations'],
  permissions: ['bookings.detail.workflow:edit', 'bookings.detail.parking:edit'],
  edgeFunctions: ['get-booking', 'update-booking-details', 'cancel-booking', 'send-booking-workflow-email'],
  activity: ['booking.status_changed', 'booking.updated'],
  unit: [
    'ui/src/features/dashboard/bookings/lib/workflow.test.ts',
    'supabase/functions/_shared/statusMachine_test.ts',
  ],
});
