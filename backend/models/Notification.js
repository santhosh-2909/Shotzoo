const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['Deadline', 'Overdue', 'Message', 'Completion', 'System', 'Announcement', 'Reminder', 'Alert', 'Task Update'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  read: { type: Boolean, default: false },
  urgent: { type: Boolean, default: false },
  groupId: { type: String, index: true },
  audience: { type: String, enum: ['All', 'Selected'], default: 'All' },
  recipientCount: { type: Number, default: 1 },
  dismissedAt: { type: Date }
}, { timestamps: true });

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
