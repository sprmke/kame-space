import { afterEach, describe, expect, it } from 'vitest';

import {
  acquireModalLayer,
  MODAL_LAYER_BASE,
  MODAL_LAYER_STEP,
  parseTailwindZIndex,
  releaseModalLayer,
  resetModalLayerStackForTests,
  resolveModalLayerZ,
} from './modalLayer';

afterEach(() => {
  resetModalLayerStackForTests();
});

describe('modalLayer', () => {
  it('assigns rising overlay/content pairs per open layer', () => {
    const first = acquireModalLayer();
    expect(first.overlayZ).toBe(MODAL_LAYER_BASE);
    expect(first.contentZ).toBe(MODAL_LAYER_BASE + 1);

    const second = acquireModalLayer();
    expect(second.overlayZ).toBe(MODAL_LAYER_BASE + MODAL_LAYER_STEP);
    expect(second.contentZ).toBe(MODAL_LAYER_BASE + MODAL_LAYER_STEP + 1);

    releaseModalLayer(first.id);
    releaseModalLayer(second.id);
  });

  it('keeps a nested layer above a surviving parent after an earlier sibling closes', () => {
    const parent = acquireModalLayer();
    const child = acquireModalLayer();
    releaseModalLayer(parent.id);

    const next = acquireModalLayer();
    expect(next.overlayZ).toBeGreaterThan(child.overlayZ);

    releaseModalLayer(child.id);
    releaseModalLayer(next.id);
  });

  it('resets depth when every layer has closed', () => {
    const a = acquireModalLayer();
    const b = acquireModalLayer();
    releaseModalLayer(a.id);
    releaseModalLayer(b.id);

    const again = acquireModalLayer();
    expect(again.overlayZ).toBe(MODAL_LAYER_BASE);
    releaseModalLayer(again.id);
  });

  it('parses Tailwind z-[N]', () => {
    expect(parseTailwindZIndex('z-[102]')).toBe(102);
    expect(parseTailwindZIndex('fixed inset-0 z-[150] modal-scrim')).toBe(150);
    expect(parseTailwindZIndex('z-50')).toBeNull();
    expect(parseTailwindZIndex(undefined)).toBeNull();
  });

  it('uses the higher of auto layer and explicit floors', () => {
    expect(
      resolveModalLayerZ({
        autoOverlayZ: 100,
        autoContentZ: 101,
        overlayClassName: 'z-[150]',
        contentClassName: 'z-[151]',
      })
    ).toEqual({ overlayZ: 150, contentZ: 151 });

    expect(
      resolveModalLayerZ({
        autoOverlayZ: 110,
        autoContentZ: 111,
        overlayClassName: 'z-[102]',
        contentClassName: 'z-[103]',
      })
    ).toEqual({ overlayZ: 110, contentZ: 111 });
  });
});
