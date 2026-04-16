import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import {
  DailyReportRow,
  UserRow,
  dailyReportRowToPublic,
  userRowToPublic,
} from '../types/db';

type ReportType = 'BOD' | 'MOD' | 'EOD';

const todayIso = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
};

const WINDOWS: Record<ReportType, [number, number]> = {
  BOD: [9, 11],
  MOD: [14, 18],
  EOD: [18, 21],
};

// Hour-of-day in Asia/Kolkata (IST, UTC+5:30). Vercel serverless runs
// in UTC, so we cannot rely on the host clock for business-hour checks.
function getISTHour(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour:     'numeric',
    hour12:   false,
  }).formatToParts(new Date());
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  return h === 24 ? 0 : h;
}

function getWindowStatus(type: ReportType): 'open' | 'closed' | 'upcoming' | 'invalid' {
  const h = getISTHour();
  const w = WINDOWS[type];
  if (!w) return 'invalid';
  if (h >= w[0] && h < w[1]) return 'open';
  if (h >= w[1]) return 'closed';
  return 'upcoming';
}

const WINDOW_LABELS: Record<ReportType, string> = {
  BOD: 'Upload window for BOD is 9:00 AM – 11:00 AM. Please try again during that time.',
  MOD: 'Upload window for MOD is 2:00 PM – 6:00 PM. Please try again during that time.',
  EOD: 'Upload window for EOD is 6:00 PM – 9:00 PM. Please try again during that time.',
};

export const submitReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, title, description } = req.body as {
      type?: string; title?: string; description?: string;
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
    const date       = todayIso();
    const status     = getWindowStatus(reportType);

    if (status !== 'open') {
      res.status(400).json({ success: false, message: WINDOW_LABELS[reportType] });
      return;
    }

    const { data: existing } = await supabase
      .from('daily_reports')
      .select('id')
      .eq('user_id', req.user!.id)
      .eq('date', date)
      .eq('type', reportType)
      .maybeSingle();

    if (existing) {
      res.status(400).json({ success: false, message: reportType + ' report already submitted today.' });
      return;
    }

    const { data, error } = await supabase
      .from('daily_reports')
      .insert({
        user_id:      req.user!.id,
        date,
        type:         reportType,
        title:        title.trim(),
        description:  (description ?? '').trim(),
        is_late:      false,
        late_reason:  '',
        submitted_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error || !data) {
      res.status(500).json({ success: false, message: error?.message ?? 'Failed to submit report.' });
      return;
    }

    res.status(201).json({ success: true, report: dailyReportRowToPublic(data as DailyReportRow) });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getTodayReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('user_id', req.user!.id)
      .eq('date', todayIso())
      .order('type', { ascending: true });

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }

    const rows: DailyReportRow[] = data ?? [];
    const reports = rows.map(dailyReportRowToPublic);

    const statuses: Record<string, object> = {};
    for (const t of ['BOD', 'MOD', 'EOD'] as ReportType[]) {
      const r = rows.find((x) => x.type === t);
      if (r) {
        statuses[t] = {
          submitted:   true,
          isLate:      r.is_late,
          submittedAt: r.submitted_at,
          title:       r.title,
        };
      } else {
        statuses[t] = { submitted: false, windowStatus: getWindowStatus(t) };
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
    let startDate: string, endDate: string;
    if (month) {
      const start = new Date(month + '-01');
      const end   = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      startDate = start.toISOString().split('T')[0];
      endDate   = end.toISOString().split('T')[0];
    } else {
      const end   = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      startDate = start.toISOString().split('T')[0];
      endDate   = end.toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('user_id', req.user!.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .order('type', { ascending: true });

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    const rows: DailyReportRow[] = data ?? [];
    const reports = rows.map(dailyReportRowToPublic);
    res.json({ success: true, count: reports.length, reports });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const upsertReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, title, description } = req.body as {
      type?: string; title?: string; description?: string;
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
    const date       = todayIso();

    const { data, error } = await supabase
      .from('daily_reports')
      .upsert(
        {
          user_id:      req.user!.id,
          date,
          type:         reportType,
          title:        title.trim(),
          description:  (description ?? '').trim(),
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,date,type' },
      )
      .select('*')
      .single();

    if (error || !data) {
      res.status(500).json({ success: false, message: error?.message ?? 'Failed to save report.' });
      return;
    }

    res.json({ success: true, report: dailyReportRowToPublic(data as DailyReportRow) });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getAllTodayReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const date = req.query.date ? String(req.query.date).split('T')[0] : todayIso();

    const [usersRes, reportsRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, employee_id, photo, role, email, phone, company, employee_type, bio, joining_date, gender, date_of_birth, linkedin_url, work_role, notifications, created_at, updated_at, password')
        .order('created_at', { ascending: true }),
      supabase
        .from('daily_reports')
        .select('*')
        .eq('date', date),
    ]);

    if (usersRes.error) {
      res.status(500).json({ success: false, message: usersRes.error.message });
      return;
    }
    if (reportsRes.error) {
      res.status(500).json({ success: false, message: reportsRes.error.message });
      return;
    }

    const userRows:   UserRow[]        = usersRes.data   ?? [];
    const reportRows: DailyReportRow[] = reportsRes.data ?? [];

    const reportMap: Record<string, Record<string, { title: string; description: string; isLate: boolean; submittedAt: string }>> = {};
    for (const r of reportRows) {
      reportMap[r.user_id] ??= {};
      reportMap[r.user_id][r.type] = {
        title:       r.title,
        description: r.description,
        isLate:      r.is_late,
        submittedAt: r.submitted_at,
      };
    }

    const employees = userRows.map((u) => {
      const bod = reportMap[u.id]?.BOD ?? null;
      const mod = reportMap[u.id]?.MOD ?? null;
      const eod = reportMap[u.id]?.EOD ?? null;
      const count = [bod, mod, eod].filter(Boolean).length;
      const status = count === 3 ? 'Completed' : count > 0 ? 'Partial' : 'Not Submitted';
      return { user: userRowToPublic(u), bod, mod, eod, status };
    });

    res.json({ success: true, count: employees.length, employees });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = start.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('user_id', req.user!.id)
      .gte('date', startDate);

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }

    const reports: DailyReportRow[] = data ?? [];
    const totalSubmitted = reports.length;
    const onTime = reports.filter((r) => !r.is_late).length;
    const late   = reports.filter((r) =>  r.is_late).length;
    const bod    = reports.filter((r) => r.type === 'BOD').length;
    const mod    = reports.filter((r) => r.type === 'MOD').length;
    const eod    = reports.filter((r) => r.type === 'EOD').length;

    res.json({ success: true, stats: { totalSubmitted, onTime, late, bod, mod, eod } });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
