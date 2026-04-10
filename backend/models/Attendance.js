const mongoose = require('mongoose');

// Each session represents one check-in/check-out cycle
const sessionSchema = new mongoose.Schema({
  checkInTime: { type: Date, required: true },
  checkOutTime: { type: Date, default: null },
  breaks: [{
    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null }
  }]
}, { _id: true });

// Helper: compute net working ms for a single session
sessionSchema.methods.getWorkingMs = function () {
  const end = this.checkOutTime || new Date();
  let totalMs = end - this.checkInTime;
  for (const brk of this.breaks) {
    const bEnd = brk.endTime || (this.checkOutTime ? this.checkOutTime : new Date());
    totalMs -= (bEnd - brk.startTime);
  }
  return Math.max(0, totalMs);
};

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  sessions: { type: [sessionSchema], default: [] },
  dayStarted: { type: Boolean, default: false },  // "Start My Day" flag — once per day
  hoursWorked: { type: Number, default: 0 },
  status: { type: String, enum: ['Present', 'Absent', 'Half-day', 'On Leave'], default: 'Present' }
}, { timestamps: true });

// One attendance record per user per day
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

// Recalculate hoursWorked before every save
attendanceSchema.pre('save', function (next) {
  let totalMs = 0;
  for (const session of this.sessions) {
    totalMs += session.getWorkingMs();
  }
  this.hoursWorked = parseFloat((totalMs / 3600000).toFixed(2));
  if (this.sessions.length > 0) {
    this.status = this.hoursWorked < 4 ? 'Half-day' : 'Present';
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
