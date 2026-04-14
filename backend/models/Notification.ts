import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type NotificationType =
  | 'Deadline'
  | 'Overdue'
  | 'Message'
  | 'Completion'
  | 'System'
  | 'Announcement'
  | 'Reminder'
  | 'Alert'
  | 'Task Update';

export interface INotification extends Document {
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  task?: Types.ObjectId;
  read: boolean;
  urgent: boolean;
  groupId?: string;
  audience: 'All' | 'Selected';
  recipientCount: number;
  dismissedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['Deadline', 'Overdue', 'Message', 'Completion', 'System', 'Announcement', 'Reminder', 'Alert', 'Task Update'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    task: { type: Schema.Types.ObjectId, ref: 'Task' },
    read: { type: Boolean, default: false },
    urgent: { type: Boolean, default: false },
    groupId: { type: String, index: true },
    audience: { type: String, enum: ['All', 'Selected'], default: 'All' },
    recipientCount: { type: Number, default: 1 },
    dismissedAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

const Notification: Model<INotification> = mongoose.model<INotification>('Notification', notificationSchema);
export default Notification;
