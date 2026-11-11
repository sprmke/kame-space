/**
 * Page coverage manifest.
 *
 * One manifest per page mirrors its route guide: every behavioural `##` section in the
 * guide is either claimed by a spec, or marked `na` with a reason. `check:test-coverage`
 * enforces that, so a new guide section cannot ship without a decision about its test.
 *
 * Deliberately not a test runner: the manifest records where coverage lives, it does not
 * try to guess it. Adoption is per page, so the suite converts one guide at a time.
 */

export type PageArchetype = 'R' | 'S' | 'P' | 'G' | 'DR' | 'DW' | 'WF';

export type PageLevel = 'org' | 'property' | 'parking';

export type PageCoverage = {
  /** Route guide this page mirrors, relative to the repo root. */
  guide: string;
  /** App routes the page renders at, with params, as they appear in the router. */
  routes: string[];
  archetype: PageArchetype;
  levels: PageLevel[];
  /** Guide `##` heading -> spec path, optionally `path.spec.ts#test title`. */
  sections: Record<string, string>;
  /** Guide `##` heading -> why there is no spec (cron, manual, covered elsewhere). */
  na: Record<string, string>;
  /** PlanFeatureKeys surfaced on this page. */
  gates: string[];
  /** Permission leaves checked before the page or its writes. */
  permissions: string[];
  /** Edge functions the page calls. */
  edgeFunctions: string[];
  /** Activity actions the page's writes record. */
  activity: string[];
  /** Unit suites that already prove this page's logic. */
  unit: string[];
};

const ARCHETYPES: PageArchetype[] = ['R', 'S', 'P', 'G', 'DR', 'DW', 'WF'];

/**
 * Describes one page's coverage. Validates the shape at import time so a typo fails in
 * the manifest file that caused it rather than in the checker.
 */
export function definePageCoverage(input: PageCoverage): PageCoverage {
  if (!input.guide?.trim()) throw new Error('definePageCoverage: guide is required');
  if (!ARCHETYPES.includes(input.archetype)) {
    throw new Error(`definePageCoverage: unknown archetype "${input.archetype}"`);
  }

  // Manifests are hand-written config and are not type-checked by `tsc` (ui/tsconfig only
  // includes src), so the shape is enforced here instead.
  const listFields = [
    'routes',
    'levels',
    'gates',
    'permissions',
    'edgeFunctions',
    'activity',
    'unit',
  ] as const;
  for (const field of listFields) {
    const value = input[field];
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
      throw new Error(`definePageCoverage: ${field} must be a list of non-empty strings`);
    }
  }

  if (input.routes.length === 0) throw new Error('definePageCoverage: routes is empty');
  if (input.levels.length === 0) throw new Error('definePageCoverage: levels is empty');

  for (const [heading, spec] of Object.entries(input.sections)) {
    if (!spec.trim()) throw new Error(`definePageCoverage: empty spec for "${heading}"`);
    if (heading in input.na) {
      throw new Error(`definePageCoverage: "${heading}" is both claimed and marked na`);
    }
  }
  for (const [heading, reason] of Object.entries(input.na)) {
    if (!reason.trim()) throw new Error(`definePageCoverage: na needs a reason for "${heading}"`);
  }

  return input;
}
