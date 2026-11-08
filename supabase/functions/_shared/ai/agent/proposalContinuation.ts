/**
 * Phase 3 determinism (docs/workflow/in-progress/agentic-ai-assistants.md): after a write is
 * proposed for host approval, should the dashboard turn loop run another round so the model can
 * propose the rest of a multi-ask message onto the same plan card?
 *
 * Only when plan cards are allowed, the turn actually has more to do (2+ asks, or a declared
 * `plan_task` goal still open), and there is room for another round. A single-ask turn stops on
 * its first proposal, so it never pays for an extra round.
 */
export type ProposalContinuationInput = {
  hasProposal: boolean;
  /** respond_with_blocks or a deterministic refusal already ended the round. */
  shortCircuit: boolean;
  planApprovalEnabled: boolean;
  turnHasMultipleIntents: boolean;
  openDeclaredGoals: number;
  /** Room left: round cap, history token budget, wall-clock deadline, credit ceiling. */
  hasRoomForAnotherRound: boolean;
};

export function shouldKeepGatheringAfterProposal(input: ProposalContinuationInput): boolean {
  return (
    input.hasProposal &&
    !input.shortCircuit &&
    input.planApprovalEnabled &&
    (input.turnHasMultipleIntents || input.openDeclaredGoals > 0) &&
    input.hasRoomForAnotherRound
  );
}

/**
 * Model-facing note on a proposal's functionResponse when the turn keeps going after it: the
 * write is queued for the host, so the model should propose the rest now, or stop. Never shown
 * to the host.
 */
export const PROPOSAL_QUEUED_NOTE =
  'Queued for the host to approve on the plan card. Nothing has run yet. Do not propose this again. ' +
  'If the host asked for other changes in this message, propose each of them now. If nothing else ' +
  'was asked, reply with one short line and no tool calls.';
