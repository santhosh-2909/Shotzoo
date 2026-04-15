import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import seedDatabase from './seed';

const isProd       = process.env.NODE_ENV === 'production';
const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

/** True once connectDB() has successfully opened a connection. */
export let dbReady = false;

/** Populated if the initial connectDB() attempt failed. Used by server.ts to
 *  return a helpful JSON 503 on every /api/* request instead of crashing. */
export let dbInitError: string | null = null;

/**
 * Persistent in-memory Mongo for local dev. The wiredTiger files live
 * OUTSIDE the workspace (os.homedir()/.shotzoo-dev-db by default) so
 * VSCode's file watcher and extension analyzers never try to read the
 * locked .lock files and produce EISDIR/EBUSY diagnostics. Override
 * with MONGO_MEMORY_DB_PATH if you want the data elsewhere.
 */
const startInMemory = async (reason: string): Promise<void> => {
  const dbPath = process.env.MONGO_MEMORY_DB_PATH
    ?? path.join(os.homedir(), '.shotzoo-dev-db');
  try {
    fs.mkdirSync(dbPath, { recursive: true });
  } catch {
    /* ignore mkdir errors — will surface below if unusable */
  }

  try {
    // Hide the module name from static analyzers (Vercel's esbuild would
    // otherwise try to bundle this dev-only dep into the serverless function).
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic require
    const dynRequire = eval('require') as (m: string) => { MongoMemoryServer: { create: (opts?: unknown) => Promise<{ getUri: () => string; stop: (opts?: unknown) => Promise<void> }> } };
    const { MongoMemoryServer } = dynRequire('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create({
      instance: {
        dbPath,
        storageEngine: 'wiredTiger',
      },
    });
    const memUri: string = mongod.getUri();
    await mongoose.connect(memUri);

    // Graceful shutdown so wiredTiger flushes cleanly
    const shutdown = async (): Promise<void> => {
      try {
        await mongoose.disconnect();
        await mongod.stop({ doCleanup: false, force: false });
      } catch {
        /* best-effort */
      }
      process.exit(0);
    };
    process.once('SIGINT',  () => { void shutdown(); });
    process.once('SIGTERM', () => { void shutdown(); });

    console.log('  DB mode: persistent in-memory MongoDB');
    if (reason) console.log('  Reason:  ' + reason);
    console.log('  URI:     ' + memUri);
    console.log('  Data:    ' + dbPath + ' (persists across restarts)');
  } catch (memErr) {
    const msg = (memErr as Error).message;
    dbInitError = 'In-memory MongoDB failed to start: ' + msg;
    console.error('');
    console.error('  ✖ Failed to start in-memory MongoDB.');
    console.error('  ' + msg);
    console.error('  Install it: npm i -D mongodb-memory-server');
    console.error('  Or start a real MongoDB and set MONGODB_URI in .env.');
    console.error('');
    // Only hard-exit in long-lived mode. In serverless, leave the flag set
    // so the middleware can return a JSON error to the client.
    if (!isServerless) process.exit(1);
  }
};

const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;

  // ── Production ─────────────────────────────────────────────────────────
  // Require MONGODB_URI but NEVER crash the function at startup. Instead,
  // set dbInitError so the API middleware returns a helpful JSON 503
  // explaining exactly what to fix in the hosting provider's env vars.
  if (isProd) {
    if (!uri) {
      dbInitError =
        'MONGODB_URI is not set. In Vercel → Settings → Environment Variables, ' +
        'add MONGODB_URI with your MongoDB Atlas connection string ' +
        '(mongodb+srv://user:pass@cluster.mongodb.net/dbname) and redeploy.';
      console.error('  ✖ ' + dbInitError);
      return;
    }
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
      dbReady = true;
      console.log('  DB mode: real MongoDB (production)');
      console.log('  Host:    ' + mongoose.connection.host);
      console.log('  Name:    ' + mongoose.connection.name);
    } catch (err) {
      const msg = (err as Error).message;
      dbInitError =
        'Failed to connect to MongoDB: ' + msg +
        '. Verify the MONGODB_URI credentials, the Atlas IP whitelist ' +
        '(0.0.0.0/0 for Vercel), and that the database user has read/write access.';
      console.error('  ✖ ' + dbInitError);
      return;
    }
    try {
      await seedDatabase();
    } catch (seedErr) {
      console.error('  ⚠ Seed failed (non-fatal):', (seedErr as Error).message);
    }
    return;
  }

  // ── Development ────────────────────────────────────────────────────────
  // Try real URI first, fall back to persistent in-memory with a warning.
  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      dbReady = true;
      console.log('  DB mode: real MongoDB');
      console.log('  Host:    ' + mongoose.connection.host);
      console.log('  Name:    ' + mongoose.connection.name);
    } catch (err) {
      console.warn('  ⚠ Could not reach MONGODB_URI=' + uri);
      console.warn('  ⚠ ' + (err as Error).message);
      console.warn('  ⚠ Falling back to in-memory MongoDB.');
      await startInMemory('MONGODB_URI unreachable');
      dbReady = !dbInitError;
    }
  } else {
    await startInMemory('MONGODB_URI not set');
    dbReady = !dbInitError;
  }

  if (dbReady) {
    try {
      await seedDatabase();
    } catch (seedErr) {
      console.error('  ⚠ Seed failed (non-fatal):', (seedErr as Error).message);
    }
  }
};

export default connectDB;
