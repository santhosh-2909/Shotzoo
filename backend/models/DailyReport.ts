import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ReportType = 'BOD' | 'MOD' | 'EOD';

export interface IDailyReport extends Document {
  user: Types.ObjectId;
  date: Date;
  type: ReportType;
  title: string;
  description: string;
  isLate: boolean;
  lateReason: string;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const dailyReportSchema = new Schema<IDailyReport>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    type: { type: String, enum: ['BOD', 'MOD', 'EOD'], required: true },
    title: { type: String, required: [true, 'Report title is required'], trim: true },
    description: { type: String, default: '' },
    isLate: { type: Boolean, default: false },
    lateReason: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One report per user per day per type
dailyReportSchema.index({ user: 1, date: 1, type: 1 }, { unique: true });

const DailyReport: Model<IDailyReport> = mongoose.model<IDailyReport>('DailyReport', dailyReportSchema);
export default DailyReport;
