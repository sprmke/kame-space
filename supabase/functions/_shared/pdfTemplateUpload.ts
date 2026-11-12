/**
 * Read an uploaded building PDF's AcroForm field names.
 *
 * The super-admin editor maps those names onto `PDF_DATA_KEYS`; nothing here knows about
 * GAF or pet, so a residence can bring any fillable form.
 */

import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

/** Upload ceiling. The templates we ship are under 500 KB; this is generous, not a target. */
export const MAX_PDF_TEMPLATE_BYTES = 8 * 1024 * 1024;

/** Every AcroForm field name in the document, in document order. */
export async function readPdfFieldNames(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
  return doc
    .getForm()
    .getFields()
    .map((field) => field.getName());
}
