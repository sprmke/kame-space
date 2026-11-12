import { FileCheck2 } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import type { DocumentRequirement } from '@/features/dashboard/bookings/lib/documentRequirements';
import { DocumentRequirementsListEditor } from '@/features/dashboard/org/components/document-requirements/DocumentRequirementsListEditor';
import { DevelopmentPdfTemplatesSection } from '@/features/dashboard/super-admin/components/super-admin-development-settings/DevelopmentPdfTemplatesSection';
import type { ResidencePdfTemplate } from '@/lib/residence/residenceProfile';

type Props = {
  developmentId: string;
  list: DocumentRequirement[];
  pdfTemplates: ResidencePdfTemplate[];
  disabled?: boolean;
  resolveFieldError?: (fieldId: string) => string | null;
  markFieldInteracted?: (fieldId: string) => void;
  onChange: (next: DocumentRequirement[]) => void;
  onPdfTemplatesChange: (next: ResidencePdfTemplate[]) => void;
};

export function DevelopmentDocumentRequirementsSection({
  developmentId,
  list,
  pdfTemplates,
  disabled = false,
  resolveFieldError,
  markFieldInteracted,
  onChange,
  onPdfTemplatesChange,
}: Props) {
  return (
    <AdminSection
      id="document-requirements"
      title="Document Requirements"
      icon={FileCheck2}
      description="Documents required before a booking reaches Ready for check-in. Applies to all properties in this development."
    >
      <DocumentRequirementsListEditor
        list={list}
        disabled={disabled}
        resolveFieldError={resolveFieldError}
        markFieldInteracted={markFieldInteracted}
        onChange={onChange}
      />
      <DevelopmentPdfTemplatesSection
        developmentId={developmentId}
        templates={pdfTemplates}
        disabled={disabled}
        onChange={onPdfTemplatesChange}
      />
    </AdminSection>
  );
}
