import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ITask extends Document {
  user: Types.ObjectId;
  title: string;
  description: string;
  context: string;
  executionSteps: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  tags: string[];
  estimatedHours: number;
  estimatedMinutes: number;
  deadline?: Date;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  progress: number;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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
    completedAt: { type: Date },
  },
  { timestamps: true }
);

const Task: Model<ITask> = mongoose.model<ITask>('Task', taskSchema);
export default Task;
