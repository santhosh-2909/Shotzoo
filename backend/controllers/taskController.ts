import { Request, Response } from 'express';
import Task from '../models/Task';
import Notification from '../models/Notification';

export const getTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, priority, search, sort, page = '1', limit = '50' } = req.query as {
      status?: string;
      priority?: string;
      search?: string;
      sort?: string;
      page?: string;
      limit?: string;
    };

    const query: Record<string, unknown> = { user: req.user!._id };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    let sortOpt: { [key: string]: 1 | -1 } = { createdAt: -1 };
    if (sort === 'deadline') sortOpt = { deadline: 1 };
    else if (sort === 'priority') sortOpt = { priority: -1 };

    const pg = Number.parseInt(page, 10);
    const lim = Number.parseInt(limit, 10);
    const skip = (pg - 1) * lim;

    const [tasks, total] = await Promise.all([
      Task.find(query).sort(sortOpt).skip(skip).limit(lim),
      Task.countDocuments(query),
    ]);

    res.json({
      success: true,
      count: tasks.length,
      total,
      page: pg,
      pages: Math.ceil(total / lim),
      tasks,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getTodayTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const tasks = await Task.find({
      user: req.user!._id,
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { deadline: { $gte: start, $lte: end } },
        { status: { $in: ['Pending', 'In Progress'] } },
      ],
    }).sort({ priority: -1, deadline: 1 });
    res.json({ success: true, count: tasks.length, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getTaskStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = req.user!._id;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [total, pending, overdue, completedToday] = await Promise.all([
      Task.countDocuments({ user: uid }),
      Task.countDocuments({ user: uid, status: { $in: ['Pending', 'In Progress'] } }),
      Task.countDocuments({ user: uid, status: 'Overdue' }),
      Task.countDocuments({ user: uid, status: 'Completed', completedAt: { $gte: start } }),
    ]);
    res.json({ success: true, stats: { total, pending, overdue, completedToday } });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getUpcomingDeadlines = async (req: Request, res: Response): Promise<void> => {
  try {
    const tasks = await Task.find({
      user: req.user!._id,
      status: { $in: ['Pending', 'In Progress'] },
      deadline: { $gte: new Date() },
    })
      .sort({ deadline: 1 })
      .limit(10);
    res.json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user!._id });
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found.' });
      return;
    }
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const createTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    body.user = req.user!._id;
    if (typeof body.tags === 'string') {
      body.tags = (body.tags as string).split(',').map((t) => t.trim()).filter(Boolean);
    }
    const task = await Task.create(body);
    res.status(201).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const updateTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    if (typeof body.tags === 'string') {
      body.tags = (body.tags as string).split(',').map((t) => t.trim()).filter(Boolean);
    }
    if (body.status === 'Completed') {
      body.completedAt = new Date();
      body.progress = 100;
    }
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user!._id },
      body,
      { new: true, runValidators: true }
    );
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found.' });
      return;
    }
    if (body.status === 'Completed') {
      await Notification.create({
        user: req.user!._id,
        type: 'Completion',
        title: 'Task Completed',
        message: 'You completed "' + task.title + '"',
        task: task._id,
      });
    }
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const updateTaskStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, progress } = req.body as { status?: string; progress?: number };
    const data: Record<string, unknown> = { status };
    if (progress !== undefined) data.progress = progress;
    if (status === 'Completed') {
      data.completedAt = new Date();
      data.progress = 100;
    }
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user!._id },
      data,
      { new: true, runValidators: true }
    );
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found.' });
      return;
    }
    if (status === 'Completed') {
      await Notification.create({
        user: task.user,
        type: 'Completion',
        title: 'Task Completed',
        message: 'You completed "' + task.title + '"',
        task: task._id,
      });
    }
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user!._id });
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found.' });
      return;
    }
    res.json({ success: true, message: 'Task deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
