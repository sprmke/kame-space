import * as React from 'react';

import {
  acquireModalLayer,
  MODAL_LAYER_BASE,
  releaseModalLayer,
  resolveModalLayerZ,
} from '@/components/ui/modalLayer';

type ModalLayerOptions = {
  overlayClassName?: string | null;
  contentClassName?: string | null;
};

type ModalLayerResult = {
  overlayZ: number;
  contentZ: number;
  /**
   * Attach to the portalled content node. The layer is acquired only while that
   * node exists, so closed dialogs and sheets mounted in the tree never inflate
   * the global stack (which used to push portalled Selects below the scrim).
   */
  attach: (node: HTMLElement | null) => void;
};

/**
 * Registers this portal (Dialog / Sheet / AlertDialog content) on the global
 * modal stack so nested scrims paint above parent modal surfaces.
 */
export function useModalLayer(opts?: ModalLayerOptions): ModalLayerResult {
  const [auto, setAuto] = React.useState(() => ({
    overlayZ: MODAL_LAYER_BASE,
    contentZ: MODAL_LAYER_BASE + 1,
  }));
  const layerRef = React.useRef<{ id: number } | null>(null);

  const release = React.useCallback(() => {
    if (!layerRef.current) return;
    releaseModalLayer(layerRef.current.id);
    layerRef.current = null;
  }, []);

  const attach = React.useCallback(
    (node: HTMLElement | null) => {
      if (node) {
        if (layerRef.current) return;
        const layer = acquireModalLayer();
        layerRef.current = layer;
        setAuto({ overlayZ: layer.overlayZ, contentZ: layer.contentZ });
        return;
      }
      release();
      setAuto({ overlayZ: MODAL_LAYER_BASE, contentZ: MODAL_LAYER_BASE + 1 });
    },
    [release]
  );

  // Unmounting while open must release the layer too.
  React.useEffect(() => release, [release]);

  const resolved = resolveModalLayerZ({
    autoOverlayZ: auto.overlayZ,
    autoContentZ: auto.contentZ,
    overlayClassName: opts?.overlayClassName,
    contentClassName: opts?.contentClassName,
  });

  return { ...resolved, attach };
}
