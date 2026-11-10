/**
 * Fill any AcroForm PDF from a resolved field map.
 *
 * Shared by the Azure generators (through `gafPdfFields.ts`) and by residence templates, so
 * a new building's PDF goes through exactly the code path the two Azure forms already use.
 */

import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

import type { PdfFieldMap } from './gafPdfFields.ts';

export type PdfFieldWarning = { field: string; reason: string };

/**
 * Write `values` into the template and flatten it.
 *
 * A field the PDF does not have (or one typed as a non-text field) is reported, never thrown:
 * a mismatched map should leave a blank field, not fail a booking.
 */
export async function fillPdfTemplateBytes(
  templateBytes: Uint8Array,
  values: PdfFieldMap,
  options: { flatten?: boolean } = {}
): Promise<{ bytes: Uint8Array; warnings: PdfFieldWarning[] }> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const warnings: PdfFieldWarning[] = [];

  for (const [fieldName, value] of Object.entries(values)) {
    try {
      const field = form.getTextField(fieldName);
      if (!field) continue;
      field.setText(value ? String(value) : '');
    } catch (error) {
      warnings.push({
        field: fieldName,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (options.flatten ?? true) form.flatten();
  return { bytes: await pdfDoc.save(), warnings };
}
