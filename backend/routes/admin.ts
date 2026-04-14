import { Router, Request, Response } from 'express';
import { protect, restrictTo } from '../middleware/auth';
import User from '../models/User';
import Task from '../models/Task';
import Notification from '../models/Notification';
import Attendance from '../models/Attendance';
import { Types } from 'mongoose';

const router = Router();

// Every /api/admin/* route requires a logged-in user with role = 'Admin'.
router.use(protect, restrictTo('Admin'));

// GET /api/admin/stats — dashboard summary numbers
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const [totalEmployees, openTasks, completedToday, overdueCount] = await Promise.all([
      User.countDocuments(),
      Task.countDocuments({ status: { $in: ['Pending', 'In Progress'] } }),
      Task.countDocuments({ status: 'Completed', completedAt: { $gte: todayStart } }),
      Task.countDocuments({ status: 'Overdue' }),
    ]);
    res.json({ success: true, stats: { totalEmployees, openTasks, completedToday, overdueCount } });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/admin/employees — all registered users
router.get('/employees', async (_req: Request, res: Response) => {
  try {
    const employees = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: employees.length, employees });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/admin/tasks — all tasks with employee info
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const { status, priority } = req.query as { status?: string; priority?: string };
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    const tasks = await Task.find(query)
      .populate('user', 'fullName employeeId photo role')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: tasks.length, tasks });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/admin/tasks — create task and assign to employee
router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { userId, title, description, priority, deadline, tags, estimatedHours } = req.body as {
      userId?: string;
      title?: string;
      description?: string;
      priority?: string;
      deadline?: string;
      tags?: string[];
      estimatedHours?: number;
    };
    if (!userId || !title) {
      res.status(400).json({ success: false, message: 'userId and title are required.' });
      return;
    }
    const task = await Task.create({
      user: userId,
      title,
      description,
      priority: priority || 'Medium',
      deadline,
      tags,
      estimatedHours,
    });
    await Notification.create({
      user: userId,
      type: 'System',
      title: 'New Task Assigned',
      message: `"${title}" has been assigned to you`,
      task: task._id,
    });
    res.status(201).json({ success: true, task });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/admin/notify — send notification to one or all employees
