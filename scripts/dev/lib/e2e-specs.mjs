import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** Every Playwright spec under `ui/e2e`, with its repo-relative path and source. */
export async function globbySpecs(root) {
  const out = [];

  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
        out.push({ name: path.relative(root, full), source: await readFile(full, 'utf8') });
      }
    }
  }

  await walk(path.join(root, 'ui/e2e'));
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
