import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUserNotifications {
  email: boolean;
  push: boolean;
  weeklyReports: boolean;
  dailyReminderTime: string;
}

export interface IUser extends Document {
  employeeId: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  password: string;
  photo: string;
  employeeType: 'Office' | 'Home';
  bio: string;
  joiningDate?: Date;
  gender: 'Male' | 'Female' | 'Prefer not to say' | '';
  dateOfBirth?: Date;
  linkedinUrl: string;
  workRole: string;
  notifications: IUserNotifications;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    employeeId: { type: String, unique: true },
    fullName: { type: String, required: [true, 'Full name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    phone: { type: String, trim: true, default: '' },
    company: { type: String, trim: true, default: '' },
    role: { type: String, default: 'Employee' },
    password: { type: String, required: [true, 'Password is required'], minlength: 6, select: false },
    photo: { type: String, default: '' },
    employeeType: { type: String, enum: ['Office', 'Home'], default: 'Office' },
    bio: { type: String, default: '', maxlength: 500 },
    joiningDate: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Prefer not to say', ''], default: '' },
    dateOfBirth: { type: Date },
    linkedinUrl: { type: String, default: '', trim: true },
    workRole: { type: String, default: '', trim: true },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      weeklyReports: { type: Boolean, default: false },
      dailyReminderTime: { type: String, default: '09:00' },
    },
  },
  { timestamps: true }
);

userSchema.pre<IUser>('save', async function (next) {
  if (this.isNew && !this.employeeId) {
    let id: string;
    let exists = true;
    while (exists) {
      const num = String(Math.floor(1000 + Math.random() * 9000));
      id = 'SZ-EMP-' + num;
      exists = !!(await mongoose.model('User').exists({ employeeId: id }));
    }
    this.employeeId = id!;
  }
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password as string);
};

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User;
