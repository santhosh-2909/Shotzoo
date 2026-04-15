import bcrypt from 'bcryptjs';
import { supabase } from './supabase';
import { randomEmployeeId } from '../types/db';

/**
 * First-boot seeder. Creates a default admin account if the users table
 * is empty, so a fresh Supabase project is immediately usable:
 *   email:    admin@shotzoo.dev
 *   password: admin123
 *
 * Idempotent — if any user already exists, does nothing.
 */
const seedDatabase = async (): Promise<void> => {
  const { count, error: countErr } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.error('  Seed: count query failed:', countErr.message);
    return;
  }

  if ((count ?? 0) > 0) {
    console.log('  Seed:    skipped (' + count + ' users already present)');
    return;
  }

  console.log('  Seed:    creating default admin account…');

  const hash = await bcrypt.hash('admin123', 12);

  // Collision-tolerant employee ID generation
  let employeeId = randomEmployeeId();
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('employee_id', employeeId)
      .maybeSingle();
    if (!existing) break;
    employeeId = randomEmployeeId();
  }

  const { error: insertErr } = await supabase.from('users').insert({
    employee_id:   employeeId,
    full_name:     'Admin',
    email:         'admin@shotzoo.dev',
    phone:         '',
    company:       'ShotZoo',
    role:          'Admin',
    password:      hash,
    employee_type: 'Office',
  });

  if (insertErr) {
    console.error('  Seed: insert failed:', insertErr.message);
    return;
  }

  console.log('  Seed:    created default admin (' + employeeId + ')');
  console.log('  Login:   admin@shotzoo.dev / admin123');
};

export default seedDatabase;
