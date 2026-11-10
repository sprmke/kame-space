import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildGafRequestSubject,
  buildPetRequestSubject,
  buildReadyForCheckinSubject,
  urgentEmailSubjectPrefix,
} from './workflowEmailSubjects.ts';

const BASE = {
  unitLabel: 'Monaco 2604',
  displayCheckInDate: 'Mar 14, 2027',
  displayCheckOutDate: 'Mar 17, 2027',
};

Deno.test('GAF subject: unit, request name and date range', () => {
  assertEquals(
    buildGafRequestSubject({ ...BASE, isUrgent: false, isUpdate: false }),
    'Monaco 2604 - GAF Request (Mar 14, 2027 to Mar 17, 2027)'
  );
});

Deno.test('GAF subject: urgent and update prefixes stack in that order', () => {
  assertEquals(
    buildGafRequestSubject({ ...BASE, isUrgent: true, isUpdate: false }),
    '🚨 URGENT - Monaco 2604 - GAF Request (Mar 14, 2027 to Mar 17, 2027)'
  );
  assertEquals(
    buildGafRequestSubject({ ...BASE, isUrgent: false, isUpdate: true }),
    'UPDATED - Monaco 2604 - GAF Request (Mar 14, 2027 to Mar 17, 2027)'
  );
  assertEquals(
    buildGafRequestSubject({ ...BASE, isUrgent: true, isUpdate: true }),
    '🚨 URGENT - UPDATED - Monaco 2604 - GAF Request (Mar 14, 2027 to Mar 17, 2027)'
  );
});

Deno.test('pet subject: says Pet Request, never GAF', () => {
  const subject = buildPetRequestSubject({ ...BASE, isUrgent: false, isUpdate: false });
  assertEquals(subject, 'Monaco 2604 - Pet Request (Mar 14, 2027 to Mar 17, 2027)');
  assertEquals(subject.includes('GAF'), false);
});

Deno.test('ready-for-check-in subject is guest-facing: no urgent prefix exists', () => {
  assertEquals(
    buildReadyForCheckinSubject(BASE),
    'Monaco 2604 - Check-in Details (Mar 14, 2027 to Mar 17, 2027)'
  );
});

Deno.test('urgent prefix is empty unless the stay is today', () => {
  assertEquals(urgentEmailSubjectPrefix(false), '');
  assertEquals(urgentEmailSubjectPrefix(true), '🚨 URGENT - ');
});
