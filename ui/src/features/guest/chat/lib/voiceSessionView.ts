import type { ReceptionistAvatarState } from '@/features/guest/chat/components/voice/receptionistAvatarTypes';

import type { VoiceSessionPhase } from './voiceSessionState';

/** What the booth shows. Derived from phase + local VAD + tool state, then held by a dwell. */
export type VoiceSessionView =
  | 'idle'
  | 'connecting'
  | 'reconnecting'
  | 'listening'
  | 'user_speaking'
  | 'thinking'
  | 'looking_up'
  | 'speaking'
  | 'ending'
  | 'ended'
  | 'error';

/** Shortest time a view stays on screen, so one-frame flips never reach the guest. */
export const VOICE_VIEW_MIN_DWELL_MS = 320;

export function deriveVoiceSessionView(input: {
  phase: VoiceSessionPhase;
  userSpeaking: boolean;
  toolPending: boolean;
}): VoiceSessionView {
  const { phase, userSpeaking, toolPending } = input;
  switch (phase) {
    case 'idle':
    case 'connecting':
    case 'reconnecting':
    case 'ending':
    case 'ended':
    case 'error':
      return phase;
    case 'speaking':
      return userSpeaking ? 'user_speaking' : 'speaking';
    case 'thinking':
      if (toolPending) return 'looking_up';
      return userSpeaking ? 'user_speaking' : 'thinking';
    case 'listening':
      return userSpeaking ? 'user_speaking' : 'listening';
  }
}

/** Views that must show immediately: the avatar mouth tracks audio, and call end is final. */
export function isUrgentVoiceView(view: VoiceSessionView): boolean {
  return view === 'speaking' || view === 'ending' || view === 'ended' || view === 'error';
}

export const VOICE_VIEW_LABEL: Record<VoiceSessionView, string> = {
  idle: '',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  listening: 'Listening',
  user_speaking: "You're speaking",
  thinking: 'Thinking…',
  looking_up: 'Looking that up…',
  speaking: 'Speaking',
  ending: 'Ending call…',
  ended: 'Call ended',
  error: 'Connection issue',
};

/**
 * The header must name the real failure. A blocked microphone is not a connection problem, and
 * "Connection issue" on every error teaches guests to ignore the label.
 */
export function voiceErrorLabel(message: string | null | undefined): string {
  const text = (message ?? '').toLowerCase();
  if (text.includes('no microphone')) return 'No microphone';
  if (text.includes('in use by another app')) return 'Microphone busy';
  if (text.includes('blocked') || text.includes('permission')) return 'Microphone blocked';
  if (text.includes('microphone')) return 'Microphone problem';
  if (text.includes('offline')) return 'Offline';
  return 'Connection issue';
}

export function voiceViewAvatarState(view: VoiceSessionView): ReceptionistAvatarState {
  switch (view) {
    case 'connecting':
    case 'reconnecting':
      return 'connecting';
    case 'listening':
    case 'user_speaking':
      return 'listening';
    case 'thinking':
    case 'looking_up':
      return 'thinking';
    case 'speaking':
      return 'speaking';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

/** Orbiting ring arc while the guest is waiting on something. */
export function isBusyVoiceView(view: VoiceSessionView): boolean {
  return (
    view === 'connecting' ||
    view === 'reconnecting' ||
    view === 'thinking' ||
    view === 'looking_up' ||
    view === 'ending'
  );
}

/** Level bars are visible while there is live audio to show. */
export function showsVoiceLevel(view: VoiceSessionView): boolean {
  return view === 'listening' || view === 'user_speaking' || view === 'speaking';
}
