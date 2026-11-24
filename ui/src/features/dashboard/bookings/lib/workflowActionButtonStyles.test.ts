import { describe, expect, it } from 'vitest';

import {
  workflowPrimaryActionClass,
  workflowWarningActionClass,
  workflowDestructiveActionClass,
  workflowNeutralActionClass,
  workflowBackActionClass,
  workflowActionLabelGroupClass,
  workflowActionLabelTextClass,
  workflowActionLabelTextPairedClass,
  workflowActionPairItemClass,
  workflowActionPairLayoutClass,
  workflowInlineLink,
} from '@/features/dashboard/bookings/lib/workflowActionButtonStyles';

describe('workflowPrimaryActionClass', () => {
  it('workflowPrimaryActionClass is exported', () => {
    expect(typeof workflowPrimaryActionClass).toBe('function');
  });
});

describe('workflowWarningActionClass', () => {
  it('workflowWarningActionClass is exported', () => {
    expect(typeof workflowWarningActionClass).toBe('function');
  });
});

describe('workflowDestructiveActionClass', () => {
  it('workflowDestructiveActionClass is exported', () => {
    expect(typeof workflowDestructiveActionClass).toBe('function');
  });
});

describe('workflowNeutralActionClass', () => {
  it('workflowNeutralActionClass is exported', () => {
    expect(typeof workflowNeutralActionClass).toBe('function');
  });
});

describe('workflowBackActionClass', () => {
  it('is defined', () => {
    expect(workflowBackActionClass).toBeDefined();
  });
});

describe('workflowActionLabelGroupClass', () => {
  it('is defined', () => {
    expect(workflowActionLabelGroupClass).toBeDefined();
  });
});

describe('workflowActionLabelTextClass', () => {
  it('is defined', () => {
    expect(workflowActionLabelTextClass).toBeDefined();
  });
});

describe('workflowActionLabelTextPairedClass', () => {
  it('allows the label to wrap so a narrow rail never clips it', () => {
    expect(workflowActionLabelTextPairedClass).not.toContain('whitespace-nowrap');
    expect(workflowActionLabelTextPairedClass).toContain('text-pretty');
  });
});

describe('workflowActionPairLayoutClass', () => {
  it('uses a wrapping flex row when both actions show', () => {
    const paired = workflowActionPairLayoutClass(true);
    expect(paired).toContain('flex-wrap');
    expect(paired).not.toContain('grid-cols-2');
  });

  it('stacks when a single action shows', () => {
    expect(workflowActionPairLayoutClass(false)).toContain('flex-col');
  });

  it('gives each cell a basis that forces a wrap below ~22rem', () => {
    expect(workflowActionPairItemClass).toContain('basis-[11rem]');
    expect(workflowActionPairItemClass).toContain('min-w-0');
  });
});

describe('workflowInlineLink', () => {
  it('is defined', () => {
    expect(workflowInlineLink).toBeDefined();
  });
});
