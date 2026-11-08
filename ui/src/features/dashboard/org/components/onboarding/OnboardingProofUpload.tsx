import { VerificationFieldLabel } from '@/features/dashboard/org/components/onboarding/VerificationFieldLabel';
import {
  VERIFICATION_ACCEPT,
  validateVerificationFile,
} from '@/features/dashboard/org/lib/orgVerification';

import { DocumentUploadDropzone } from '@/components/forms/DocumentUploadDropzone';

type Props = {
  id: string;
  label: string;
  help?: string;
  required?: boolean;
  file: File | null;
  previewUrl: string | null;
  uploading?: boolean;
  error?: string | null;
  /** One-line dropzone instead of a tall box. */
  compact?: boolean;
  onFileChange: (file: File | null, previewUrl: string | null) => void;
};

export function OnboardingProofUpload({
  id,
  label,
  help,
  required = true,
  file,
  previewUrl,
  uploading = false,
  error = null,
  compact = false,
  onFileChange,
}: Props) {
  const handleSelect = (selected: File | undefined) => {
    if (!selected) return;
    const validationError = validateVerificationFile(selected);
    if (validationError) {
      onFileChange(null, null);
      return;
    }
    const nextPreview = selected.type.startsWith('image/') ? URL.createObjectURL(selected) : null;
    onFileChange(selected, nextPreview);
  };

  return (
    <div className="space-y-1.5">
      {help ? (
        <VerificationFieldLabel htmlFor={id} label={label} help={help} required={required} />
      ) : (
        <VerificationFieldLabel
          htmlFor={id}
          label={label}
          help="Upload a clear photo or PDF for verification."
          required={required}
        />
      )}
      <DocumentUploadDropzone
        id={id}
        accept={VERIFICATION_ACCEPT}
        file={file}
        previewUrl={previewUrl}
        uploading={uploading}
        hasError={Boolean(error)}
        compact={compact}
        emptyHint={compact ? 'JPEG, PNG, or PDF · 5 MB' : undefined}
        onFileSelect={handleSelect}
        onClear={() => onFileChange(null, null)}
      />
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
