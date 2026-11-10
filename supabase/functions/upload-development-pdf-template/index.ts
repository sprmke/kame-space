/**
 * upload-development-pdf-template — super admin uploads a residence's building PDF.
 *
 * Reads the AcroForm field names with pdf-lib, rejects a PDF with no fillable fields, and
 * stores the file at an immutable path. The editor then maps each field onto a
 * `PDF_DATA_KEYS` value and saves the definition through `update-development`; a new upload
 * is always a new path, so a booking that already generated a PDF never changes underneath.
 *
 * Trigger:  POST /functions/v1/upload-development-pdf-template (multipart/form-data)
 * Fields:   developmentId, name, file
 * Auth:     super admin only (verify_jwt = false; the allow list is the boundary)
 */

import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import {
  MAX_PDF_TEMPLATE_BYTES,
  readPdfFieldNames,
} from '../_shared/pdfTemplateUpload.ts';

const BUCKET = 'templates';

function slugToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

serveAuthenticated('upload-development-pdf-template', async (req) => {
  requireHttpMethod(req, 'POST');
  const admin = await verifySuperAdminJwt(req);

  const formData = await req.formData();
  const developmentId = String(formData.get('developmentId') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const file = formData.get('file');

  if (!developmentId) return jsonError(req, 'developmentId is required');
  if (!name) return jsonError(req, 'name is required');
  if (!(file instanceof File)) return jsonError(req, 'file is required');
  if (file.size === 0) return jsonError(req, 'file is empty');
  if (file.size > MAX_PDF_TEMPLATE_BYTES) return jsonError(req, 'PDF must be 8 MB or smaller');
  if (file.type && file.type !== 'application/pdf') return jsonError(req, 'File must be a PDF');

  const supabase = createServiceClient();
  const { data: development, error: loadError } = await supabase
    .from('developments')
    .select('id')
    .eq('id', developmentId)
    .maybeSingle();
  if (loadError) {
    console.error('[upload-development-pdf-template]', loadError.message);
    return jsonError(req, 'Failed to load development', 500);
  }
  if (!development) return jsonError(req, 'Development not found', 404);

  const bytes = new Uint8Array(await file.arrayBuffer());

  let fieldNames: string[];
  try {
    fieldNames = await readPdfFieldNames(bytes);
  } catch (error) {
    console.warn('[upload-development-pdf-template] unreadable pdf:', error);
    return jsonError(req, 'That PDF could not be read. Upload an unencrypted PDF.');
  }

  if (fieldNames.length === 0) {
    return jsonError(
      req,
      'That PDF has no fillable form fields. Add the fields in a PDF editor and upload it again.'
    );
  }

  const token = `${Date.now()}-${slugToken(name) || 'template'}`;
  const storagePath = `developments/${developmentId}/pdf-templates/${token}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });

  if (uploadError) {
    console.error('[upload-development-pdf-template] upload failed:', uploadError.message);
    return jsonError(req, 'Failed to store the PDF', 500);
  }

  await logSuperAdminAction(admin, {
    action: 'development.pdf_template_uploaded',
    targetType: 'development',
    targetId: developmentId,
    summary: `Uploaded PDF template "${name}" (${fieldNames.length} fields)`,
    metadata: { storagePath, name, fieldCount: fieldNames.length },
  });

  return jsonSuccess(req, { storagePath, name, fieldNames });
});