router.post('/notify', async (req: Request, res: Response) => {
  try {
    const { userIds, title, message, type, urgent } = req.body as {
      userIds?: string[];
      title?: string;
      message?: string;
      type?: string;
      urgent?: boolean;
    };
    if (!message) {
      res.status(400).json({ success: false, message: 'Message is required.' });
      return;
    }

    let targets: unknown[];
    let audience: string;
    if (!userIds || userIds.length === 0) {
      const all = await User.find().select('_id');
      targets = all.map((u) => u._id);
      audience = 'All';
    } else {
      targets = userIds;
      audience = 'Selected';
    }

    const validTypes = [
      'Deadline', 'Overdue', 'Message', 'Completion', 'System',
      'Announcement', 'Reminder', 'Alert', 'Task Update',
    ];
    const notiType = validTypes.includes(type || '') ? type : 'Announcement';
    const groupId = new Types.ObjectId().toString();
    const recipientCount = targets.length;

    const docs = targets.map((uid) => ({
      user: uid,
      type: notiType,
      title: title || 'Admin Notification',
      message,
      urgent: !!urgent,
      groupId,
      audience,
      recipientCount,
    }));

    await Notification.insertMany(docs);
    res.json({ success: true, sent: targets.length, groupId });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/admin/notifications/sent — aggregated history of sent broadcasts
router.get('/notifications/sent', async (_req: Request, res: Response) => {
  try {
    const groups = await Notification.aggregate([
      { $match: { groupId: { $ne: null } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$groupId',
          type: { $first: '$type' },
          title: { $first: '$title' },
          message: { $first: '$message' },
          urgent: { $first: '$urgent' },
          audience: { $first: '$audience' },
          recipientCount: { $first: '$recipientCount' },
          createdAt: { $first: '$createdAt' },
          recipients: { $push: '$user' },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 50 },
    ]);

    const userIds = [...new Set(groups.flatMap((g) => (g.recipients as Types.ObjectId[]).map((r) => r.toString())))];
    const users = await User.find({ _id: { $in: userIds } }).select('fullName employeeId');
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const enriched = groups.map((g) => ({
      groupId: g._id,
      type: g.type,
      title: g.title,
      message: g.message,
      urgent: g.urgent,
      audience: g.audience,
      recipientCount: g.recipientCount,
      createdAt: g.createdAt,
      recipientNames: (g.recipients as Types.ObjectId[])
        .map((r) => userMap[r.toString()]?.fullName)
        .filter(Boolean),
    }));

    res.json({ success: true, groups: enriched });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/admin/activity — unified live activity feed for the dashboard
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 50);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [createdTasks, completedTasks, attendanceRecs] = await Promise.all([
      Task.find({ createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(limit * 2)
        .populate<{ user: { fullName: string; employeeId: string } | null }>('user', 'fullName employeeId'),
      Task.find({ status: 'Completed', completedAt: { $gte: since } })
        .sort({ completedAt: -1 })
        .limit(limit * 2)
        .populate<{ user: { fullName: string; employeeId: string } | null }>('user', 'fullName employeeId'),
      Attendance.find({ date: { $gte: since } })
        .sort({ date: -1 })
        .limit(limit * 2)
        .populate<{ user: { fullName: string; employeeId: string } | null }>('user', 'fullName employeeId'),
    ]);

    const events: {
      kind: string;
      at: Date | undefined;
      userName: string;
      userId: string;
      text: string;
    }[] = [];

    for (const t of createdTasks) {
      if (!t.user) continue;
      events.push({
        kind: 'task_created',
        at: t.createdAt,
        userName: t.user.fullName,
        userId: t.user.employeeId,
        text: 'created task "' + t.title + '"',
      });
    }
    for (const t of completedTasks) {
      if (!t.user) continue;
      events.push({
        kind: 'task_completed',
        at: t.completedAt,
        userName: t.user.fullName,
        userId: t.user.employeeId,
        text: 'marked "' + t.title + '" as Completed',
      });
    }
    for (const a of attendanceRecs) {
      if (!a.user || !a.sessions) continue;
      for (const s of a.sessions) {
        if (s.checkInTime && s.checkInTime >= since) {
          events.push({
            kind: 'check_in',
            at: s.checkInTime,
            userName: (a.user as unknown as { fullName: string }).fullName,
            userId: (a.user as unknown as { employeeId: string }).employeeId,
            text: 'checked in',
          });
        }
        if (s.checkOutTime && s.checkOutTime >= since) {
          events.push({
            kind: 'check_out',
            at: s.checkOutTime,
            userName: (a.user as unknown as { fullName: string }).fullName,
            userId: (a.user as unknown as { employeeId: string }).employeeId,
            text: 'checked out',
          });
        }
      }
    }

    events.sort((a, b) => new Date(b.at!).getTime() - new Date(a.at!).getTime());
    res.json({
      success: true,
      count: Math.min(events.length, limit),
      events: events.slice(0, limit),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/admin/attendance — all attendance records for today
router.get('/attendance', async (req: Request, res: Response) => {
  try {
    const { date } = req.query as { date?: string };
    let start: Date, end: Date;
    if (date) {
      start = new Date(date);
      start.setHours(0, 0, 0, 0);
      end = new Date(date);
      end.setHours(23, 59, 59, 999);
    } else {
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }
    const records = await Attendance.find({ date: { $gte: start, $lte: end } })
      .populate('user', 'fullName employeeId photo role')
      .sort({ 'sessions.0.checkInTime': 1 });
    const present = records.filter((r) => r.sessions && r.sessions.length > 0).length;
    const totalEmp = await User.countDocuments();
    res.json({
      success: true,
      count: records.length,
      present,
      absent: totalEmp - present,
      totalEmployees: totalEmp,
      records,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

export default router;
