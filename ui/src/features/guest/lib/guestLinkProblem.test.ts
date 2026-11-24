import { describe, expect, it } from 'vitest';

import { describeGuestLinkProblem } from './guestLinkProblem';

describe('describeGuestLinkProblem', () => {
  it('turns the raw token error into plain guest copy', () => {
    const problem = describeGuestLinkProblem(new Error('Access token required'));
    expect(problem.expired).toBe(true);
    expect(problem.title).toBe('This link has expired');
    // Never leak the server string.
    expect(problem.body).not.toMatch(/token/i);
  });

  it('treats a 401 invalid-link message as expired', () => {
    const problem = describeGuestLinkProblem(new Error('Invalid or expired access link'));
    expect(problem.expired).toBe(true);
  });

  it('keeps a generic, actionable message for anything else', () => {
    const problem = describeGuestLinkProblem(new Error('Internal edge failure 500'));
    expect(problem.expired).toBe(false);
    expect(problem.title).toBe("This page isn't available");
    expect(problem.body).toMatch(/message your host/i);
  });

  it('handles a missing error value', () => {
    expect(describeGuestLinkProblem(undefined).expired).toBe(false);
  });
});
