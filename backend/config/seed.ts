import User from '../models/User';

const seedDatabase = async (): Promise<void> => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('  Seed:    skipped (' + userCount + ' users already present)');
      return;
    }

    console.log('  Seed:    creating default admin account…');

    await User.create({
      fullName:     'Admin',
      email:        'admin@shotzoo.dev',
      password:     'admin123',
      role:         'Admin',
      employeeType: 'Office',
      company:      'ShotZoo',
    });

    console.log('  Seed:    created default admin');
    console.log('  Login:   admin@shotzoo.dev / admin123');
  } catch (err) {
    console.error('  Seed error:', (err as Error).message);
  }
};

export default seedDatabase;
