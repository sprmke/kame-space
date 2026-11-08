/**
 * Vitest global setup — Node env has no Vite env injection unless we set it here.
 * Keeps imports of `@/lib/supabase/client` and edge helpers from failing at load time.
 */

// Deterministic wall clock. Every user-visible time in this product is Asia/Manila,
// so a test that passes on a UTC laptop and fails on a Manila one (or the reverse)
// is a test that cannot be trusted. Node invalidates its timezone cache when this
// changes, so setting it here is enough for the whole worker.
process.env.TZ = 'Asia/Manila';

process.env.VITE_SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321/functions/v1';
process.env.VITE_SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key';
process.env.VITE_SUPABASE_PROJECT_URL =
  process.env.VITE_SUPABASE_PROJECT_URL ?? 'http://127.0.0.1:54321';
