/**
 * Builds the "weak listing" fixture photos: dark, tilted, low-contrast derivatives of the
 * credited showcase stock, so the contact sheet stresses photo scrims and ranking.
 * Run: bun scripts/marketing/poster-contact-sheet/fixtures/makeWeakPhotos.ts
 */
import sharp from 'sharp';

const SRC = 'ui/public/marketing/ai-studio/samples/showcase';
const OUT = 'ui/public/marketing/ai-studio/samples/fixtures';
const WEAK = [
  { from: '261102', angle: -7, brightness: 0.42 },
  { from: '3209045', angle: 5, brightness: 0.5 },
];

for (const { from, angle, brightness } of WEAK) {
  const rotated = await sharp(`${SRC}/${from}-960.webp`)
    .rotate(angle, { background: '#1b1b1b' })
    .modulate({ brightness, saturation: 0.6 })
    .linear(0.8, 10)
    .resize({ width: 960 })
    .webp({ quality: 70 })
    .toBuffer();
  await sharp(rotated).toFile(`${OUT}/weak-${from}-960.webp`);
}
