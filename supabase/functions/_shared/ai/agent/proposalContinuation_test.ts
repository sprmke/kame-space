import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  type ProposalContinuationInput,
  shouldKeepGatheringAfterProposal,
} from './proposalContinuation.ts';

const base: ProposalContinuationInput = {
  hasProposal: true,
  shortCircuit: false,
  planApprovalEnabled: true,
  turnHasMultipleIntents: true,
  openDeclaredGoals: 0,
  hasRoomForAnotherRound: true,
};

Deno.test('multi-ask turn keeps gathering after the first proposal', () => {
  assertEquals(shouldKeepGatheringAfterProposal(base), true);
});

Deno.test('an open declared goal keeps gathering even when intent counting saw one ask', () => {
  assertEquals(
    shouldKeepGatheringAfterProposal({
      ...base,
      turnHasMultipleIntents: false,
      openDeclaredGoals: 1,
    }),
    true
  );
});

Deno.test('a single-ask turn stops on its first proposal (no extra round)', () => {
  assertEquals(
    shouldKeepGatheringAfterProposal({
      ...base,
      turnHasMultipleIntents: false,
      openDeclaredGoals: 0,
    }),
    false
  );
});

Deno.test('plan_approval kill switch off falls back to stopping on the first proposal', () => {
  assertEquals(shouldKeepGatheringAfterProposal({ ...base, planApprovalEnabled: false }), false);
});

Deno.test('no room left (round cap, tokens, deadline or credits) stops the loop', () => {
  assertEquals(shouldKeepGatheringAfterProposal({ ...base, hasRoomForAnotherRound: false }), false);
});

Deno.test('a short-circuited round or a turn without a proposal never continues here', () => {
  assertEquals(shouldKeepGatheringAfterProposal({ ...base, shortCircuit: true }), false);
  assertEquals(shouldKeepGatheringAfterProposal({ ...base, hasProposal: false }), false);
});
