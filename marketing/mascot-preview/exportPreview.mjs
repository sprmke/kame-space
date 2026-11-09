import { chromium } from 'playwright';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(process.argv[2] || resolve(here, '../../.artifacts/mascot-preview'));
const url = process.argv[3] || 'http://127.0.0.1:4318';
const frames = resolve(output, 'frames');
await mkdir(frames, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1100 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.kamePreview?.ready);
  const duration = await page.evaluate(() => window.kamePreview.duration);
  for (const width of [375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw new Error(`Horizontal overflow at ${width}`);
  }
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.screenshot({ path: resolve(output, 'desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Play greeting', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('audio').currentTime > 0.15);
  await page.getByRole('button', { name: 'Pause greeting', exact: true }).click();
  const paused = await page.evaluate(() => document.getElementById('audio').currentTime);
  await page.waitForTimeout(150);
  if (
    await page.evaluate(
      (t) => Math.abs(document.getElementById('audio').currentTime - t) > 0.03,
      paused
    )
  )
    throw new Error('Pause did not hold audio clock');
  const stats = await page.evaluate(() => window.kamePreview.alphaStats());
  if (stats.zero === 0 || stats.partial === 0)
    throw new Error('Transparent background or soft alpha edges missing');
  await page.evaluate(() => {
    window.kamePreview.setBackground('dark');
    window.kamePreview.renderAt(0.13);
  });
  await page.screenshot({ path: resolve(output, 'dark.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(output, 'mobile.png'), fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !document.getElementById('motion').checked);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => document.getElementById('motion').checked);
  await page.setViewportSize({ width: 1280, height: 1100 });
  const fps = 30,
    count = Math.ceil((duration + 0.7) * fps);
  const shapes = new Set();
  for (let frame = 0; frame < count; frame++) {
    const result = await page.evaluate((time) => {
      const shape = window.kamePreview.renderAt(time);
      return { shape, png: document.getElementById('mascot').toDataURL('image/png').split(',')[1] };
    }, frame / fps);
    shapes.add(result.shape);
    await writeFile(
      resolve(frames, `${String(frame).padStart(4, '0')}.png`),
      Buffer.from(result.png, 'base64')
    );
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const run = (args) => {
    const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      stdio: 'inherit',
    });
    if (result.status !== 0) throw new Error('ffmpeg export failed');
  };
  const input = [
    '-framerate',
    String(fps),
    '-i',
    resolve(frames, '%04d.png'),
    '-i',
    resolve(here, 'assets/greeting.wav'),
  ];
  run([
    ...input,
    '-filter_complex',
    'color=c=0xeff8f3:s=610x646:r=30[bg];[bg][0:v]overlay=0:0:shortest=1:format=auto,format=yuv420p[v];[1:a]apad[a]',
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-t',
    String(count / fps),
    '-c:v',
    'libx264',
    '-crf',
    '18',
    '-preset',
    'medium',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    resolve(output, 'kame-greeting.mp4'),
  ]);
  run([
    ...input,
    '-vf',
    'pad=610:646:0:0:color=black@0',
    '-c:v',
    'libvpx-vp9',
    '-pix_fmt',
    'yuva420p',
    '-auto-alt-ref',
    '0',
    '-crf',
    '24',
    '-b:v',
    '0',
    '-c:a',
    'libopus',
    '-af',
    'apad',
    '-t',
    String(count / fps),
    resolve(output, 'kame-greeting-alpha.webm'),
  ]);
  await writeFile(
    resolve(output, 'verification.json'),
    JSON.stringify(
      {
        duration,
        frames: count,
        fps,
        mouthShapes: [...shapes],
        alpha: stats,
        viewportWidths: [375, 390, 768, 1024, 1440],
        playback: 'passed',
        pause: 'passed',
        reducedMotion: 'passed',
        pageErrors: errors,
      },
      null,
      2
    )
  );
  await rm(frames, { recursive: true });
  console.log(`Exported ${count} frames, ${shapes.size} mouth shapes. ${output}`);
} finally {
  await browser.close();
}
