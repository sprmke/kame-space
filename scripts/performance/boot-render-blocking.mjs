import { readFileSync } from 'node:fs';

import { chromium } from 'playwright';

const session = JSON.parse(readFileSync('/tmp/session.json', 'utf8'));
const URL = 'https://kamespace.com/org/kame-test-tenant/property/kame-test-property';
const RUNS = Number(process.env.RUNS ?? 2);

const browser = await chromium.launch();
const results = [];

for (let run = 0; run < RUNS; run++) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [
    'sb-fworvijbrwpyngycotbz-auth-token',
    JSON.stringify(session),
  ]);
  await page.addInitScript(() => {
    window.__long = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__long.push({ start: Math.round(entry.startTime), dur: Math.round(entry.duration) });
        }
      }).observe({ entryTypes: ['longtask'] });
    } catch {}
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page
    .waitForFunction(
      () => performance.getEntriesByType('mark').some((m) => m.name === 'route:content'),
      undefined,
      { timeout: 60_000 }
    )
    .catch(() => {});
  await page.waitForTimeout(2500);

  results.push(
    await page.evaluate(() => ({
      marks: Object.fromEntries(
        performance.getEntriesByType('mark').map((m) => [m.name, Math.round(m.startTime)])
      ),
      long: window.__long ?? [],
      paint: Object.fromEntries(
        performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)])
      ),
    }))
  );
  await context.close();
}

await browser.close();

const content = results.map((r) => r.marks['route:content'] ?? 0);
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`route:content: ${content.join(', ')} (median ${median(content)})`);
console.log('marks (run 1):', JSON.stringify(results[0].marks));
console.log('paint (run 1):', JSON.stringify(results[0].paint));

for (const [i, r] of results.entries()) {
  const long = r.long.filter((t) => t.dur >= 50);
  const total = long.reduce((s, t) => s + t.dur, 0);
  console.log(`\nrun ${i + 1}: ${long.length} long tasks >=50ms, ${total} ms total blocking`);
  for (const t of long.slice(0, 8)) console.log(`   ${String(t.start).padStart(5)} ms  ${t.dur} ms`);
}
