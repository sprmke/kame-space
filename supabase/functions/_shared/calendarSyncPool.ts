/**
 * Bounded concurrency for the calendar sweep.
 * Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §4.8
 *
 * Feeds of the **same property** must run one after another: two feeds of one property race on
 * booking adoption, relink and conflict evaluation. Different properties are independent, so a
 * small pool across properties lifts throughput without changing per-feed semantics.
 *
 * Pure module (no DB, no clock) so the ordering and the cap are unit-tested.
 */

export interface PropertyFeedGroup<T> {
  propertyId: string;
  feeds: T[];
}

/** Group feeds by property, preserving first-seen order. */
export function groupFeedsByProperty<T extends { property_id: string }>(
  feeds: T[]
): PropertyFeedGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const feed of feeds) {
    const existing = groups.get(feed.property_id);
    if (existing) existing.push(feed);
    else groups.set(feed.property_id, [feed]);
  }
  return [...groups.entries()].map(([propertyId, groupFeeds]) => ({
    propertyId,
    feeds: groupFeeds,
  }));
}

export interface RunPoolOptions {
  /** Stop taking new work (e.g. the invocation time budget ran out). In-flight feeds finish. */
  shouldStop?: () => boolean;
}

/**
 * Run `worker` over every feed: up to `concurrency` properties in flight, one feed at a time
 * within a property. Returns results in input order; feeds not started (because `shouldStop`)
 * are absent.
 */
export async function runFeedPool<T, R>(
  groups: PropertyFeedGroup<T>[],
  concurrency: number,
  worker: (feed: T) => Promise<R>,
  opts: RunPoolOptions = {}
): Promise<R[]> {
  const indexOf = new Map<T, number>();
  let index = 0;
  for (const group of groups) {
    for (const feed of group.feeds) indexOf.set(feed, index++);
  }

  const results: (R | undefined)[] = new Array(indexOf.size);
  let nextGroup = 0;
  const limit = Math.max(1, Math.min(concurrency, groups.length));

  async function drain(): Promise<void> {
    while (true) {
      if (opts.shouldStop?.()) return;
      const groupIndex = nextGroup++;
      if (groupIndex >= groups.length) return;
      for (const feed of groups[groupIndex].feeds) {
        if (opts.shouldStop?.()) return;
        results[indexOf.get(feed)!] = await worker(feed);
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, () => drain()));
  return results.filter((r): r is R => r !== undefined);
}
