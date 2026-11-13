import { chromium } from 'playwright';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { actions } from './motion.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(process.argv[2] || resolve(here, '../../.artifacts/mascot-gestures'));
const frames = resolve(output, 'gesture-frames');
await mkdir(frames, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.argv[3] || 'http://127.0.0.1:4318');
  await page.waitForFunction(() => window.kamePreview?.ready);
  let frame = 0;
  const fps = 60,
    chapters = [];
  for (const [name, { duration, label }] of Object.entries(actions)) {
    chapters.push({ name, label, start: frame / fps, duration });
    for (let i = 0; i < duration * fps; i++) {
      const png = await page.evaluate(
        ({ name, time }) => {
          window.kamePreview.renderAction(name, time, 1);
          return document.getElementById('mascot').toDataURL('image/png').split(',')[1];
        },
        { name, time: i / fps }
      );
      await writeFile(
        resolve(frames, `${String(frame++).padStart(5, '0')}.png`),
        Buffer.from(png, 'base64')
      );
    }
    console.log(`Rendered ${name}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const result = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-framerate',
      String(fps),
      '-i',
      resolve(frames, '%05d.png'),
      '-filter_complex',
      'color=c=0xeff8f3:s=610x646:r=60[bg];[bg][0:v]overlay=0:0:shortest=1:format=auto,format=yuv420p[v]',
      '-map',
      '[v]',
      '-c:v',
      'libx264',
      '-crf',
      '18',
      '-preset',
      'medium',
      '-movflags',
      '+faststart',
      resolve(output, 'kame-gestures.mp4'),
    ],
    { stdio: 'inherit' }
  );
  if (result.status !== 0) throw new Error('Gesture reel export failed');
  await writeFile(
    resolve(output, 'gesture-chapters.json'),
    JSON.stringify({ fps, frames: frame, duration: frame / fps, chapters }, null, 2) + '\n'
  );
  await rm(frames, { recursive: true });
  console.log(`Exported ${frame} frames to ${output}`);
} finally {
  await browser.close();
}
