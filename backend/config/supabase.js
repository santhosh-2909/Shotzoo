// Supabase client (server-side, uses the secret/service key — bypasses RLS).
// Never import this from the browser.
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn(
    '\n[supabase] WARNING: SUPABASE_URL or SUPABASE_SERVICE_KEY is missing from .env.\n' +
    '          Supabase queries will fail until both are set.\n'
  );
}

const supabase = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_SERVICE_KEY || 'placeholder', {
  auth: { persistSession: false, autoRefreshToken: false }
});

module.exports = supabase;
