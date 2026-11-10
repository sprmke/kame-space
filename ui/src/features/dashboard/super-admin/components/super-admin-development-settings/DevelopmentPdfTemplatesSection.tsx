import { useRef, useState } from 'react';

import { FileUp, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PDF_DATA_KEYS,
  defaultPdfFieldMap,
  isPdfDataKey,
  pdfDataKeyLabel,
} from '@/lib/residence/pdfDataKeys';
import type { ResidencePdfTemplate } from '@/lib/residence/residenceProfile';

const UNMAPPED = '__unmapped__';

type UploadResponse = {
  storagePath: string;
  name: string;
  fieldNames: string[];
};

type Props = {
  developmentId: string;
  templates: ResidencePdfTemplate[];
  disabled?: boolean;
  onChange: (next: ResidencePdfTemplate[]) => void;
};

/**
 * PDF templates for this residence (plan §5.3).
 *
 * Upload a fillable PDF, then map each AcroForm field onto a `PDF_DATA_KEYS` value. Unmapped
 * fields are allowed and listed; the generator leaves them blank.
 */
export function DevelopmentPdfTemplatesSection({
  developmentId,
  templates,
  disabled = false,
  onChange,
}: Props) {
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error('Choose a PDF first');
      return;
    }
    const templateName = name.trim() || file.name.replace(/\.pdf$/i, '');
    setUploading(true);
    try {
      const body = new FormData();
      body.append('developmentId', developmentId);
      body.append('name', templateName);
      body.append('file', file);
      const result = await callEdgeFunction<UploadResponse>('upload-development-pdf-template', {
        method: 'POST',
        body,
      });

      const next: ResidencePdfTemplate = {
        id: `pdf-${Date.now()}`,
        name: result.name,
        storagePath: result.storagePath,
        fieldMap: defaultPdfFieldMap(result.fieldNames),
        signatureField: null,
        signatureNameField: null,
        version: 1,
      };
      onChange([...templates, next]);
      setName('');
      if (fileRef.current) fileRef.current.value = '';
      toast.success('PDF added. Map its fields below.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const patchTemplate = (index: number, patch: Partial<ResidencePdfTemplate>) => {
    onChange(templates.map((template, i) => (i === index ? { ...template, ...patch } : template)));
  };

  return (
    <div className="border-border/40 mt-5 space-y-4 border-t pt-5">
      <div>
        <p className="text-section-title">PDF templates</p>
        <p className="text-muted-foreground text-xs">
          Fillable PDFs a booking can generate. Upload creates a new file; existing bookings keep
          the copy they were sent.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="dev-pdf-template-name" className="text-muted-foreground text-xs">
            Template name
          </Label>
          <Input
            id="dev-pdf-template-name"
            value={name}
            disabled={disabled || uploading}
            placeholder="e.g. Move-in permit"
            onChange={(event) => setName(event.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dev-pdf-template-file" className="text-muted-foreground text-xs">
            PDF
          </Label>
          <Input
            id="dev-pdf-template-file"
            ref={fileRef}
            type="file"
            accept="application/pdf"
            disabled={disabled || uploading}
            className="h-10"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          disabled={disabled || uploading}
          onClick={() => void handleUpload()}
        >
          <FileUp className="size-4" aria-hidden />
          {uploading ? 'Uploading' : 'Upload'}
        </Button>
      </div>

      {templates.map((template, index) => {
        const fieldNames = Object.keys(template.fieldMap);
        const unmapped = fieldNames.filter(
          (field) => !isPdfDataKey(template.fieldMap[field])
        ).length;

        return (
          <div
            key={template.id}
            className="border-border/40 bg-muted/15 space-y-3 rounded-lg border px-3 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{template.name}</p>
                <p className="text-muted-foreground truncate text-xs">{template.storagePath}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="settings-action"
                disabled={disabled}
                aria-label={`Remove ${template.name}`}
                onClick={() => onChange(templates.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>

            {fieldNames.length === 0 ? (
              <p className="text-muted-foreground text-xs">This PDF has no form fields.</p>
            ) : (
              <div className="space-y-2">
                {fieldNames.map((field) => (
                  <div key={field} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <p className="truncate text-xs leading-9">{field}</p>
                    <Select
                      value={
                        isPdfDataKey(template.fieldMap[field]) ? template.fieldMap[field] : UNMAPPED
                      }
                      disabled={disabled}
                      onValueChange={(value) => {
                        const nextMap = { ...template.fieldMap };
                        if (value === UNMAPPED) delete nextMap[field];
                        else nextMap[field] = value;
                        patchTemplate(index, { fieldMap: nextMap });
                      }}
                    >
                      <SelectTrigger className="h-9" aria-label={`Map ${field} to a guest value`}>
                        <SelectValue placeholder="Not mapped" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNMAPPED}>Not mapped</SelectItem>
                        {PDF_DATA_KEYS.map((key) => (
                          <SelectItem key={key} value={key}>
                            {pdfDataKeyLabel(key)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {unmapped > 0 ? (
                  <p className="text-muted-foreground text-xs">
                    {unmapped} field{unmapped === 1 ? '' : 's'} left blank.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
