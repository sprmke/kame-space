import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// The orchestrator's shared imports construct a Supabase client at module load; provide a
// harmless URL so this pure status helper can be imported without a live project.
Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');

const { isTerminalParkingPaymentStatus } = await import('./parkingPaymentOrchestrator.ts');

Deno.test('terminal parking payment states include paid and both refund states', () => {
  assertEquals(isTerminalParkingPaymentStatus('paid'), true);
  assertEquals(isTerminalParkingPaymentStatus('refund_review'), true);
  assertEquals(isTerminalParkingPaymentStatus('refunded'), true);
  assertEquals(isTerminalParkingPaymentStatus('pending'), false);
  assertEquals(isTerminalParkingPaymentStatus('failed'), false);
  assertEquals(isTerminalParkingPaymentStatus('expired'), false);
});
