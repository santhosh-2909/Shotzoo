const Task = require('../models/Task');
const Notification = require('../models/Notification');

exports.getTasks = async (req, res) => {
  try {
    const { status, priority, search, sort, page = 1, limit = 50 } = req.query;
    const query = { user: req.user._id };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }
    let sortOpt = { createdAt: -1 };
    if (sort === 'deadline') sortOpt = { deadline: 1 };
    else if (sort === 'priority') sortOpt = { priority: -1 };
    const pg = Number.parseInt(page, 10);
    const lim = Number.parseInt(limit, 10);
    const skip = (pg - 1) * lim;
    const [tasks, total] = await Promise.all([
      Task.find(query).sort(sortOpt).skip(skip).limit(lim),
      Task.countDocuments(query)
    ]);
    res.json({ success: true, count: tasks.length, total, page: pg, pages: Math.ceil(total / lim), tasks });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getTodayTasks = async (req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const tasks = await Task.find({
      user: req.user._id,
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { deadline: { $gte: start, $lte: end } },
        { status: { $in: ['Pending', 'In Progress'] } }
      ]
    }).sort({ priority: -1, deadline: 1 });
    res.json({ success: true, count: tasks.length, tasks });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getTaskStats = async (req, res) => {
  try {
    const uid = req.user._id;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [total, pending, overdue, completedToday] = await Promise.all([
      Task.countDocuments({ user: uid }),
      Task.countDocuments({ user: uid, status: { $in: ['Pending', 'In Progress'] } }),
      Task.countDocuments({ user: uid, status: 'Overdue' }),
      Task.countDocuments({ user: uid, status: 'Completed', completedAt: { $gte: start } })
    ]);
    res.json({ success: true, stats: { total, pending, overdue, completedToday } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getUpcomingDeadlines = async (req, res) => {
  try {
    const tasks = await Task.find({
      user: req.user._id, status: { $in: ['Pending', 'In Progress'] }, deadline: { $gte: new Date() }
    }).sort({ deadline: 1 }).limit(10);
    res.json({ success: true, tasks });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    res.json({ success: true, task });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.createTask = async (req, res) => {
  try {
    req.body.user = req.user._id;
    if (typeof req.body.tags === 'string') {
      req.body.tags = req.body.tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    const task = await Task.create(req.body);
    res.status(201).json({ success: true, task });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.updateTask = async (req, res) => {
  try {
    if (typeof req.body.tags === 'string') {
      req.body.tags = req.body.tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    if (req.body.status === 'Completed') { req.body.completedAt = new Date(); req.body.progress = 100; }
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id }, req.body, { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    if (req.body.status === 'Completed') {
      await Notification.create({ user: req.user._id, type: 'Completion', title: 'Task Completed', message: 'You completed "' + task.title + '"', task: task._id });
    }
    res.json({ success: true, task });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const { status, progress } = req.body;
    const data = { status };
    if (progress !== undefined) data.progress = progress;
    if (status === 'Completed') { data.completedAt = new Date(); data.progress = 100; }
    // Strict ownership: a user can only update the status of their own tasks.
    // Admins still go through /api/admin/* for cross-user actions.
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id }, data, { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    if (status === 'Completed') {
      await Notification.create({ user: task.user, type: 'Completion', title: 'Task Completed', message: 'You completed "' + task.title + '"', task: task._id });
    }
    res.json({ success: true, task });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    res.json({ success: true, message: 'Task deleted.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};
