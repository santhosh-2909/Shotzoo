const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: [true, 'Task title is required'], trim: true },
  description: { type: String, default: '' },
  context: { type: String, default: '' },
  executionSteps: { type: String, default: '' },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
  tags: [{ type: String, trim: true }],
  estimatedHours: { type: Number, default: 0, min: 0 },
  estimatedMinutes: { type: Number, default: 0, min: 0, max: 59 },
  deadline: { type: Date },
  status: { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Overdue'], default: 'Pending' },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  completedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
