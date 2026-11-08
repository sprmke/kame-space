import { FileText, ImagePlus, Loader2 } from 'lucide-react';

import { UploadPreviewActionBar } from '@/components/forms/UploadPreviewActionBar';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  accept: string;
  file: File | null;
  previewUrl: string | null;
  uploading?: boolean;
  hasError?: boolean;
  emptyHint?: string;
  /** One-line row instead of a tall box — for inline uploads inside lists. */
  compact?: boolean;
  onFileSelect: (file: File | undefined) => void;
  onClear: () => void;
};

function isPdfFile(file: File | null, previewUrl: string | null): boolean {
  return (
    file?.type === 'application/pdf' ||
    (previewUrl?.toLowerCase().includes('.pdf') ?? false) ||
    (file?.name.toLowerCase().endsWith('.pdf') ?? false)
  );
}

export function DocumentUploadDropzone({
  id,
  accept,
  file,
  previewUrl,
  uploading = false,
  hasError = false,
  emptyHint = 'JPEG, PNG, WebP, or PDF · max 5 MB',
  compact = false,
  onFileSelect,
  onClear,
}: Props) {
  const isPdf = isPdfFile(file, previewUrl);
  const hasImagePreview = Boolean(previewUrl && !isPdf);
  const hasDocument = Boolean(file || previewUrl);

  return (
    <div
      className={cn(
        'border-border bg-muted/20 relative flex items-center justify-center overflow-hidden rounded-xl border border-dashed',
        compact ? 'min-h-[48px]' : 'min-h-[140px]',
        hasError && 'border-destructive',
        uploading && 'opacity-70'
      )}
    >
      {uploading ? (
        <div
          className={cn(
            'text-muted-foreground flex items-center gap-2 text-sm',
            compact ? 'py-2.5' : 'flex-col gap-2'
          )}
        >
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Uploading…
        </div>
      ) : hasImagePreview ? (
        <>
          <img src={previewUrl!} alt="" className="absolute inset-0 size-full object-cover" />
          <UploadPreviewActionBar inputId={id} onRemove={onClear} />
        </>
      ) : hasDocument ? (
        <>
          <div
            className={cn(
              'flex w-full items-center gap-2 px-3',
              compact ? 'py-2.5' : 'flex-col gap-2 px-4 py-6'
            )}
          >
            <FileText className="text-primary size-4 shrink-0" aria-hidden />
            <p className="text-foreground max-w-full truncate text-[13px] font-medium">
              {file?.name ?? 'Document uploaded'}
            </p>
          </div>
          <UploadPreviewActionBar inputId={id} onRemove={onClear} />
        </>
      ) : (
        <label
          htmlFor={id}
          title={compact ? emptyHint : undefined}
          className={cn(
            'flex w-full cursor-pointer items-center justify-center gap-2 px-3 text-center',
            compact ? 'min-h-[44px] py-2 text-left' : 'min-h-[140px] flex-col gap-2 py-6'
          )}
        >
          <span
            className={cn(
              'bg-primary/10 text-primary flex shrink-0 items-center justify-center rounded-full',
              compact ? 'size-7' : 'size-10'
            )}
          >
            <ImagePlus className={compact ? 'size-3.5' : 'size-5'} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="text-foreground block text-[13px] font-medium leading-tight">
              {compact ? 'Upload proof' : 'Upload'}
            </span>
            {compact ? null : (
              <span className="text-muted-foreground block text-[11px] leading-tight">
                {emptyHint}
              </span>
            )}
          </span>
        </label>
      )}
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          onFileSelect(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
