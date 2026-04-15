import { supabase, getSupabase } from './supabase';
import seedDatabase from './seed';

/**
 * Mutable boot state, shared with server.ts via object export so we
 * don't run into TS `export let` lint warnings.
 *   state.ready      — true once the Supabase health query succeeds
 *   state.initError  — clear, user-facing error message if boot failed;
 *                      the /api middleware turns this into a JSON 503
 */
export const state: { ready: boolean; initError: string | null } = {
  ready:     false,
  initError: null,
};

/**
 * Supabase replaces MongoDB. There is no long-lived connection to
 * manage — the REST client connects per-request — but we still run
 * a health query once at boot to:
 *   1. Fail fast with a clear error if SUPABASE_URL / SUPABASE_SERVICE_KEY
 *      are missing or wrong
 *   2. Run the admin seed on first deploy
 */
const connectDB = async (): Promise<void> => {
  try {
    getSupabase();
  } catch (err) {
    state.initError = (err as Error).message;
    console.error('  ✖ ' + state.initError);
    return;
  }

  try {
    // Cheap health query — selects at most 1 row from the users table.
    // If the schema hasn't been created yet, this fails with a clear
    // Postgres error that we surface to the user.
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      state.initError =
        'Supabase query failed: ' + error.message +
        '. Verify that supabase-schema.sql has been run in your project ' +
        '(Supabase → SQL Editor → paste supabase-schema.sql → Run).';
      console.error('  ✖ ' + state.initError);
      return;
    }
    state.ready = true;
    console.log('  DB mode: Supabase (Postgres)');
    console.log('  URL:     ' + (process.env.SUPABASE_URL ?? '(env unset)'));
  } catch (err) {
    state.initError = 'Supabase health check threw: ' + (err as Error).message;
    console.error('  ✖ ' + state.initError);
    return;
  }

  try {
    await seedDatabase();
  } catch (seedErr) {
    console.error('  ⚠ Seed failed (non-fatal):', (seedErr as Error).message);
  }
};

export default connectDB;
