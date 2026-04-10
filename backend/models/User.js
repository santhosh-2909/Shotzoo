const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  employeeId: { type: String, unique: true },
  fullName: { type: String, required: [true, 'Full name is required'], trim: true },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  phone: { type: String, trim: true, default: '' },
  company: { type: String, trim: true, default: '' },
  role: { type: String, default: 'Employee' },
  password: { type: String, required: [true, 'Password is required'], minlength: 6, select: false },
  photo: { type: String, default: '' },
  employeeType: { type: String, enum: ['Office', 'Home'], default: 'Office' },
  bio: { type: String, default: '', maxlength: 500 },
  // Profile rebuild fields
  joiningDate:  { type: Date },
  gender:       { type: String, enum: ['Male', 'Female', 'Prefer not to say', ''], default: '' },
  dateOfBirth:  { type: Date },
  linkedinUrl:  { type: String, default: '', trim: true },
  workRole:     { type: String, default: '', trim: true },
  notifications: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    weeklyReports: { type: Boolean, default: false },
    dailyReminderTime: { type: String, default: '09:00' }
  }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (this.isNew && !this.employeeId) {
    // Generate unique SZ-EMP-XXXX id
    let id, exists = true;
    while (exists) {
      const num = String(Math.floor(1000 + Math.random() * 9000));
      id = 'SZ-EMP-' + num;
      exists = await mongoose.model('User').exists({ employeeId: id });
    }
    this.employeeId = id;
  }
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
