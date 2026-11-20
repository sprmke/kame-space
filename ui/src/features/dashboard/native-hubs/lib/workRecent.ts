const STORAGE_KEY = 'kame-admin-work-recent';
const MAX = 8;

export type WorkRecentEntry = {
  href: string;
  label: string;
  at: number;
};

function read(): WorkRecentEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkRecentEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: WorkRecentEntry[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    /* ignore quota */
  }
}

/** Record a navigable admin screen for the Work hub Continue list. */
export function recordWorkRecent(href: string, label: string): void {
  if (!href || !label) return;
  const next = [
    { href, label, at: Date.now() },
    ...read().filter((entry) => entry.href !== href),
  ].slice(0, MAX);
  write(next);
}

export function listWorkRecent(): WorkRecentEntry[] {
  return read();
}
