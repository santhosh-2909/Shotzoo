import { Request, Response } from 'express';
import DailyReport, { ReportType } from '../models/DailyReport';
import User from '../models/User';

const getToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const WINDOWS: Record<ReportType, [number, number]> = {
  BOD: [9, 13],
  MOD: [14, 18],
  EOD: [18, 21],
};

function getWindowStatus(type: ReportType): 'open' | 'closed' | 'upcoming' | 'invalid' {
  const h = new Date().getHours();
  const w = WINDOWS[type];
  if (!w) return 'invalid';
  if (h >= w[0] && h < w[1]) return 'open';
  if (h >= w[1]) return 'closed';
  return 'upcoming';
}

const WINDOW_LABELS: Record<ReportType, string> = {
  BOD: 'BOD window is 9:00 AM – 1:00 PM',
  MOD: 'MOD window is 2:00 PM – 6:00 PM',
  EOD: 'EOD window is after 6:00 PM',
};

export const submitReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, title, description } = req.body as {
      type?: string;
      title?: string;
      description?: string;
    };

    if (!type || !['BOD', 'MOD', 'EOD'].includes(type)) {
      res.status(400).json({ success: false, message: 'Invalid report type. Must be BOD, MOD, or EOD.' });
      return;
    }
    if (!title || !title.trim()) {
      res.status(400).json({ success: false, message: 'Report title is required.' });
      return;
    }

    const reportType = type as ReportType;
    const today = getToday();
    const status = getWindowStatus(reportType);

    if (status !== 'open') {
      res.status(400).json({ success: false, message: WINDOW_LABELS[reportType] });
      return;
    }

    const existing = await DailyReport.findOne({ user: req.user!._id, date: today, type: reportType });
    if (existing) {
      res.status(400).json({ success: false, message: reportType + ' report already submitted today.' });
      return;
    }

    const report = await DailyReport.create({
      user: req.user!._id,
      date: today,
      type: reportType,
      title: title.trim(),
      description: (description || '').trim(),
      isLate: false,
      lateReason: '',
      submittedAt: new Date(),
    });

    res.status(201).json({ success: true, report });
  } catch (error) {
    const err = error as { code?: number; message: string };
    if (err.code === 11000) {
      res.status(400).json({ success: false, message: 'Report already submitted for this period.' });
      return;
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTodayReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = getToday();
    const reports = await DailyReport.find({ user: req.user!._id, date: today }).sort({ type: 1 });

    const statuses: Record<string, object> = {};
    for (const type of ['BOD', 'MOD', 'EOD'] as ReportType[]) {
      const report = reports.find((r) => r.type === type);
      if (report) {
        statuses[type] = {
          submitted: true,
          isLate: report.isLate,
          submittedAt: report.submittedAt,
          title: report.title,
        };
      } else {
        statuses[type] = {
          submitted: false,
          windowStatus: getWindowStatus(type),
        };
      }
    }

    res.json({ success: true, reports, statuses });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month } = req.query as { month?: string };
    let start: Date, end: Date;
    if (month) {
      start = new Date(month + '-01');
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      end = new Date();
      start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    }
    const reports = await DailyReport.find({
      user: req.user!._id,
      date: { $gte: start, $lte: end },
    }).sort({ date: -1, type: 1 });

    res.json({ success: true, count: reports.length, reports });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const upsertReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, title, description } = req.body as {
      type?: string;
      title?: string;
      description?: string;
    };

    if (!type || !['BOD', 'MOD', 'EOD'].includes(type)) {
      res.status(400).json({ success: false, message: 'Invalid report type.' });
      return;
    }
    if (!title || !title.trim()) {
      res.status(400).json({ success: false, message: 'Report title is required.' });
      return;
    }

    const reportType = type as ReportType;
    const today = getToday();
    const report = await DailyReport.findOneAndUpdate(
      { user: req.user!._id, date: today, type: reportType },
      { $set: { title: title.trim(), description: (description || '').trim(), submittedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getAllTodayReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetDate = req.query.date ? new Date(req.query.date as string) : getToday();
    targetDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [users, reports] = await Promise.all([
      User.find().select('fullName employeeId photo role').sort({ createdAt: 1 }),
      DailyReport.find({ date: { $gte: targetDate, $lte: endOfDay } }),
    ]);

    const reportMap: Record<string, Record<string, { title: string; description: string; isLate: boolean; submittedAt: Date }>> = {};
    reports.forEach((r) => {
      const uid = r.user.toString();
      if (!reportMap[uid]) reportMap[uid] = {};
      reportMap[uid][r.type] = {
        title: r.title,
        description: r.description,
        isLate: r.isLate,
        submittedAt: r.submittedAt,
      };
    });

    const employees = users.map((u) => {
      const uid = u._id.toString();
      const bod = reportMap[uid]?.BOD ?? null;
      const mod = reportMap[uid]?.MOD ?? null;
      const eod = reportMap[uid]?.EOD ?? null;
      const count = [bod, mod, eod].filter(Boolean).length;
      const status = count === 3 ? 'Completed' : count > 0 ? 'Partial' : 'Not Submitted';
      return { user: u, bod, mod, eod, status };
    });

    res.json({ success: true, count: employees.length, employees });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const reports = await DailyReport.find({ user: req.user!._id, date: { $gte: startOfMonth } });

    const totalSubmitted = reports.length;
    const onTime = reports.filter((r) => !r.isLate).length;
    const late = reports.filter((r) => r.isLate).length;
    const bod = reports.filter((r) => r.type === 'BOD').length;
    const mod = reports.filter((r) => r.type === 'MOD').length;
    const eod = reports.filter((r) => r.type === 'EOD').length;

    res.json({ success: true, stats: { totalSubmitted, onTime, late, bod, mod, eod } });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
