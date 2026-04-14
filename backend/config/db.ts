import mongoose from 'mongoose';
import seedDatabase from './seed';

const isProd = process.env.NODE_ENV === 'production';

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

  // Production: REQUIRE a real MongoDB. Never fall back to in-memory.
  // Serverless platforms (Vercel, Netlify, etc.) have a read-only filesystem,
  // so mongodb-memory-server cannot run there. Even if it could, every
  // cold start would lose all data.
  if (isProd) {
    if (!uri) {
      console.error('');
      console.error('  ✖ MONGODB_URI is required in production.');
      console.error('  Sign up at https://www.mongodb.com/cloud/atlas');
      console.error('  Create a free M0 cluster and set the connection string');
      console.error('  as MONGODB_URI in your hosting provider\'s env vars.');
      console.error('');
      process.exit(1);
    }
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
      console.log('  DB mode: real MongoDB (production)');
      console.log('  Host:    ' + mongoose.connection.host);
      console.log('  Name:    ' + mongoose.connection.name);
    } catch (err) {
      console.error('');
      console.error('  ✖ Failed to connect to MONGODB_URI in production.');
      console.error('  ' + (err as Error).message);
      console.error('  Verify the connection string, IP whitelist, and credentials.');
      console.error('');
      process.exit(1);
    }
    await seedDatabase();
    return;
  }

  // Development: try real URI first, fall back to in-memory with a warning.
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
