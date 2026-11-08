import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureError = vi.fn();

vi.mock('@/lib/sentry/capture', () => ({ captureError }));

type Listener = (event: MessageEvent) => void;

function fakeServiceWorker() {
  const listeners: Listener[] = [];
  return {
    listeners,
    addEventListener: vi.fn((_type: string, listener: Listener) => {
      listeners.push(listener);
    }),
    emit(data: unknown) {
      for (const listener of listeners) listener({ data } as MessageEvent);
    },
  };
}

async function loadBridge() {
  vi.resetModules();
  return import('@/lib/sentry/swBridge');
}

describe('installServiceWorkerErrorBridge', () => {
  beforeEach(() => {
    captureError.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does nothing when the browser has no service worker', async () => {
    vi.stubGlobal('navigator', {});
    const { installServiceWorkerErrorBridge } = await loadBridge();

    expect(() => installServiceWorkerErrorBridge()).not.toThrow();
  });

  it('captures a relayed service worker error with a stable fingerprint', async () => {
    const worker = fakeServiceWorker();
    vi.stubGlobal('navigator', { serviceWorker: worker });
    const { installServiceWorkerErrorBridge } = await loadBridge();

    installServiceWorkerErrorBridge();
    worker.emit({
      type: 'gfm:sw-error',
      handler: 'push',
      message: 'boom',
      stack: 'at push (sw.js:1:2)',
    });

    const [error, options] = captureError.mock.calls[0] ?? [];
    expect((error as Error).message).toBe('Service worker (push): boom');
    expect((error as Error).stack).toBe('at push (sw.js:1:2)');
    expect(options).toMatchObject({
      tags: { runtime: 'service_worker', sw_handler: 'push' },
      fingerprint: ['service_worker', 'push'],
    });
  });

  it('ignores messages that are not the SW error relay', async () => {
    const worker = fakeServiceWorker();
    vi.stubGlobal('navigator', { serviceWorker: worker });
    const { installServiceWorkerErrorBridge } = await loadBridge();

    installServiceWorkerErrorBridge();
    worker.emit({ type: 'something-else', message: 'nope' });
    worker.emit(undefined);

    expect(captureError).not.toHaveBeenCalled();
  });

  it('falls back to safe labels when the payload is thin', async () => {
    const worker = fakeServiceWorker();
    vi.stubGlobal('navigator', { serviceWorker: worker });
    const { installServiceWorkerErrorBridge } = await loadBridge();

    installServiceWorkerErrorBridge();
    worker.emit({ type: 'gfm:sw-error' });

    const [error, options] = captureError.mock.calls[0] ?? [];
    expect((error as Error).message).toBe('Service worker (unknown): Service worker error');
    expect(options).toMatchObject({ fingerprint: ['service_worker', 'unknown'] });
  });

  it('installs one listener even when called repeatedly', async () => {
    const worker = fakeServiceWorker();
    vi.stubGlobal('navigator', { serviceWorker: worker });
    const { installServiceWorkerErrorBridge } = await loadBridge();

    installServiceWorkerErrorBridge();
    installServiceWorkerErrorBridge();

    expect(worker.addEventListener).toHaveBeenCalledTimes(1);
  });
});
