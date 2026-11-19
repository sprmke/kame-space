import { describe, expect, it, vi } from 'vitest';

import { blockedOriginOf, installCspViolationReporter } from './cspViolationReporter';

function harness() {
  let handler: ((event: Event) => void) | undefined;
  const target = {
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      handler = listener as (event: Event) => void;
    },
  };
  const capture = vi.fn();
  installCspViolationReporter(target, capture);
  const fire = (effectiveDirective: string, blockedURI: string, disposition = 'enforce') =>
    handler!({ effectiveDirective, blockedURI, disposition } as unknown as Event);
  return { capture, fire };
}

describe('blockedOriginOf', () => {
  it('keeps the origin only and drops path and query', () => {
    expect(blockedOriginOf('https://cdn.example.com/a/b.js?token=secret')).toBe(
      'https://cdn.example.com'
    );
  });

  it('names the non-URL sources', () => {
    expect(blockedOriginOf('')).toBe('inline');
    expect(blockedOriginOf('inline')).toBe('inline');
    expect(blockedOriginOf('eval')).toBe('eval');
    expect(blockedOriginOf('data:image/png;base64,AAAA')).toBe('data');
    expect(blockedOriginOf('blob:https://kamespace.com/abc')).toBe('blob');
    expect(blockedOriginOf('not a url')).toBe('unknown');
  });
});

describe('installCspViolationReporter', () => {
  it('reports a violation with the directive and origin, never the path', () => {
    const { capture, fire } = harness();
    fire('frame-src', 'https://abc.supabase.co/storage/v1/object/sign/x.pdf?token=secret');
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith({
      directive: 'frame-src',
      blocked: 'https://abc.supabase.co',
      disposition: 'enforce',
    });
    expect(JSON.stringify(capture.mock.calls)).not.toContain('token');
  });

  it('sends one event per distinct directive and origin', () => {
    const { capture, fire } = harness();
    fire('img-src', 'https://a.example/1.png');
    fire('img-src', 'https://a.example/2.png');
    fire('img-src', 'https://b.example/1.png');
    fire('connect-src', 'https://a.example/x');
    expect(capture).toHaveBeenCalledTimes(3);
  });

  it('stops after ten distinct reports in one page load', () => {
    const { capture, fire } = harness();
    for (let i = 0; i < 25; i += 1) fire('img-src', `https://host${i}.example/x.png`);
    expect(capture).toHaveBeenCalledTimes(10);
  });
});
