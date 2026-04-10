const DailyReport = require('../models/DailyReport');

const getToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

// Submission windows: BOD 9am-1pm, MOD 2pm-6pm, EOD 6pm-9pm
const WINDOWS = { BOD: [9, 13], MOD: [14, 18], EOD: [18, 21] };

function getWindowStatus(type) {
  const h = new Date().getHours();
  const w = WINDOWS[type];
  if (!w) return 'invalid';
  if (h >= w[0] && h < w[1]) return 'open';
  if (h >= w[1]) return 'closed';
  return 'upcoming';
}

// Human-readable window labels for lock messages
const WINDOW_LABELS = {
  BOD: 'BOD window is 9:00 AM – 1:00 PM',
  MOD: 'MOD window is 2:00 PM – 6:00 PM',
  EOD: 'EOD window is after 6:00 PM'
};

// Submit a daily report. Strict time-window enforcement: each slot can ONLY
// be submitted while its own window is open. Submitting one slot does NOT
// affect any other slot — each row is independent.
exports.submitReport = async (req, res) => {
  try {
    const { type, title, description } = req.body;
    if (!type || !['BOD', 'MOD', 'EOD'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid report type. Must be BOD, MOD, or EOD.' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Report title is required.' });
    }

    const today = getToday();
    const status = getWindowStatus(type);

    // Hard lock: no submissions outside the window. No "late report" path.
    if (status !== 'open') {
      return res.status(400).json({ success: false, message: WINDOW_LABELS[type] });
    }

    // Check if already submitted today for this type only (does not touch other types)
    const existing = await DailyReport.findOne({ user: req.user._id, date: today, type });
    if (existing) {
      return res.status(400).json({ success: false, message: type + ' report already submitted today.' });
    }

    const report = await DailyReport.create({
      user: req.user._id,
      date: today,
      type,
      title: title.trim(),
      description: (description || '').trim(),
      isLate: false,
      lateReason: '',
      submittedAt: new Date()
    });

    res.status(201).json({ success: true, report });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Report already submitted for this period.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get today's reports for current user
exports.getTodayReports = async (req, res) => {
  try {
    const today = getToday();
    const reports = await DailyReport.find({ user: req.user._id, date: today }).sort({ type: 1 });

    // Build status for each type
    const statuses = {};
    for (const type of ['BOD', 'MOD', 'EOD']) {
      const report = reports.find(r => r.type === type);
      if (report) {
        statuses[type] = {
          submitted: true,
          isLate: report.isLate,
          submittedAt: report.submittedAt,
          title: report.title
        };
      } else {
        statuses[type] = {
          submitted: false,
          windowStatus: getWindowStatus(type)
        };
      }
    }

    res.json({ success: true, reports, statuses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get report history (past 30 days or by month)
exports.getHistory = async (req, res) => {
  try {
    const { month } = req.query;
    let start, end;
    if (month) {
      start = new Date(month + '-01');
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      // Last 30 days
      end = new Date();
      start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    }
    const reports = await DailyReport.find({
      user: req.user._id,
      date: { $gte: start, $lte: end }
    }).sort({ date: -1, type: 1 });

    res.json({ success: true, count: reports.length, reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upsert report — submit or update own report for today
exports.upsertReport = async (req, res) => {
  try {
    const { type, title, description } = req.body;
    if (!type || !['BOD', 'MOD', 'EOD'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid report type.' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Report title is required.' });
    }
    const today = getToday();
    const report = await DailyReport.findOneAndUpdate(
      { user: req.user._id, date: today, type },
      { $set: { title: title.trim(), description: (description || '').trim(), submittedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all employees' reports for a given date (admin view)
exports.getAllTodayReports = async (req, res) => {
  try {
    const User = require('../models/User');
    const targetDate = req.query.date ? new Date(req.query.date) : getToday();
    targetDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

    const [users, reports] = await Promise.all([
      User.find().select('fullName employeeId photo role').sort({ createdAt: 1 }),
      DailyReport.find({ date: { $gte: targetDate, $lte: endOfDay } })
    ]);

    const reportMap = {};
    reports.forEach(r => {
      const uid = r.user.toString();
      if (!reportMap[uid]) reportMap[uid] = {};
      reportMap[uid][r.type] = { title: r.title, description: r.description, isLate: r.isLate, submittedAt: r.submittedAt };
    });

    const employees = users.map(u => {
      const uid = u._id.toString();
      const bod = reportMap[uid] && reportMap[uid].BOD ? reportMap[uid].BOD : null;
      const mod = reportMap[uid] && reportMap[uid].MOD ? reportMap[uid].MOD : null;
      const eod = reportMap[uid] && reportMap[uid].EOD ? reportMap[uid].EOD : null;
      const count = [bod, mod, eod].filter(Boolean).length;
      const status = count === 3 ? 'Completed' : count > 0 ? 'Partial' : 'Not Submitted';
      return { user: u, bod, mod, eod, status };
    });

    res.json({ success: true, count: employees.length, employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get report stats
exports.getStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const reports = await DailyReport.find({ user: req.user._id, date: { $gte: startOfMonth } });

    const totalSubmitted = reports.length;
    const onTime = reports.filter(r => !r.isLate).length;
    const late = reports.filter(r => r.isLate).length;
    const bod = reports.filter(r => r.type === 'BOD').length;
    const mod = reports.filter(r => r.type === 'MOD').length;
    const eod = reports.filter(r => r.type === 'EOD').length;

    res.json({ success: true, stats: { totalSubmitted, onTime, late, bod, mod, eod } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
