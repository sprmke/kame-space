import { definePageCoverage } from '../../../shared/pageCoverage/definePageCoverage';

/**
 * `/org/:orgSlug/property/:propertySlug/finance`
 *
 * Shares its UI with the parking finance page (`docs/guides/routes/org/parking/finance.md`),
 * which gets its own manifest when that page is adopted.
 */
export default definePageCoverage({
  guide: 'docs/guides/routes/org/property/finance.md',
  routes: ['/org/:orgSlug/property/:propertySlug/finance'],
  archetype: 'DW',
  levels: ['property'],
  sections: {
    'Summary cards & charts':
      'ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts#finance card header titles never sit under their filter at 1024px',
    'Unified ledger':
      'ui/e2e/features/dashboard/financeLedger.spec.ts#shows the seeded transaction and stay in the unified ledger',
    Permissions:
      'ui/e2e/features/team/propertyTeamNavRbac.spec.ts#Operations deep-link to Finance redirects away from /finance',
  },
  na: {},
  gates: ['financeReporting'],
  permissions: ['finance:view', 'finance:edit'],
  edgeFunctions: ['finance-summary', 'finance-line-items', 'finance-export'],
  activity: ['finance.line_item.created', 'finance.line_item.updated', 'finance.line_item.deleted'],
  unit: [
    'ui/src/features/dashboard/finance/lib/financeSummaryStats.test.ts',
    'ui/src/features/dashboard/finance/lib/financeLedger.test.ts',
    'ui/src/features/dashboard/finance/lib/financePeriod.test.ts',
    'ui/src/features/dashboard/finance/lib/financeChartData.test.ts',
    'ui/src/features/dashboard/finance/lib/operatingLineItemFormSteps.test.ts',
    'ui/src/features/dashboard/finance/lib/exportPdf.test.ts',
    'supabase/functions/_shared/financeRecurrence_test.ts',
  ],
});
