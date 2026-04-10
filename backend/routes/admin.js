const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const User = require('../models/User');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const Attendance = require('../models/Attendance');

// Every /api/admin/* route requires a logged-in user with role = 'Admin'.
// Without this gate any logged-in employee could call /api/admin/tasks
// and read every task in the system, bypassing the visibility rules.
router.use(protect, restrictTo('Admin'));

// GET /api/admin/stats — dashboard summary numbers
router.get('/stats', async (req, res) => {
  try {
    const [totalEmployees, openTasks, completedToday, overdueCount] = await Promise.all([
      User.countDocuments(),
      Task.countDocuments({ status: { $in: ['Pending', 'In Progress'] } }),
      Task.countDocuments({ status: 'Completed', completedAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
      Task.countDocuments({ status: 'Overdue' })
    ]);
    res.json({ success: true, stats: { totalEmployees, openTasks, completedToday, overdueCount } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/admin/employees — all registered users
router.get('/employees', async (req, res) => {
  try {
    const employees = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: employees.length, employees });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/admin/tasks — all tasks with employee info
router.get('/tasks', async (req, res) => {
  try {
    const { status, priority } = req.query;
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    const tasks = await Task.find(query).populate('user', 'fullName employeeId photo role').sort({ createdAt: -1 });
    res.json({ success: true, count: tasks.length, tasks });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/admin/tasks — create task and assign to employee
router.post('/tasks', async (req, res) => {
  try {
    const { userId, title, description, priority, deadline, tags, estimatedHours } = req.body;
    if (!userId || !title) return res.status(400).json({ success: false, message: 'userId and title are required.' });
    const task = await Task.create({ user: userId, title, description, priority: priority || 'Medium', deadline, tags, estimatedHours });
    await Notification.create({ user: userId, type: 'System', title: 'New Task Assigned', message: `"${title}" has been assigned to you`, task: task._id });
    res.status(201).json({ success: true, task });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/admin/notify — send notification to one or all employees
router.post('/notify', async (req, res) => {
  try {
    const { userIds, title, message, type, urgent } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required.' });
    let targets = userIds;
    let audience = 'Selected';
    if (!targets || targets.length === 0) {
      const all = await User.find().select('_id');
      targets = all.map(u => u._id);
      audience = 'All';
    }
    const validTypes = ['Deadline', 'Overdue', 'Message', 'Completion', 'System', 'Announcement', 'Reminder', 'Alert', 'Task Update'];
    const notiType = validTypes.includes(type) ? type : 'Announcement';
    const groupId = new (require('mongoose').Types.ObjectId)().toString();
    const recipientCount = targets.length;
    const docs = targets.map(uid => ({
      user: uid,
      type: notiType,
      title: title || 'Admin Notification',
      message,
      urgent: !!urgent,
      groupId,
      audience,
      recipientCount
    }));
    await Notification.insertMany(docs);
    res.json({ success: true, sent: targets.length, groupId });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/admin/notifications/sent — aggregated history of sent broadcasts
router.get('/notifications/sent', async (req, res) => {
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
          recipients: { $push: '$user' }
        }
      },
      { $sort: { createdAt: -1 } },
      { $limit: 50 }
    ]);
    // Populate recipient names for the slide-over
    const userIds = [...new Set(groups.flatMap(g => g.recipients.map(r => r.toString())))];
    const users = await User.find({ _id: { $in: userIds } }).select('fullName employeeId');
    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));
    const enriched = groups.map(g => ({
      groupId: g._id,
      type: g.type,
      title: g.title,
      message: g.message,
      urgent: g.urgent,
      audience: g.audience,
      recipientCount: g.recipientCount,
      createdAt: g.createdAt,
      recipientNames: g.recipients.map(r => userMap[r.toString()]?.fullName).filter(Boolean)
    }));
    res.json({ success: true, groups: enriched });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/admin/activity — unified live activity feed for the dashboard.
// Merges recent task creates, task completions, and check-ins/check-outs from
// the last 7 days, returns the newest 10 events.
router.get('/activity', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [createdTasks, completedTasks, attendanceRecs] = await Promise.all([
      Task.find({ createdAt: { $gte: since } })
        .sort({ createdAt: -1 }).limit(limit * 2)
        .populate('user', 'fullName employeeId'),
      Task.find({ status: 'Completed', completedAt: { $gte: since } })
        .sort({ completedAt: -1 }).limit(limit * 2)
        .populate('user', 'fullName employeeId'),
      Attendance.find({ date: { $gte: since } })
        .sort({ date: -1 }).limit(limit * 2)
        .populate('user', 'fullName employeeId')
    ]);

    const events = [];
    for (const t of createdTasks) {
      if (!t.user) continue;
      events.push({
        kind: 'task_created',
        at: t.createdAt,
        userName: t.user.fullName,
        userId: t.user.employeeId,
        text: 'created task "' + t.title + '"'
      });
    }
    for (const t of completedTasks) {
      if (!t.user) continue;
      events.push({
        kind: 'task_completed',
        at: t.completedAt,
        userName: t.user.fullName,
        userId: t.user.employeeId,
        text: 'marked "' + t.title + '" as Completed'
      });
    }
    for (const a of attendanceRecs) {
      if (!a.user || !a.sessions) continue;
      for (const s of a.sessions) {
        if (s.checkInTime && s.checkInTime >= since) {
          events.push({
            kind: 'check_in',
            at: s.checkInTime,
            userName: a.user.fullName,
            userId: a.user.employeeId,
            text: 'checked in'
          });
        }
        if (s.checkOutTime && s.checkOutTime >= since) {
          events.push({
            kind: 'check_out',
            at: s.checkOutTime,
            userName: a.user.fullName,
            userId: a.user.employeeId,
            text: 'checked out'
          });
        }
      }
    }

    events.sort((a, b) => new Date(b.at) - new Date(a.at));
    res.json({ success: true, count: Math.min(events.length, limit), events: events.slice(0, limit) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/admin/attendance — all attendance records for today
router.get('/attendance', async (req, res) => {
  try {
    const { date } = req.query;
    let start, end;
    if (date) {
      start = new Date(date); start.setHours(0,0,0,0);
      end = new Date(date); end.setHours(23,59,59,999);
    } else {
      start = new Date(); start.setHours(0,0,0,0);
      end = new Date(); end.setHours(23,59,59,999);
    }
    const records = await Attendance.find({ date: { $gte: start, $lte: end } })
      .populate('user', 'fullName employeeId photo role')
      .sort({ 'sessions.0.checkInTime': 1 });
    const present = records.filter(r => r.sessions && r.sessions.length > 0).length;
    const totalEmp = await User.countDocuments();
    res.json({ success: true, count: records.length, present, absent: totalEmp - present, totalEmployees: totalEmp, records });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
