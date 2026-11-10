/**
 * URL-friendly slug from a display name.
 *
 * Diacritics are stripped (`Parañaque` → `paranaque`) so Philippine place names keep their
 * keyword instead of turning into `para-aque`. Mirrors `pls_slugify_name` in SQL and
 * `slugifyOrgName` in the UI; the three are asserted against the same vectors.
 */
export function slugifyName(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 64) || 'item'
  );
}

/** Append numeric suffix when base slug is taken. */
export function withSlugSuffix(base: string, attempt: number): string {
  if (attempt <= 0) return base;
  const suffix = `-${attempt + 1}`;
  const maxBase = Math.max(1, 64 - suffix.length);
  return `${base.slice(0, maxBase)}${suffix}`;
}
