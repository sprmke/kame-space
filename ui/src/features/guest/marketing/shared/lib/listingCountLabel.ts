/** "1 property" / "1,240 properties" for result counts in listing chrome. */
export function formatListingCount(total: number, one: string, many: string): string {
  const safe = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  return `${safe.toLocaleString('en-US')} ${safe === 1 ? one : many}`;
}
