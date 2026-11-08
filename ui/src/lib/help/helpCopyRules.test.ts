import { describe, expect, it } from 'vitest';

import { collectHelpCopyViolations } from '@/lib/help/helpCopyRules';

const ICON = () => null;

describe('collectHelpCopyViolations', () => {
  it('passes clean copy', () => {
    expect(
      collectHelpCopyViolations({
        hint: 'Items not marked complete yet.',
        howItWorks: {
          title: 'How pricing works',
          steps: [
            { icon: ICON, title: 'Set a base rate', body: 'Base rate covers a normal night.' },
            { icon: ICON, title: 'Add weekends', body: 'Weekend nights can cost more.' },
            { icon: ICON, title: 'Review', body: 'Check the calendar before you save.' },
          ],
          tip: 'Peak nights are separate.',
          learnMoreHref: '/help/pricing',
        },
      })
    ).toEqual([]);
  });

  it('rejects em dashes and en dashes', () => {
    expect(collectHelpCopyViolations({ hint: 'Waits \u2014 then sends.' })).toEqual([
      'entry.hint: em dash or en dash ("Waits \u2014 then sends.")',
    ]);
    expect(collectHelpCopyViolations({ hint: 'One \u2013 two' })[0]).toContain('em dash or en dash');
  });

  it('rejects empty, whitespace-padded and over-long copy', () => {
    expect(collectHelpCopyViolations({ hint: '' })).toEqual([
      'entry.hint: empty string',
      'entry.hint: required short string',
    ]);
    expect(collectHelpCopyViolations({ hint: '  padded  ' })).toContain(
      'entry.hint: leading or trailing whitespace'
    );
    expect(collectHelpCopyViolations({ hint: 'x'.repeat(201) })).toEqual([
      'entry.hint: 201 characters, max 200',
    ]);
  });

  it('does not length-cap a learn more href', () => {
    const href = `/${'a'.repeat(300)}`;
    expect(collectHelpCopyViolations({ learnMoreHref: href })).toEqual([]);
  });

  it('rejects the AI-tell phrases banned by the copy rule', () => {
    const problems = collectHelpCopyViolations({
      hint: 'Seamlessly leverage every tool to unlock growth.',
    });
    expect(problems.join('\n')).toContain('banned phrase "seamlessly"');
    expect(problems.join('\n')).toContain('banned phrase "leverage"');
    expect(problems.join('\n')).toContain('banned phrase "unlock"');
  });

  it('requires 3 or 4 how-it-works steps', () => {
    const two = collectHelpCopyViolations({
      howItWorks: {
        title: 'How it works',
        steps: [
          { icon: ICON, title: 'A', body: 'a' },
          { icon: ICON, title: 'B', body: 'b' },
        ],
      },
    });
    expect(two).toContain('entry.howItWorks.steps: expected 3 or 4 steps, got 2');
  });

  it('requires an icon, title and body on every step', () => {
    const problems = collectHelpCopyViolations({
      howItWorks: {
        title: 'How it works',
        steps: [
          { title: 'No icon', body: 'b' },
          { icon: ICON, title: '  ', body: 'b' },
          { icon: ICON, title: 'No body', body: '' },
        ],
      },
    });
    expect(problems).toContain('entry.howItWorks.steps[0].icon: missing Lucide icon');
    expect(problems).toContain('entry.howItWorks.steps[1].title: required short string');
    expect(problems).toContain('entry.howItWorks.steps[2].body: required short string');
  });

  it('walks arrays and nested objects, reporting the failing path', () => {
    const problems = collectHelpCopyViolations({
      cards: [{ hint: 'fine' }, { hint: 'bad \u2014 copy' }],
    });
    expect(problems).toEqual([
      'entry.cards[1].hint: em dash or en dash ("bad \u2014 copy")',
    ]);
  });

  it('ignores non-copy values such as icon components', () => {
    expect(collectHelpCopyViolations({ hint: 'Ok.', icon: ICON, count: 3 })).toEqual([]);
  });
});
