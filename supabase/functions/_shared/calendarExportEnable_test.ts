import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { enableExportOnConnect, type EnableExportDeps } from './calendarExportEnable.ts';

function deps(over: Partial<EnableExportDeps> = {}) {
  const calls: string[] = [];
  const d: EnableExportDeps = {
    isEnabled: () => Promise.resolve(false),
    isPaused: () => Promise.resolve(false),
    enable: () => {
      calls.push('enable');
      return Promise.resolve();
    },
    record: () => {
      calls.push('record');
      return Promise.resolve();
    },
    ...over,
  };
  return { d, calls };
}

Deno.test('turns sharing on and records it when it was off', async () => {
  const { d, calls } = deps();
  assertEquals(await enableExportOnConnect(d), 'enabled');
  assertEquals(calls, ['enable', 'record']);
});

Deno.test('leaves sharing alone when it is already on', async () => {
  const { d, calls } = deps({ isEnabled: () => Promise.resolve(true) });
  assertEquals(await enableExportOnConnect(d), 'already_on');
  assertEquals(calls, []);
});

Deno.test('does not turn sharing on while the module is paused', async () => {
  const { d, calls } = deps({ isPaused: () => Promise.resolve(true) });
  assertEquals(await enableExportOnConnect(d), 'paused');
  assertEquals(calls, []);
});

Deno.test('does not record when the update fails', async () => {
  const { d, calls } = deps({
    enable: () => Promise.reject(new Error('db down')),
  });
  await assertRejects(() => enableExportOnConnect(d), Error, 'db down');
  assertEquals(calls, []);
});
