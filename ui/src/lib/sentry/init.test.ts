import type { Breadcrumb, ErrorEvent } from '@sentry/react';
import { describe, expect, it } from 'vitest';

import {
  isSentryInitialised,
  isSentrySdkEnabled,
  resolveTracePropagationTargets,
  resolveTracesSampleRate,
  scrubBreadcrumb,
  scrubEvent,
} from '@/lib/sentry/init';

describe('resolveTracesSampleRate', () => {
  it('uses an explicit rate when it is a real 0..1 number', () => {
    expect(resolveTracesSampleRate('0.5', 'production')).toBe(0.5);
    expect(resolveTracesSampleRate('0', 'production')).toBe(0);
    expect(resolveTracesSampleRate(' 1 ', 'production')).toBe(1);
  });

  it('ignores a malformed or out-of-range rate', () => {
    for (const raw of ['abc', '-1', '2', '']) {
      expect(resolveTracesSampleRate(raw, 'production')).toBe(0.05);
    }
  });

  it('samples 5% in production, 20% in preview and nothing locally', () => {
    expect(resolveTracesSampleRate(undefined, 'production')).toBe(0.05);
    expect(resolveTracesSampleRate(undefined, 'preview')).toBe(0.2);
    expect(resolveTracesSampleRate(undefined, 'local')).toBe(0);
  });
});

describe('resolveTracePropagationTargets', () => {
  it('narrows to our own edge functions origin', () => {
    expect(resolveTracePropagationTargets('https://abc.supabase.co/functions/v1')).toEqual([
      'https://abc.supabase.co/functions/v1',
    ]);
  });

  it('never propagates to a blank or invalid URL', () => {
    expect(resolveTracePropagationTargets('')).toEqual([]);
    expect(resolveTracePropagationTargets('   ')).toEqual([]);
    expect(resolveTracePropagationTargets('not a url')).toEqual([]);
  });
});

describe('scrubBreadcrumb', () => {
  it('strips capability tokens from url, from and to', () => {
    const scrubbed = scrubBreadcrumb({
      category: 'navigation',
      data: {
        from: 'https://app.test/a?token=secret',
        to: 'https://app.test/b?t=abc&utm_source=fb',
        url: 'https://app.test/c?code=123',
      },
    } as Breadcrumb);

    expect(scrubbed?.data).toEqual({
      from: 'https://app.test/a',
      to: 'https://app.test/b?utm_source=fb',
      url: 'https://app.test/c',
    });
  });

  it('leaves a breadcrumb without data alone', () => {
    const crumb: Breadcrumb = { category: 'console', message: 'hello' };
    expect(scrubBreadcrumb(crumb)).toBe(crumb);
  });
});

describe('scrubEvent', () => {
  it('scrubs request URLs, tenant-safe tags and extra fields', () => {
    const event = {
      request: { url: 'https://app.test/x?token=secret&utm_source=fb' },
      tags: { url: 'https://app.test/y?t=1', surface: 'host_dashboard' },
      extra: { email: 'guest@example.test', note: 'kept', nested: { phone: '0917' } },
      breadcrumbs: [{ data: { url: 'https://app.test/z?code=1' } }, { data: { step: 'ok' } }],
    } as unknown as ErrorEvent;

    const scrubbed = scrubEvent(event);

    expect(scrubbed.request?.url).toBe('https://app.test/x?utm_source=fb');
    expect(scrubbed.tags).toEqual({ url: 'https://app.test/y', surface: 'host_dashboard' });
    expect(scrubbed.extra).toEqual({ note: 'kept', nested: {} });
    expect(scrubbed.breadcrumbs?.[0]?.data).toEqual({ url: 'https://app.test/z' });
    expect(scrubbed.breadcrumbs?.[1]?.data).toEqual({ step: 'ok' });
  });

  it('copes with an event that carries no request, tags, extra or breadcrumbs', () => {
    const event = { message: 'boom' } as ErrorEvent;

    expect(() => scrubEvent(event)).not.toThrow();
    expect(scrubEvent(event)).toBe(event);
  });
});

describe('Sentry enablement', () => {
  it('reports disabled without a DSN, and has not initialised', () => {
    // vitest.setup.ts leaves VITE_SENTRY_DSN unset.
    expect(isSentrySdkEnabled).toBe(false);
    expect(isSentryInitialised()).toBe(false);
  });
});
