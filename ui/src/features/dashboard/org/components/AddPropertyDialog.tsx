import { AddEntityDialog } from '@/features/dashboard/org/components/AddEntityDialog';
import type { Property } from '@/features/dashboard/org/types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgSlug: string;
  orgName?: string;
  onCreated?: (property: Property) => void;
};

/** Property-only entry point for the Properties page. */
export function AddPropertyDialog({
  open,
  onOpenChange,
  orgId,
  orgSlug,
  orgName,
  onCreated,
}: Props) {
  return (
    <AddEntityDialog
      open={open}
      onOpenChange={onOpenChange}
      orgId={orgId}
      orgSlug={orgSlug}
      orgName={orgName ?? orgSlug}
      canAddProperty
      canAddParking={false}
      defaultKind="property"
      onPropertyCreated={onCreated}
    />
  );
}
