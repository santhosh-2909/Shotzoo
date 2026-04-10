const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  type: { type: String, enum: ['BOD', 'MOD', 'EOD'], required: true },
  title: { type: String, required: [true, 'Report title is required'], trim: true },
  description: { type: String, default: '' },
  isLate: { type: Boolean, default: false },
  lateReason: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// One report per user per day per type
dailyReportSchema.index({ user: 1, date: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('DailyReport', dailyReportSchema);
