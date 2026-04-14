#!/usr/bin/env node
/**
 * Quick connectivity check for MONGODB_URI.
 *
 * Usage:
 *   cd backend
 *   MONGODB_URI="mongodb+srv://..." node scripts/test-mongo.js
 *
 * Or, if you have it in .env:
 *   cd backend
 *   node -r dotenv/config scripts/test-mongo.js
 */

const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('✖ MONGODB_URI is not set.');
  console.error('  Try:  MONGODB_URI="your-string" node scripts/test-mongo.js');
  process.exit(1);
}

console.log('→ Connecting to: ' + uri.replace(/\/\/[^@]+@/, '//<credentials>@'));

mongoose
  .connect(uri, { serverSelectionTimeoutMS: 10000 })
  .then(async () => {
    console.log('✓ Connected successfully');
    console.log('  Host: ' + mongoose.connection.host);
    console.log('  DB:   ' + mongoose.connection.name);
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('  Collections: ' + (collections.length ? collections.map(c => c.name).join(', ') : '(none yet)'));
    await mongoose.disconnect();
    console.log('✓ Disconnected cleanly');
    process.exit(0);
  })
  .catch(err => {
    console.error('✖ Connection failed:');
    console.error('  ' + err.message);
    if (err.message.includes('IP')) {
      console.error('');
      console.error('  Hint: in MongoDB Atlas, go to Network Access');
      console.error('  and add 0.0.0.0/0 (allow from anywhere) for Vercel.');
    }
    process.exit(1);
  });
