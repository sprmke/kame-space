import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { resolveStoredPdfFieldValues } from './gafPdfFields.ts';
import { fillPdfTemplateBytes } from './pdfTemplateFill.ts';
import type { GuestFormData } from './types.ts';

const TEMPLATE = new URL('../../../ui/public/templates/guest-form-template.pdf', import.meta.url);

function form(): GuestFormData {
  return {
    guestFacebookName: '',
    primaryGuestName: 'Kyle Santos',
    guestEmail: 'kyle@example.test',
    guestPhoneNumber: '0917 555 0134',
    guestAddress: 'Makati City',
    checkInDate: '2027-03-14',
    checkOutDate: '2027-03-17',
    findUs: 'Facebook',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    nationality: 'Filipino',
    numberOfAdults: 2,
    numberOfChildren: 0,
    numberOfNights: 3,
    primaryGuestAge: 32,
    guestRequestsSurpriseDecor: false,
    needParking: false,
    hasPets: false,
    unitOwner: 'Maria Santos',
    towerAndUnitNumber: 'Monaco 2604',
    ownerOnsiteContactPerson: 'Ana Lim',
    ownerContactNumber: '+63 917 123 4567',
  };
}

Deno.test('resolveStoredPdfFieldValues: maps stored keys and skips unknown ones', () => {
  const values = resolveStoredPdfFieldValues(
    { unitOwner: 'property.unitOwner', mystery: 'not.a.key', ' ': 'pet.name' },
    form()
  );

  assertEquals(values.unitOwner, 'Maria Santos');
  assertEquals(values.mystery, undefined);
  assertEquals(Object.keys(values).includes(' '), false);
});

Deno.test('fillPdfTemplateBytes: writes values into a real template', async () => {
  const templateBytes = await Deno.readFile(TEMPLATE);
  const values = resolveStoredPdfFieldValues(
    { unitOwner: 'property.unitOwner', towerAndUnitNumber: 'property.towerAndUnit' },
    form()
  );

  const { bytes, warnings } = await fillPdfTemplateBytes(templateBytes, values, {
    flatten: false,
  });

  assertEquals(warnings, []);
  assert(bytes.byteLength > 0);

  const reloaded = await PDFDocument.load(bytes);
  assertEquals(reloaded.getForm().getTextField('unitOwner').getText(), 'Maria Santos');
  assertEquals(reloaded.getForm().getTextField('towerAndUnitNumber').getText(), 'Monaco 2604');
});

Deno.test('fillPdfTemplateBytes: a field the PDF does not have is reported, not thrown', async () => {
  const templateBytes = await Deno.readFile(TEMPLATE);
  const { warnings } = await fillPdfTemplateBytes(
    templateBytes,
    { notAField: 'anything' },
    { flatten: false }
  );

  assertEquals(warnings.length, 1);
  assertEquals(warnings[0]?.field, 'notAField');
});
