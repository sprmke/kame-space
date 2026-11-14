/**
 * test: N/A — decodes an image with a browser canvas. The maths it feeds is covered
 * by `posterPixelAudit.test.ts`.
 */
import type { PolotnoDesignDocument } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import {
  auditRenderedPixels,
  type PixelAuditIssue,
  type PixelTextBox,
} from '@/features/dashboard/marketing/lib/poster/posterPixelAudit';

const SAMPLE_WIDTH = 160;

function textBoxes(document: PolotnoDesignDocument, scale: number): PixelTextBox[] {
  const boxes: PixelTextBox[] = [];
  for (const page of document.pages) {
    for (const child of page.children) {
      if (child.type !== 'text' || typeof child.fill !== 'string') continue;
      const x = Number(child.x);
      const y = Number(child.y);
      const width = Number(child.width);
      const height = Number(child.height);
      if (![x, y, width, height].every(Number.isFinite)) continue;
      boxes.push({
        name: String(child.name ?? child.id),
        x: x * scale,
        y: y * scale,
        width: width * scale,
        height: height * scale,
        color: child.fill,
        fontSize: Number(child.fontSize) * scale,
      });
    }
  }
  return boxes;
}

/** Looks at the finished image. Never throws: a decode failure just yields no issues. */
export async function checkRenderedPoster(
  dataUrl: string,
  document: PolotnoDesignDocument
): Promise<PixelAuditIssue[]> {
  try {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const scale = SAMPLE_WIDTH / document.width;
    const width = SAMPLE_WIDTH;
    const height = Math.max(1, Math.round(document.height * scale));
    const canvas = window.document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return [];
    context.drawImage(image, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    return auditRenderedPixels({ width, height, data }, textBoxes(document, scale));
  } catch {
    return [];
  }
}
