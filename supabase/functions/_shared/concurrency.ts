/**
 * Bounded parallelism for independent network work.
 *
 * Used by the booking submit, where a form can carry eight uploads (pet document, pet photo,
 * payment receipt, up to five IDs). Those used to be awaited one at a time, so the guest waited
 * for eight round trips in series. They are independent, but running them all at once would hold
 * every document in memory at the same time, and the edge runtime has a ceiling.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  if (limit < 1) throw new Error('runWithConcurrency limit must be at least 1');

  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}
