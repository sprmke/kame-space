import { describe, expect, test } from 'bun:test';

import { classifyAuthCaptchaProbe, classifyCaptchaProbe } from './lib/captchaProbe.ts';

describe('classifyCaptchaProbe', () => {
  test('a captchaFailed 400 means enforcing', () => {
    const body = JSON.stringify({
      success: false,
      error: 'Human verification failed.',
      captchaFailed: true,
    });
    expect(classifyCaptchaProbe(400, body)).toEqual({ kind: 'enforcing' });
  });

  test('reaching the handler validation means not enforcing', () => {
    const body = JSON.stringify({ success: false, error: 'bookingId is required' });
    const verdict = classifyCaptchaProbe(400, body);
    expect(verdict.kind).toBe('not-enforcing');
    expect(verdict.kind === 'not-enforcing' && verdict.detail).toContain('bookingId is required');
  });

  test('a rate limit is inconclusive, never a pass', () => {
    const body = JSON.stringify({ success: false, rateLimited: true });
    expect(classifyCaptchaProbe(429, body).kind).toBe('inconclusive');
  });

  test('a missing function and a bodyless gateway error are inconclusive', () => {
    expect(classifyCaptchaProbe(404, '{"error":"not found"}').kind).toBe('inconclusive');
    expect(classifyCaptchaProbe(502, '<html>bad gateway</html>').kind).toBe('inconclusive');
  });

  test('an unexpected 500 with a JSON body is treated as not enforcing, not enforcing by accident', () => {
    const verdict = classifyCaptchaProbe(500, JSON.stringify({ success: false, error: 'boom' }));
    expect(verdict.kind).toBe('not-enforcing');
  });

  test('a token-less 200 can never be read as enforcing', () => {
    expect(classifyCaptchaProbe(200, JSON.stringify({ success: true })).kind).toBe('not-enforcing');
  });
});

describe('classifyAuthCaptchaProbe', () => {
  test('captcha_failed means Attack Protection is on', () => {
    const body = JSON.stringify({
      code: 400,
      error_code: 'captcha_failed',
      msg: 'captcha protection: request disallowed (no captcha_token found)',
    });
    expect(classifyAuthCaptchaProbe(400, body)).toEqual({ kind: 'enforcing' });
  });

  test('invalid_credentials means Auth never asked for a token', () => {
    const body = JSON.stringify({
      code: 400,
      error_code: 'invalid_credentials',
      msg: 'Invalid login credentials',
    });
    expect(classifyAuthCaptchaProbe(400, body).kind).toBe('not-enforcing');
  });

  test('rate limits and surprises are inconclusive', () => {
    expect(classifyAuthCaptchaProbe(429, '{"error_code":"over_request_rate_limit"}').kind).toBe(
      'inconclusive'
    );
    expect(classifyAuthCaptchaProbe(500, 'oops').kind).toBe('inconclusive');
    expect(classifyAuthCaptchaProbe(200, '{"access_token":"x"}').kind).toBe('inconclusive');
  });
});
