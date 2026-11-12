import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { readPdfFieldNames } from './pdfTemplateUpload.ts';

/**
 * Uses the real GAF template we ship, so the field names here are the ones the generator
 * writes. If the template is replaced, this test is the alarm.
 */
const TEMPLATE = new URL('../../../ui/public/templates/guest-form-template.pdf', import.meta.url);

Deno.test('readPdfFieldNames: reads the shipped GAF template', async () => {
  const fields = await readPdfFieldNames(await Deno.readFile(TEMPLATE));

  assert(fields.length > 20, `expected a fillable form, got ${fields.length} fields`);
  assert(fields.includes('unitOwner'));
  assert(fields.includes('carparkSlotNumber'));
  // Signature widgets are fields too; the editor shows them as mapped or unmapped.
  assert(fields.some((name) => name.startsWith('unitOwnerSignature')));
});

Deno.test('readPdfFieldNames: a PDF without a form has no fields', async () => {
  const fields = await readPdfFieldNames(await Deno.readFile(TEMPLATE));
  assertEquals(new Set(fields).size, fields.length, 'field names must be unique');
});
