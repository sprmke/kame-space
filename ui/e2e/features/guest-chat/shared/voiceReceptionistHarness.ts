import { seedSupabaseAuthSession } from '../../../shared/authSeam';
import { E2E_GUEST_USER_ID } from '../../../shared/ids';

import type { Page, Route } from '@playwright/test';

/**
 * Shared mocks for the guest AI voice receptionist.
 *
 * These were extracted from `voiceReceptionistConsent.spec.ts` so the behavioural spec and the
 * slow-motion UI walkthrough (`aiReceptionistWalkthrough.spec.ts`) drive the same fake provider.
 * Nothing here changes production code: the real React panel, `useVoiceSession`, the Gemini
 * Live protocol client, the transcript and the action allowlist all run for real, only the
 * provider socket, microphone and audio graph are faked.
 */

export const VOICE_CHAT_PATH =
  '/properties/solea/messages?checkInDate=2026-10-01&checkOutDate=2026-10-03';

export type VoiceReceptionistMockOptions = {
  liveSession?: boolean;
  providerUnavailable?: boolean;
  maxSessionSeconds?: number;
  /** Hold `voice-receptionist-tool` open so the "Looking that up…" state stays on screen. */
  toolDelayMs?: number;
};

export type LiveBrowserMockOptions = {
  /**
   * Stage a reply instead of the legacy echo: the first typed turn produces a spoken caption,
   * the second produces a slow tool call. Used by the visual walkthrough.
   */
  staged?: boolean;
};

async function fulfillJson(route: Route, data: Record<string, unknown>) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });
}

export async function installVoiceReceptionistMocks(
  page: Page,
  options: VoiceReceptionistMockOptions = {}
) {
  await seedSupabaseAuthSession(page, 'guest');
  await page.addInitScript(() => {
    window.localStorage.removeItem('guest-voice-receptionist-consent-v1');
  });

  await page.route('**/auth/v1/user**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: E2E_GUEST_USER_ID,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'guest@example.com',
        app_metadata: { provider: 'google', providers: ['google'] },
        user_metadata: { full_name: 'E2E Guest' },
      }),
    });
  });

  await page.route('**/functions/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.split('/').pop();
    if (endpoint === 'guest-web-chat-start') {
      await fulfillJson(route, {
        conversationId: '00000000-0000-4000-8000-000000000121',
        property: { id: '00000000-0000-4000-8000-000000000122', slug: 'solea', name: 'Solea' },
        host: {
          organizationName: 'Sample Stays',
          ownerName: 'Host',
          ownerAvatarUrl: null,
        },
        voiceReceptionistEnabled: true,
        stayGuideUrl: null,
      });
      return;
    }
    if (endpoint === 'guest-web-chat-messages') {
      await fulfillJson(route, { messages: [], hasMore: false, replyStatus: 'idle' });
      return;
    }
    if (options.providerUnavailable && endpoint === 'voice-receptionist-start') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Voice receptionist is temporarily unavailable.',
        }),
      });
      return;
    }
    if (options.liveSession && endpoint === 'voice-receptionist-start') {
      await fulfillJson(route, {
        sessionId: '00000000-0000-4000-8000-000000000123',
        ephemeralToken: 'mock-token',
        model: 'gemini-3.8-live',
        voiceId: 'Kore',
        maxSessionSeconds: options.maxSessionSeconds ?? 540,
        protocolVersion: 'gemini-live-v1beta-2026-09',
        webSocketBaseUrl:
          'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained',
        clientSetup: { model: 'models/gemini-3.8-live' },
        lockedSessionConfig: true,
      });
      return;
    }
    if (options.liveSession && endpoint === 'voice-receptionist-session') {
      await fulfillJson(route, { updated: true });
      return;
    }
    if (options.liveSession && endpoint === 'voice-receptionist-tool') {
      if (options.toolDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.toolDelayMs));
      }
      await fulfillJson(route, {
        toolName: 'get_property_facts',
        spokenText: 'The pool closes at 9 PM.',
        actions: [
          { type: 'open_property', label: 'Open property', url: '/properties/solea' },
          { type: 'open_property', label: 'Unsafe', url: 'https://example.com' },
        ],
      });
      return;
    }
    if (options.liveSession && endpoint === 'voice-receptionist-end') {
      await fulfillJson(route, {
        endedAt: '2026-09-23T00:00:00.000Z',
        durationSeconds: 1,
        transitioned: true,
      });
      return;
    }
    await route.continue();
  });
}

/**
 * Fake the Web Audio graph, the microphone and the Gemini Live socket. The fake socket speaks
 * the real protocol envelope, so `useVoiceSession` runs its real setup, transcription, tool and
 * playback paths.
 */
