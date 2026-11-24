import { describe, expect, it } from 'vitest';

import {
  deriveVoiceSessionView,
  isBusyVoiceView,
  isUrgentVoiceView,
  voiceErrorLabel,
  voiceViewAvatarState,
} from './voiceSessionView';

describe('deriveVoiceSessionView', () => {
  it('prefers the tool lookup over local speech while thinking', () => {
    expect(
      deriveVoiceSessionView({ phase: 'thinking', userSpeaking: true, toolPending: true })
    ).toBe('looking_up');
  });

  it('shows guest speech over listening and assistant speech', () => {
    expect(
      deriveVoiceSessionView({ phase: 'listening', userSpeaking: true, toolPending: false })
    ).toBe('user_speaking');
    expect(
      deriveVoiceSessionView({ phase: 'speaking', userSpeaking: true, toolPending: false })
    ).toBe('user_speaking');
  });

  it('passes lifecycle phases through unchanged', () => {
    for (const phase of [
      'idle',
      'connecting',
      'reconnecting',
      'ending',
      'ended',
      'error',
    ] as const) {
      expect(deriveVoiceSessionView({ phase, userSpeaking: true, toolPending: true })).toBe(phase);
    }
  });
});

describe('voice view presentation', () => {
  it('shows speaking and call end immediately, everything else after a dwell', () => {
    expect(isUrgentVoiceView('speaking')).toBe(true);
    expect(isUrgentVoiceView('ended')).toBe(true);
    expect(isUrgentVoiceView('listening')).toBe(false);
    expect(isUrgentVoiceView('thinking')).toBe(false);
  });

  it('maps views to avatar states and busy rings', () => {
    expect(voiceViewAvatarState('looking_up')).toBe('thinking');
    expect(voiceViewAvatarState('user_speaking')).toBe('listening');
    expect(isBusyVoiceView('looking_up')).toBe(true);
    expect(isBusyVoiceView('speaking')).toBe(false);
  });
});

describe('voiceErrorLabel', () => {
  it('names the microphone problems instead of calling everything a connection issue', () => {
    expect(
      voiceErrorLabel(
        'Microphone access is blocked. Allow microphone access in your browser settings and try again.'
      )
    ).toBe('Microphone blocked');
    expect(voiceErrorLabel('No microphone was found on this device.')).toBe('No microphone');
    expect(voiceErrorLabel('Your microphone is in use by another app. Close it and try again.')).toBe(
      'Microphone busy'
    );
    expect(voiceErrorLabel('Microphone disconnected.')).toBe('Microphone problem');
  });

  it('keeps offline and provider failures distinct', () => {
    expect(
      voiceErrorLabel('You went offline. Continue in text chat when you are back.')
    ).toBe('Offline');
    expect(voiceErrorLabel('Voice service is unavailable. Continue in text chat.')).toBe(
      'Connection issue'
    );
    expect(voiceErrorLabel(null)).toBe('Connection issue');
  });
});
