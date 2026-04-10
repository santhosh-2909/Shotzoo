const Attendance = require('../models/Attendance');

const getToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

// Find or create today's attendance record
async function findOrCreateToday(userId) {
  const today = getToday();
  let attendance = await Attendance.findOne({ user: userId, date: today });
  if (!attendance) {
    attendance = await Attendance.create({ user: userId, date: today, sessions: [] });
  }
  return attendance;
}

// Get the currently active (open) session — last session without checkOutTime
function getActiveSession(attendance) {
  if (!attendance.sessions.length) return null;
  const last = attendance.sessions[attendance.sessions.length - 1];
  return last.checkOutTime ? null : last;
}

// Start My Day — only once per day, creates first session
exports.startDay = async (req, res) => {
  try {
    const attendance = await findOrCreateToday(req.user._id);
    if (attendance.dayStarted) {
      return res.status(400).json({ success: false, message: 'Day already started.' });
    }
    attendance.dayStarted = true;
    attendance.sessions.push({ checkInTime: new Date() });
    await attendance.save();
    res.status(201).json({ success: true, attendance });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ success: false, message: 'Day already started.' });
    res.status(500).json({ success: false, message: error.message });
  }
};

// Check In — start a new session (allowed multiple times per day, but only if no open session)
exports.checkIn = async (req, res) => {
  try {
    const attendance = await findOrCreateToday(req.user._id);
    const active = getActiveSession(attendance);
    if (active) {
      return res.status(400).json({ success: false, message: 'Already checked in. Check out first.' });
    }
    // Mark day as started if not already
    if (!attendance.dayStarted) attendance.dayStarted = true;
    attendance.sessions.push({ checkInTime: new Date() });
    await attendance.save();
    res.status(201).json({ success: true, attendance });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ success: false, message: 'Attendance record conflict.' });
    res.status(500).json({ success: false, message: error.message });
  }
};

// Check Out — close the current active session
exports.checkOut = async (req, res) => {
  try {
    const attendance = await findOrCreateToday(req.user._id);
    const active = getActiveSession(attendance);
    if (!active) {
      return res.status(400).json({ success: false, message: 'No active session. Check in first.' });
    }
    // Auto-close any open break
    const openBreak = active.breaks.find(b => !b.endTime);
    if (openBreak) openBreak.endTime = new Date();
    active.checkOutTime = new Date();
    await attendance.save();
    res.json({ success: true, attendance });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Toggle Break — start break (pause timer) or end break (resume timer)
exports.toggleBreak = async (req, res) => {
  try {
    const attendance = await findOrCreateToday(req.user._id);
    const active = getActiveSession(attendance);
    if (!active) {
      return res.status(400).json({ success: false, message: 'No active session.' });
    }
    const openBreak = active.breaks.find(b => !b.endTime);
    if (openBreak) {
      // End break — resume work
      openBreak.endTime = new Date();
    } else {
      // Start break — pause work
      active.breaks.push({ startTime: new Date() });
    }
    await attendance.save();
    res.json({ success: true, attendance });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Get today's attendance record
exports.getToday = async (req, res) => {
  try {
    const attendance = await Attendance.findOne({ user: req.user._id, date: getToday() });
    res.json({ success: true, attendance: attendance || null });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Get monthly history
exports.getHistory = async (req, res) => {
  try {
    const { month } = req.query;
    let start, end;
    if (month) {
      start = new Date(month + '-01');
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    const records = await Attendance.find({ user: req.user._id, date: { $gte: start, $lte: end } }).sort({ date: 1 });
    res.json({ success: true, count: records.length, records });
  } catch (error) { 
    console.error('Attendance history error:', error);
    res.status(500).json({ success: false, message: error.message }); 
  }
};

// Get attendance stats
exports.getStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const records = await Attendance.find({ user: req.user._id, date: { $gte: startOfMonth } });
    const daysPresent = records.filter(r => r.status === 'Present' || r.status === 'Half-day').length;
    const totalHours = parseFloat(records.reduce((s, r) => s + r.hoursWorked, 0).toFixed(1));
    const avgHoursPerDay = daysPresent > 0 ? parseFloat((totalHours / daysPresent).toFixed(1)) : 0;

    // Total sessions across month
    const totalSessions = records.reduce((s, r) => s + r.sessions.length, 0);

    // Weekly hours for chart
    const weeklyHours = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const rec = records.find(r => r.date.getTime() === d.getTime());
      weeklyHours.push({ date: d.toISOString().split('T')[0], day: d.toLocaleDateString('en', { weekday: 'short' }), hours: rec ? rec.hoursWorked : 0 });
    }

    // Streak calculation
    let streak = 0;
    const sorted = [...records].sort((a, b) => b.date - a.date);
    for (const r of sorted) {
      if (r.status === 'Present' || r.status === 'Half-day') streak++; else break;
    }

    res.json({ success: true, stats: { daysPresent, totalHours, avgHoursPerDay, totalSessions, streak, weeklyHours } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};
