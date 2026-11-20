import { describe, expect, test } from 'bun:test';

import { SELFTEST_PATH_PREFIX, summarizeViolations } from './assert-no-csp-violations.mjs';

function line(directive, blocked, document = 'https://kamespace.com/properties') {
  return JSON.stringify({ directive, blocked, document });
}

describe('summarizeViolations', () => {
  test('an empty file is a pass', () => {
    const { total, groups } = summarizeViolations('');
    expect(total).toBe(0);
    expect(groups.size).toBe(0);
  });

  test('groups by directive and origin and counts every hit', () => {
    const { total, groups } = summarizeViolations(
      [
        line('img-src', 'https://cdn.example'),
        line('img-src', 'https://cdn.example'),
        line('connect-src', 'https://api.example'),
      ].join('\n')
    );
    expect(total).toBe(3);
    expect(groups.get('img-src | https://cdn.example').count).toBe(2);
    expect(groups.get('connect-src | https://api.example').count).toBe(1);
  });

  test('collects the distinct pages a group appears on', () => {
    const { groups } = summarizeViolations(
      [
        line('img-src', 'https://cdn.example', 'https://kamespace.com/a'),
        line('img-src', 'https://cdn.example', 'https://kamespace.com/b'),
        line('img-src', 'https://cdn.example', 'https://kamespace.com/a'),
      ].join('\n')
    );
    expect([...groups.get('img-src | https://cdn.example').pages].sort()).toEqual(['/a', '/b']);
  });

  test('ignores reports from the CSP selftest page, which blocks on purpose', () => {
    const { total, groups } = summarizeViolations(
      [
        line(
          'script-src-elem',
          'https://evil.example/x.js',
          `https://kamespace.com${SELFTEST_PATH_PREFIX}`
        ),
        line('img-src', 'https://cdn.example'),
      ].join('\n')
    );
    expect(total).toBe(1);
    expect([...groups.keys()]).toEqual(['img-src | https://cdn.example']);
  });

  test('keeps a malformed report visible instead of dropping it', () => {
    const { total, groups } = summarizeViolations('not json');
    expect(total).toBe(1);
    expect(groups.has('unparseable-report | (inline/eval)')).toBe(true);
  });

  test('an inline block is labeled, not skipped', () => {
    const { groups } = summarizeViolations(line('script-src', 'inline'));
    expect(groups.has('script-src | inline')).toBe(true);
  });
});
