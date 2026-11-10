import { useState } from 'react';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { toast } from 'sonner';

import { PropertyMediaPreviewDialog } from '@/features/dashboard/org/components/property-settings/PropertyMediaPreviewDialog';
import {
  AddMediaSlot,
  SortableImageCard,
} from '@/features/dashboard/org/components/property-settings/PropertyMediaUpload';
import {
  formatPropertyMediaSizeLimit,
  validatePropertyMediaFile,
} from '@/features/dashboard/org/lib/propertyMedia';
import type { PropertyMediaItem } from '@/features/dashboard/org/lib/propertySettingsConstants';
import { useUploadParkingMedia } from '@/features/dashboard/parking/hooks/useUploadParkingMedia';
import {
  MAX_PARKING_IMAGES,
  normalizeParkingMediaDraft,
  sequencedParkingMedia,
} from '@/features/dashboard/parking/lib/parkingMedia';

import { cn } from '@/lib/utils';

type ParkingMediaUploadProps = {
  items: PropertyMediaItem[];
  onChange: (items: PropertyMediaItem[]) => void;
  onPersistOrder: (items: PropertyMediaItem[]) => Promise<void>;
  disabled?: boolean;
};

export function ParkingMediaUpload({
  items,
  onChange,
  onPersistOrder,
  disabled = false,
}: ParkingMediaUploadProps) {
  const { upload, remove } = useUploadParkingMedia();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploadingSlotKey, setUploadingSlotKey] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<PropertyMediaItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const images = normalizeParkingMediaDraft(items);
  const isBusy = upload.isPending || remove.isPending || Boolean(uploadingSlotKey);
  const imagePickerEnabled = !disabled && !isBusy && images.length < MAX_PARKING_IMAGES;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const processFiles = async (files: FileList | File[], slotKey?: string) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploadingSlotKey(slotKey ?? `slot-${images.length}`);
    let working = images;
    let uploadedCount = 0;

    for (const file of list) {
      if (working.length >= MAX_PARKING_IMAGES) {
        toast.error(`You can upload up to ${MAX_PARKING_IMAGES} photos`);
        break;
      }

      const validationError = validatePropertyMediaFile(file, 'image', working.length, 0);
      if (validationError) {
        toast.error(validationError);
        continue;
      }

      try {
        const result = await upload.mutateAsync(file);
        working = normalizeParkingMediaDraft(result.media);
        onChange(working);
        uploadedCount += 1;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Upload failed');
        break;
      }
    }

    if (uploadedCount > 0) {
      toast.success(uploadedCount > 1 ? 'Photos uploaded' : 'Photo uploaded');
    }
    setUploadingSlotKey(null);
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>, slotKey: string) => {
    const files = event.target.files;
    if (files?.length) void processFiles(files, slotKey);
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (!imagePickerEnabled) return;
    if (event.dataTransfer.files?.length) void processFiles(event.dataTransfer.files);
  };

  const persistOrder = async (next: PropertyMediaItem[]) => {
    onChange(next);
    try {
      await onPersistOrder(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save photo order');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.findIndex((item) => item.id === active.id);
    const newIndex = images.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    void persistOrder(sequencedParkingMedia(arrayMove(images, oldIndex, newIndex)));
  };

  const handleRemove = async (item: PropertyMediaItem) => {
    setBusyId(item.id);
    try {
      const result = await remove.mutateAsync({
        mediaId: item.id,
        storagePath: item.storagePath,
      });
      onChange(normalizeParkingMediaDraft(result.media));
      toast.success('Photo removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove photo');
    } finally {
      setBusyId(null);
    }
  };

  const openPreview = (item: PropertyMediaItem) => {
    setPreviewItem(item);
    setPreviewOpen(true);
  };

  const slots = Array.from({ length: MAX_PARKING_IMAGES }, (_, index) => images[index] ?? null);

  return (
    <div className="space-y-3">
      <PropertyMediaPreviewDialog
        item={previewItem}
        items={images}
        open={previewOpen}
        onOpenChange={(nextOpen) => {
          setPreviewOpen(nextOpen);
          if (!nextOpen) setPreviewItem(null);
        }}
        onNavigate={setPreviewItem}
      />

      {images.length > 0 ? (
        <p className="text-muted-foreground text-xs sm:text-[13px]">
          Drag to reorder · starred photo is the cover
        </p>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div
          onDrop={handleDrop}
          onDragOver={(event) => {
            event.preventDefault();
            if (imagePickerEnabled) event.dataTransfer.dropEffect = 'copy';
          }}
          className={cn(
            'grid max-w-md grid-cols-3 gap-2.5 sm:gap-3',
            (disabled || isBusy) && 'opacity-60'
          )}
        >
          <SortableContext items={images.map((item) => item.id)} strategy={rectSortingStrategy}>
            {slots.map((item, index) =>
              item ? (
                <SortableImageCard
                  key={item.id}
                  item={item}
                  disabled={disabled}
                  busy={busyId === item.id}
                  reorderDisabled={Boolean(uploadingSlotKey)}
                  onSetPrimary={() => void persistOrder(sequencedParkingMedia(images, item.id))}
                  onRemove={() => void handleRemove(item)}
                  onPreview={() => openPreview(item)}
                />
              ) : (
                <AddMediaSlot
                  key={`parking-photo-slot-${index}`}
                  kind="image"
                  slotKey={`slot-${index}`}
                  enabled={imagePickerEnabled}
                  busy={uploadingSlotKey === `slot-${index}`}
                  onSelected={(event) => handleFileInput(event, `slot-${index}`)}
                />
              )
            )}
          </SortableContext>
        </div>
      </DndContext>

      <p className="text-muted-foreground text-xs tabular-nums">
        {images.length} of {MAX_PARKING_IMAGES} photos · {formatPropertyMediaSizeLimit('image')} max
      </p>
    </div>
  );
}
