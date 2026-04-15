import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the SERVICE_ROLE key.
 * This key bypasses Row-Level Security and has full read/write access
 * to every table. NEVER expose it to the frontend.
 *
 * Required env vars:
 *   SUPABASE_URL          — e.g. https://gftohsfknxqpksxuajwu.supabase.co
 *   SUPABASE_SERVICE_KEY  — the "service_role" secret from
 *                           Supabase → Project Settings → API
 */
let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY ' +
      'in your environment (locally in backend/.env, in Vercel → Settings → ' +
      'Environment Variables). Get SUPABASE_SERVICE_KEY from ' +
      'Supabase → Project Settings → API → "service_role" (click Reveal).',
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db:   { schema: 'public' },
  });
  return cached;
}

/** Shorthand for the common case: `supabase.from('users')...` */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string) {
    const client = getSupabase() as unknown as Record<string, unknown>;
    const value = client[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});
