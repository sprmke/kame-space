import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  mergeDocumentRequirements,
  parseDocumentRequirements,
  requirementApplies,
} from './documentRequirements.ts';

const AZURE_LIST = [
  {
    id: 'gaf',
    label: 'GAF Request',
    order: 1,
    pdfTemplateId: 'gaf',
    approvalSource: 'email-listener',
    triggerCondition: 'always',
    calendarIcon: null,
  },
  {
    id: 'pet',
    label: 'Pet Approval',
    order: 2,
    pdfTemplateId: 'pet',
    approvalSource: 'email-listener',
    triggerCondition: 'has_pets',
    calendarIcon: '🐶',
  },
];

Deno.test('mergeDocumentRequirements: no list means no building approvals (F1)', () => {
  assertEquals(mergeDocumentRequirements(undefined), []);
  assertEquals(mergeDocumentRequirements(null), []);
  assertEquals(mergeDocumentRequirements([]), []);
});

Deno.test('mergeDocumentRequirements: malformed input degrades to an empty list', () => {
  assertEquals(mergeDocumentRequirements('nope'), []);
  assertEquals(mergeDocumentRequirements({ id: 'gaf' }), []);
  assertEquals(mergeDocumentRequirements([{ id: 'x' }, null, 3]), []);
});

Deno.test('parseDocumentRequirements: keeps a valid list ordered by order', () => {
  const parsed = parseDocumentRequirements([...AZURE_LIST].reverse());
  assertEquals(parsed?.map((entry) => entry.id), ['gaf', 'pet']);
  assertEquals(parsed?.[1]?.calendarIcon, '🐶');
});

Deno.test('parseDocumentRequirements: rejects a non-array', () => {
  assertEquals(parseDocumentRequirements(undefined), null);
  assertEquals(parseDocumentRequirements('gaf'), null);
});

Deno.test('requirementApplies: trigger conditions read booking flags', () => {
  const [gaf, pet] = mergeDocumentRequirements(AZURE_LIST);
  assertEquals(requirementApplies(gaf, {}), true);
  assertEquals(requirementApplies(pet, {}), false);
  assertEquals(requirementApplies(pet, { has_pets: true }), true);
  assertEquals(requirementApplies(pet, { has_pets: 'true' }), true);
  assertEquals(requirementApplies(pet, { has_pets: false }), false);
});
