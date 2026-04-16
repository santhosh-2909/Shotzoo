/**
 * One-off DB wipe. Deletes every row from every app table, preserving
 * schema/indexes/triggers/RLS. Run via:
 *
 *   npx ts-node backend/scripts/clearDatabase.ts
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_KEY in backend/.env.
 * Uses the service_role key, so RLS is bypassed.
 *
 * Order matters: child tables first (those with FK references to users),
 * then users last. Supabase deletes require a WHERE clause — we use
 * `neq('id', zero-uuid)` which matches every real UUID row.
 */
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { supabase } from '../config/supabase';

const TABLES = [
  'notifications',
  'daily_reports',
  'attendance',
  'tasks',
  'users',
] as const;

const NEVER_UUID = '00000000-0000-0000-0000-000000000000';

async function main(): Promise<void> {
  console.log('ShotZoo DB wipe — target: ' + (process.env.SUPABASE_URL ?? '(unset)'));
  console.log('');

  for (const table of TABLES) {
    const { count: before, error: countErr } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true });

    if (countErr) {
      console.error(`  ✖ ${table}: count failed — ${countErr.message}`);
      process.exit(1);
    }

    const { error: delErr } = await supabase
      .from(table)
      .delete()
      .neq('id', NEVER_UUID);

    if (delErr) {
      console.error(`  ✖ ${table}: delete failed — ${delErr.message}`);
      process.exit(1);
    }

    const { count: after } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true });

    console.log(`  ✓ ${table.padEnd(15)} deleted ${before ?? 0} rows (now ${after ?? 0})`);
  }

  console.log('');
  console.log('Done. Schema is intact; all data is gone.');
}

main().catch(err => {
  console.error('Script crashed:', err);
  process.exit(1);
});
