import mongoose from 'mongoose';
import seedDatabase from './seed';

const startInMemory = async (reason: string): Promise<void> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional dep
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const memUri: string = mongod.getUri();
    await mongoose.connect(memUri);
    console.log('  DB mode: in-memory MongoDB (ephemeral)');
    if (reason) console.log('  Reason:  ' + reason);
    console.log('  URI:     ' + memUri);
  } catch (memErr) {
    console.error('');
    console.error('  ✖ Failed to start in-memory MongoDB.');
    console.error('  ' + (memErr as Error).message);
    console.error('  Install it: npm i -D mongodb-memory-server');
    console.error('  Or start a real MongoDB and set MONGODB_URI in .env.');
    console.error('');
    process.exit(1);
  }
};

const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      console.log('  DB mode: real MongoDB');
      console.log('  Host:    ' + mongoose.connection.host);
      console.log('  Name:    ' + mongoose.connection.name);
    } catch (err) {
      console.warn('  ⚠ Could not reach MONGODB_URI=' + uri);
      console.warn('  ⚠ ' + (err as Error).message);
      console.warn('  ⚠ Falling back to in-memory MongoDB.');
      await startInMemory('MONGODB_URI unreachable');
    }
  } else {
    await startInMemory('MONGODB_URI not set');
  }

  await seedDatabase();
};

export default connectDB;
