import * as React from 'react';

import {
  acquireModalLayer,
  MODAL_LAYER_BASE,
  releaseModalLayer,
  resolveModalLayerZ,
} from '@/components/ui/modalLayer';

/**
 * Registers this portal (Dialog / Sheet / AlertDialog content) on the global
 * modal stack so nested scrims paint above parent modal surfaces.
 */
export function useModalLayer(opts?: {
  overlayClassName?: string | null;
  contentClassName?: string | null;
}): { overlayZ: number; contentZ: number } {
  const [auto, setAuto] = React.useState(() => ({
    overlayZ: MODAL_LAYER_BASE,
    contentZ: MODAL_LAYER_BASE + 1,
  }));

  React.useLayoutEffect(() => {
    const layer = acquireModalLayer();
    setAuto({ overlayZ: layer.overlayZ, contentZ: layer.contentZ });
    return () => releaseModalLayer(layer.id);
  }, []);

  return resolveModalLayerZ({
    autoOverlayZ: auto.overlayZ,
    autoContentZ: auto.contentZ,
    overlayClassName: opts?.overlayClassName,
    contentClassName: opts?.contentClassName,
  });
}
