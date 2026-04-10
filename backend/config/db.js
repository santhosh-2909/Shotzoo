const mongoose = require('mongoose');

const seedAdmin = async () => {
  try {
    const User = require('../models/User');
    const exists = await User.findOne({ email: 'tejaswinisathish26@gmail.com' });
    if (!exists) {
      await User.create({
        fullName: 'Tejaswini',
        email: 'tejaswinisathish26@gmail.com',
        password: '12345678',
        confirmPassword: '12345678',
        role: 'Admin',
        employeeType: 'Office'
      });
      console.log('Admin account seeded: tejaswinisathish26@gmail.com');
    }
  } catch (e) {
    console.error('Seed error:', e.message);
  }
};

const connectDB = async () => {
  try {
    // Try local MongoDB first
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
    console.log('MongoDB Connected: ' + mongoose.connection.host);
  } catch (err) {
    // Fallback to in-memory MongoDB (lazy-load so it's not required if local Mongo works)
    console.log('Local MongoDB not found. Starting in-memory database...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      console.log('In-Memory MongoDB Connected: ' + uri);
    } catch (memErr) {
      console.error('Failed to start in-memory DB. Install mongodb-memory-server or start local MongoDB.');
      process.exit(1);
    }
  }
  await seedAdmin();
};

module.exports = connectDB;
