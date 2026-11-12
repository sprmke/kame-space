#!/usr/bin/env node
/**
 * Residence Profile drift check.
 *
 * `supabase/functions/_shared/residenceProfile.ts` and
 * `ui/src/lib/residence/residenceProfile.ts` must contain the same shared core. The block
 * between `#region shared-core` and `#endregion shared-core` is compared byte for byte, so
 * a change to one side without the other fails CI (plan §4.8).
 *
 * Usage: node scripts/dev/check-residence-profile-drift.mjs
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const EDGE = 'supabase/functions/_shared/residenceProfile.ts';
const UI = 'ui/src/lib/residence/residenceProfile.ts';

const START = '// #region shared-core';
const END = '// #endregion shared-core';

export function extractCore(source, label) {
  const start = source.indexOf(START);
  const end = source.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    return { error: `${label} is missing the ${START} / ${END} markers` };
  }
  return { core: source.slice(start, end + END.length) };
}

function describeDifference(left, right) {
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  const length = Math.max(leftLines.length, rightLines.length);
  const hints = [];
  for (let i = 0; i < length; i += 1) {
    if (leftLines[i] !== rightLines[i]) {
      hints.push(`  line ${i + 1}`);
      hints.push(`    edge: ${JSON.stringify(leftLines[i] ?? '<missing>')}`);
      hints.push(`    ui:   ${JSON.stringify(rightLines[i] ?? '<missing>')}`);
      if (hints.length >= 15) break;
    }
  }
  return hints.join('\n');
}

function main() {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '../..');

  for (const relative of [EDGE, UI]) {
    if (!existsSync(join(root, relative))) {
      console.error(`Missing ${relative}. Both halves of the mirrored module are required.`);
      process.exit(1);
    }
  }

  const edgeCore = extractCore(readFileSync(join(root, EDGE), 'utf8'), EDGE);
  if (edgeCore.error) {
    console.error(edgeCore.error);
    process.exit(1);
  }
  const uiCore = extractCore(readFileSync(join(root, UI), 'utf8'), UI);
  if (uiCore.error) {
    console.error(uiCore.error);
    process.exit(1);
  }

  if (edgeCore.core !== uiCore.core) {
    console.error('Residence Profile drift: the shared core differs between edge and UI.\n');
    console.error(describeDifference(edgeCore.core, uiCore.core));
    console.error(
      '\nFix: edit the edge file, then copy the block from `// #region shared-core` to the end into the UI file. Both sides ship together.'
    );
    process.exit(1);
  }

  console.log('OK — residence profile shared core is identical on edge and UI.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
