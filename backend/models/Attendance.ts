import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IBreak {
  startTime: Date;
  endTime?: Date | null;
}

export interface ISession extends Document {
  checkInTime: Date;
  checkOutTime?: Date | null;
  breaks: IBreak[];
  getWorkingMs(): number;
}

export interface IAttendance extends Document {
  user: Types.ObjectId;
  date: Date;
  sessions: ISession[];
  dayStarted: boolean;
  hoursWorked: number;
  status: 'Present' | 'Absent' | 'Half-day' | 'On Leave';
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    checkInTime: { type: Date, required: true },
    checkOutTime: { type: Date, default: null },
    breaks: [
      {
        startTime: { type: Date, required: true },
        endTime: { type: Date, default: null },
      },
    ],
  },
  { _id: true }
);

sessionSchema.methods.getWorkingMs = function (this: ISession): number {
  const end = this.checkOutTime || new Date();
  let totalMs = end.getTime() - this.checkInTime.getTime();
  for (const brk of this.breaks) {
    const bEnd = brk.endTime || (this.checkOutTime ? this.checkOutTime : new Date());
    totalMs -= bEnd.getTime() - brk.startTime.getTime();
  }
  return Math.max(0, totalMs);
};

const attendanceSchema = new Schema<IAttendance>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    sessions: { type: [sessionSchema], default: [] },
    dayStarted: { type: Boolean, default: false },
    hoursWorked: { type: Number, default: 0 },
    status: { type: String, enum: ['Present', 'Absent', 'Half-day', 'On Leave'], default: 'Present' },
  },
  { timestamps: true }
);

attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

attendanceSchema.pre<IAttendance>('save', function (next) {
  let totalMs = 0;
  for (const session of this.sessions) {
    totalMs += (session as ISession).getWorkingMs();
  }
  this.hoursWorked = parseFloat((totalMs / 3600000).toFixed(2));
  if (this.sessions.length > 0) {
    this.status = this.hoursWorked < 4 ? 'Half-day' : 'Present';
  }
  next();
});

const Attendance: Model<IAttendance> = mongoose.model<IAttendance>('Attendance', attendanceSchema);
export default Attendance;
