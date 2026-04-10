// Quick connection test. Run with: node test-supabase.js
// Pass/fail criteria:
//   ✅ Connects, lists all 5 tables, prints row counts.
//   ❌ Any error → prints the message and exits 1.
require('dotenv').config();
const supabase = require('./config/supabase');

const TABLES = ['users', 'tasks', 'notifications', 'notification_reads', 'attendance'];

(async () => {
  console.log('[supabase-test] URL:', process.env.SUPABASE_URL || '(missing)');
  console.log('[supabase-test] Key set:', process.env.SUPABASE_SERVICE_KEY ? 'yes' : 'NO');
  console.log('');

  let ok = true;
  for (const t of TABLES) {
    const { count, error } = await supabase
      .from(t)
      .select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ❌ ${t.padEnd(20)}  ${error.message}`);
      ok = false;
    } else {
      console.log(`  ✅ ${t.padEnd(20)}  ${count} rows`);
    }
  }

  console.log('');
  if (ok) {
    console.log('[supabase-test] All tables reachable. Connection OK.');
    process.exit(0);
  } else {
    console.log('[supabase-test] One or more tables failed. Check the SQL ran cleanly and the keys are correct.');
    process.exit(1);
  }
})();
