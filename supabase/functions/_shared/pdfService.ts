import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';
import { createClient } from './supabaseJs.ts';
import { GuestFormData } from './types.ts';
import { applyGafDefaultsToFormData, resolveAppSettings } from './appSettings.ts';
import { applyGafOwnerSignatureBlock } from './gafPdfSignature.ts';
import { applyPetOwnerSignatureBlock } from './petPdfSignature.ts';
import { buildGafPdfFieldMap, buildPetPdfFieldMap } from './gafPdfFields.ts';

async function getTemplateBytes(
  templateName: string = 'guest-form-template.pdf'
): Promise<Uint8Array> {
  console.log(`Fetching PDF template from Supabase Storage: ${templateName}...`);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: templateData, error: downloadError } = await supabase.storage
    .from('templates')
    .download(templateName);

  if (downloadError) {
    console.error('Error downloading template:', downloadError);
    throw new Error(`Failed to download PDF template: ${templateName}`);
  }

  return new Uint8Array(await templateData.arrayBuffer());
}

export async function generatePDF(
  formData: GuestFormData,
  propertyId?: string | null
): Promise<Uint8Array> {
  try {
    console.log('Generating PDF...');
    const templateBytes = await getTemplateBytes();
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    const fd = await applyGafDefaultsToFormData(formData, propertyId);
    const appSettings = await resolveAppSettings(propertyId);

    const fieldMappings: Record<string, string | undefined> = buildGafPdfFieldMap(fd);

    for (const [fieldName, value] of Object.entries(fieldMappings)) {
      try {
        const field = form.getTextField(fieldName);
        if (field) {
          field.setText(value ? String(value) : '');
        }
      } catch (error) {
        console.warn(
          `⚠️ Could not set field "${fieldName}":`,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    await applyGafOwnerSignatureBlock(pdfDoc, {
      unitOwner: fd.unitOwner || appSettings.gafUnitOwner,
      signatureUrl: appSettings.gafUnitOwnerSignatureUrl,
    });

    form.flatten();
    const pdfBytes = await pdfDoc.save();
    console.log('PDF generated successfully');
    return pdfBytes;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
}

export async function generatePetPDF(
  formData: GuestFormData,
  propertyId?: string | null
): Promise<Uint8Array> {
  try {
    console.log('Generating Pet PDF...');
    const templateBytes = await getTemplateBytes('pet-form-template.pdf');
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    const fd = await applyGafDefaultsToFormData(formData, propertyId);
    const appSettings = await resolveAppSettings(propertyId);

    const fieldMappings: Record<string, string | undefined> = buildPetPdfFieldMap(fd);

    for (const [fieldName, value] of Object.entries(fieldMappings)) {
      try {
        const field = form.getTextField(fieldName);
        if (field) {
          field.setText(value ? String(value) : '');
        }
      } catch (error) {
        console.warn(
          `⚠️ Could not set field "${fieldName}":`,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    await applyPetOwnerSignatureBlock(pdfDoc, {
      unitOwner: fd.unitOwner || appSettings.gafUnitOwner,
      signatureUrl: appSettings.gafUnitOwnerSignatureUrl,
    });

    form.flatten();
    const pdfBytes = await pdfDoc.save();
    console.log('Pet PDF generated successfully');
    return pdfBytes;
  } catch (error) {
    console.error('Error generating Pet PDF:', error);
    throw new Error('Failed to generate Pet PDF');
  }
}
