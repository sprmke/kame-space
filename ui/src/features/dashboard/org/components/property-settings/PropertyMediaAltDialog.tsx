import { useEffect, useState } from 'react';

import type { PropertyMediaItem } from '@/features/dashboard/org/lib/propertySettingsConstants';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';

/** Same soft cap as the edge normalizer (`MAX_PROPERTY_MEDIA_ALT`). */
const MAX_ALT = 200;

type Props = {
  item: PropertyMediaItem | null;
  open: boolean;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (itemId: string, alt: string) => Promise<void> | void;
};

/**
 * Alt text for one photo. Search engines and screen readers use it, and a host-written line
 * always beats a generated description. Rides the existing gallery save path, so no new
 * endpoint and no new activity event.
 */
export function PropertyMediaAltDialog({ item, open, saving, onOpenChange, onSave }: Props) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) return;
    setValue(item?.alt ?? '');
  }, [open, item?.id, item?.alt]);

  const trimmed = value.trim();
  const dirty = open && trimmed !== (item?.alt ?? '').trim();

  const { onOpenChange: handleOpenChange, requestClose, dialogProps } = useGuardedClose({
    open,
    onOpenChange,
    isDirty: dirty,
    onSave: () => {
      if (!item) return false;
      return onSave(item.id, trimmed);
    },
  });

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Alt text</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              Describe the photo for guests who cannot see it.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <Input
            autoFocus
            value={value}
            maxLength={MAX_ALT}
            placeholder="Studio with a balcony facing the pool"
            onChange={(event) => setValue(event.target.value)}
            aria-label="Alt text"
          />

          <ResponsiveModalFooter>
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!dirty || saving}
              onClick={() => item && void onSave(item.id, trimmed)}
            >
              Save
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