export async function installLiveBrowserMocks(page: Page, options: LiveBrowserMockOptions = {}) {
  await page.addInitScript((staged) => {
    const track = {
      addEventListener: () => undefined,
      stop: () => undefined,
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => Promise.resolve({ getTracks: () => [track] }) },
    });

    // 1x1 silent PCM chunk, enough for the playback queue to schedule a real buffer.
    const silentPcmBase64 =
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

    const mockNode = () => ({
      connect: (target: unknown) => target,
      disconnect: () => undefined,
    });

    class MockAudioBuffer {
      duration: number;
      private readonly channel: Float32Array;
      constructor(length: number, sampleRate: number) {
        this.duration = length / sampleRate;
        this.channel = new Float32Array(length);
      }
      copyToChannel(source: Float32Array) {
        this.channel.set(source.subarray(0, this.channel.length));
      }
    }

    class MockBufferSource {
      buffer: MockAudioBuffer | null = null;
      onended: (() => void) | null = null;
      connect() {}
      disconnect() {}
      start() {
        const ms = Math.max(200, (this.buffer?.duration ?? 0.2) * 1000);
        window.setTimeout(() => this.onended?.(), ms);
      }
      stop() {}
    }

    class MockAudioContext {
      static startedAt = performance.now();
      state = 'running';
      sampleRate = 48_000;
      destination = {};
      audioWorklet = { addModule: () => Promise.resolve() };
      get currentTime() {
        return (performance.now() - MockAudioContext.startedAt) / 1000;
      }
      createMediaStreamSource() {
        return mockNode();
      }
      createBiquadFilter() {
        return { ...mockNode(), type: 'lowpass', frequency: { value: 0 } };
      }
      createAnalyser() {
        return {
          ...mockNode(),
          fftSize: 512,
          getByteTimeDomainData: (buffer: Uint8Array) => buffer.fill(128),
        };
      }
      createBuffer(channels: number, length: number, sampleRate: number) {
        return new MockAudioBuffer(length, sampleRate);
      }
      createBufferSource() {
        return new MockBufferSource();
      }
      resume() {
        return Promise.resolve();
      }
      close() {
        this.state = 'closed';
        return Promise.resolve();
      }
    }

    class MockAudioWorkletNode {
      port: { onmessage: ((event: MessageEvent) => void) | null; close: () => void };
      private timer: number;
      constructor() {
        this.port = { onmessage: null, close: () => window.clearInterval(this.timer) };
        if (staged) {
          // The walkthrough drives `window.__mockMicLevel` to show "You're speaking".
          this.timer = window.setInterval(() => {
            const level = Number(
              (window as unknown as { __mockMicLevel?: number }).__mockMicLevel ?? 0
            );
            this.port.onmessage?.(
              new MessageEvent('message', {
                data: { pcm: new Int16Array(16), rms: level },
              })
            );
          }, 60);
        } else {
          this.timer = window.setInterval(() => undefined, 60_000);
        }
      }
      connect() {}
      disconnect() {}
    }

    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      static voiceInstanceCount = 0;
      readyState = MockWebSocket.CONNECTING;
      instanceNumber: number;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      listeners = new Map<string, Array<(event: Event) => void>>();

      constructor(url: string) {
        const isVoice = url.includes('generativelanguage.googleapis.com');
        if (isVoice) MockWebSocket.voiceInstanceCount += 1;
        this.instanceNumber = isVoice ? MockWebSocket.voiceInstanceCount : 0;
        if (isVoice) {
          document.documentElement.dataset.mockVoiceConnections = String(
            MockWebSocket.voiceInstanceCount
          );
        }
        window.setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          const event = new Event('open');
          this.onopen?.(event);
          for (const listener of this.listeners.get('open') ?? []) listener(event);
        }, 0);
      }

      addEventListener(type: string, listener: (event: Event) => void) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      }

      private emit(payload: unknown) {
        this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(payload) }));
      }

      send(raw: string) {
        const message = JSON.parse(raw) as Record<string, unknown>;
        if (message.setup) {
          window.setTimeout(() => this.emit({ setupComplete: {} }), 0);
        }
        const realtimeInput = message.realtimeInput as { text?: string } | undefined;
        if (!realtimeInput?.text) return;

        if (!staged) {
          window.setTimeout(() => {
            this.emit({
              serverContent: {
                outputTranscription: { text: 'How can I help with your stay?' },
                turnComplete: true,
              },
            });
            this.emit({
              toolCall: {
                functionCalls: [
                  { id: 'tool-1', name: 'get_property_facts', args: { topic: 'pool' } },
                ],
              },
            });
            if (this.instanceNumber === 1) {
              this.emit({ serverContent: { interrupted: true } });
              this.emit({
                sessionResumptionUpdate: { newHandle: 'resume-1', resumable: true },
              });
              this.emit({ goAway: { timeLeft: '5s' } });
            }
          }, 10);
          return;
        }

        const text = realtimeInput.text.trim();
        const lower = text.toLowerCase();

        // The panel sends this opener itself once the provider setup completes.
        const reply = lower.includes('start the call')
          ? 'Hi, I am Kame. Ask me anything about your stay.'
          : lower.includes('park')
            ? null
            : 'The pool is open from 6 AM to 9 PM daily.';

        if (reply) {
          window.setTimeout(() => {
            this.emit({
              serverContent: { outputTranscription: { text: reply }, turnComplete: true },
            });
          }, 120);
          window.setTimeout(() => {
            this.emit({
              serverContent: { modelTurn: { parts: [{ inlineData: { data: silentPcmBase64 } }] } },
            });
          }, 260);
          return;
        }

        window.setTimeout(() => {
          this.emit({
            serverContent: {
              outputTranscription: { text: 'Let me check the parking details for you.' },
              turnComplete: false,
            },
          });
          this.emit({
            toolCall: {
              functionCalls: [
                { id: 'tool-2', name: 'get_property_facts', args: { topic: 'parking' } },
              ],
            },
          });
        }, 120);
      }

      close() {
        this.readyState = MockWebSocket.CLOSED;
      }
    }

    Object.defineProperty(window, 'AudioContext', { configurable: true, value: MockAudioContext });
    Object.defineProperty(window, 'AudioWorkletNode', {
      configurable: true,
      value: MockAudioWorkletNode,
    });
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: MockWebSocket });
  }, options.staged ?? false);
}

/** Open the guest chat and the in-thread voice panel. */
export async function openVoicePanel(page: Page) {
  await page.goto(VOICE_CHAT_PATH);
  await page.getByRole('button', { name: 'Chat options' }).click();
  await page.getByText('Talk to receptionist', { exact: true }).click();
}
