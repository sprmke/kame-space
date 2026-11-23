import { afterEach, describe, expect, it } from 'vitest';

import { inertExcept } from '@/lib/dom/inertExcept';

function build() {
  document.body.innerHTML = `
    <div id="root">
      <header id="header"></header>
      <main id="main"><button id="deep"></button></main>
      <div id="shell">
        <aside id="toasts-wrap"><section id="toasts"><ol></ol></section></aside>
        <nav id="nav"></nav>
      </div>
    </div>`;
  const get = (id: string) => document.getElementById(id)!;
  return { root: get('root'), get };
}

describe('inertExcept', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('makes everything inert except the path to the kept element', () => {
    const { root, get } = build();
    inertExcept(root, get('toasts'));
    expect(get('header').hasAttribute('inert')).toBe(true);
    expect(get('main').hasAttribute('inert')).toBe(true);
    expect(get('nav').hasAttribute('inert')).toBe(true);
    // The kept branch and its ancestors stay live.
    for (const id of ['root', 'shell', 'toasts-wrap', 'toasts']) {
      expect(get(id).hasAttribute('inert')).toBe(false);
    }
  });

  it('undoes only what it changed', () => {
    const { root, get } = build();
    get('nav').setAttribute('inert', '');
    const restore = inertExcept(root, get('toasts'));
    restore();
    expect(get('header').hasAttribute('inert')).toBe(false);
    expect(get('main').hasAttribute('inert')).toBe(false);
    // It was inert before, so it stays that way.
    expect(get('nav').hasAttribute('inert')).toBe(true);
  });

  it('falls back to the whole root when there is nothing to keep', () => {
    const { root } = build();
    const restore = inertExcept(root, null);
    expect(root.hasAttribute('inert')).toBe(true);
    restore();
    expect(root.hasAttribute('inert')).toBe(false);
  });

  it('falls back to the whole root when the kept element is somewhere else', () => {
    const { root } = build();
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    inertExcept(root, outside);
    expect(root.hasAttribute('inert')).toBe(true);
    expect(outside.hasAttribute('inert')).toBe(false);
  });
});
