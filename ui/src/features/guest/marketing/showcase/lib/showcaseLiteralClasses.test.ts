import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Tailwind only generates CSS for class names it can read as whole strings in the source. A class
 * built with `${}` (for example `text-[${expr}]`) never gets a rule, so the element silently falls
 * back to the base heading size. That is how Monolith, Verso and Editorial titles ended up at 24px.
 */
const ROOTS = [join(__dirname, '..'), join(__dirname, '../../../stay-guide')];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

describe('showcase and stay guide Tailwind classes', () => {
  it('never build an arbitrary Tailwind value with a template placeholder', () => {
    const offenders: string[] = [];
    for (const file of ROOTS.flatMap(sourceFiles)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (/(?:^|[\s'"`:])-?[a-z-]+-\[[^\]\s]*\$\{/.test(line)) {
          offenders.push(`${file.replace(join(__dirname, '../../../../../..'), '')}:${index + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
