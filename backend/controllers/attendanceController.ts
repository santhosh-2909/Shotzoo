import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import {
  AttendanceRow,
  AttendanceSession,
  attendanceRowToPublic,
  computeAttendanceDerived,
} from '../types/db';

const todayIso = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD — matches Postgres `date` column
};

async function findOrCreateToday(userId: string): Promise<AttendanceRow> {
  const date = todayIso();

  const { data: existing } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (existing) return existing as AttendanceRow;

  const { data: inserted, error } = await supabase
    .from('attendance')
    .insert({ user_id: userId, date, sessions: [], day_started: false })
    .select('*')
    .single();

  if (error || !inserted) {
    // Race condition — another request created it first. Re-fetch.
    const { data: refetch } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();
    if (refetch) return refetch as AttendanceRow;
    throw new Error(error?.message ?? 'Failed to create attendance record.');
  }
  return inserted as AttendanceRow;
}

function getActiveSession(sessions: AttendanceSession[]): AttendanceSession | null {
  if (!sessions.length) return null;
  const last = sessions[sessions.length - 1];
  return last.checkOutTime ? null : last;
}

async function saveAttendance(
  id: string,
  sessions: AttendanceSession[],
  dayStarted: boolean,
): Promise<AttendanceRow> {
  const { hoursWorked, status } = computeAttendanceDerived(sessions);
  const { data, error } = await supabase
    .from('attendance')
    .update({
      sessions,
      day_started:  dayStarted,
      hours_worked: hoursWorked,
      status,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to save attendance.');
  return data as AttendanceRow;
}

// ─── Start Day ────────────────────────────────────────────────────────────
export const startDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const attendance = await findOrCreateToday(req.user!.id);
    if (attendance.day_started) {
      res.status(400).json({ success: false, message: 'Day already started.' });
      return;
    }
    const sessions: AttendanceSession[] = [
      ...(attendance.sessions ?? []),
      { checkInTime: new Date().toISOString(), breaks: [] },
    ];
    const saved = await saveAttendance(attendance.id, sessions, true);
    res.status(201).json({ success: true, attendance: attendanceRowToPublic(saved) });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Check In (second + session) ─────────────────────────────────────────
export const checkIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const attendance = await findOrCreateToday(req.user!.id);
    const sessions = attendance.sessions ?? [];
    if (getActiveSession(sessions)) {
      res.status(400).json({ success: false, message: 'Already checked in. Check out first.' });
      return;
    }
    sessions.push({ checkInTime: new Date().toISOString(), breaks: [] });
    const saved = await saveAttendance(attendance.id, sessions, true);
    res.status(201).json({ success: true, attendance: attendanceRowToPublic(saved) });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Check Out ───────────────────────────────────────────────────────────
export const checkOut = async (req: Request, res: Response): Promise<void> => {
  try {
    const attendance = await findOrCreateToday(req.user!.id);
    const sessions = [...(attendance.sessions ?? [])];
    const active   = getActiveSession(sessions);
    if (!active) {
      res.status(400).json({ success: false, message: 'No active session. Check in first.' });
      return;
    }
    // Close any open break in the active session
    for (const brk of active.breaks ?? []) {
      if (!brk.endTime) brk.endTime = new Date().toISOString();
    }
    active.checkOutTime = new Date().toISOString();

    const saved = await saveAttendance(attendance.id, sessions, attendance.day_started);
    res.json({ success: true, attendance: attendanceRowToPublic(saved) });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Toggle Break ────────────────────────────────────────────────────────
export const toggleBreak = async (req: Request, res: Response): Promise<void> => {
  try {
    const attendance = await findOrCreateToday(req.user!.id);
    const sessions = [...(attendance.sessions ?? [])];
    const active   = getActiveSession(sessions);
    if (!active) {
      res.status(400).json({ success: false, message: 'No active session.' });
      return;
    }
    active.breaks = active.breaks ?? [];
    const openBreak = active.breaks.find((b) => !b.endTime);
    if (openBreak) {
      openBreak.endTime = new Date().toISOString();
    } else {
      active.breaks.push({ startTime: new Date().toISOString() });
    }
    const saved = await saveAttendance(attendance.id, sessions, attendance.day_started);
    res.json({ success: true, attendance: attendanceRowToPublic(saved) });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Today ───────────────────────────────────────────────────────────────
export const getTodayAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', req.user!.id)
      .eq('date', todayIso())
      .maybeSingle();
    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    res.json({
      success:    true,
      attendance: data ? attendanceRowToPublic(data as AttendanceRow) : null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── History ─────────────────────────────────────────────────────────────
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
      const now   = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startDate = start.toISOString().split('T')[0];
      endDate   = end.toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', req.user!.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    const rows: AttendanceRow[] = data ?? [];
    const records = rows.map(attendanceRowToPublic);
    res.json({ success: true, count: records.length, records });
  } catch (error) {
    console.error('Attendance history error:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Stats ───────────────────────────────────────────────────────────────
export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = start.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', req.user!.id)
      .gte('date', startDate)
      .order('date', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    const records: AttendanceRow[] = data ?? [];

    const daysPresent    = records.filter((r) => r.status === 'Present' || r.status === 'Half-day').length;
    const totalHours     = Number.parseFloat(records.reduce((s, r) => s + Number(r.hours_worked), 0).toFixed(1));
    const avgHoursPerDay = daysPresent > 0 ? Number.parseFloat((totalHours / daysPresent).toFixed(1)) : 0;
    const totalSessions  = records.reduce((s, r) => s + (r.sessions?.length ?? 0), 0);

    const weeklyHours: { date: string; day: string; hours: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const rec = records.find((r) => r.date === iso);
      weeklyHours.push({
        date:  iso,
        day:   d.toLocaleDateString('en', { weekday: 'short' }),
        hours: rec ? Number(rec.hours_worked) : 0,
      });
    }

    // Streak — consecutive present days from most recent backward
    let streak = 0;
    for (const r of records) {
      if (r.status === 'Present' || r.status === 'Half-day') streak++;
      else break;
    }

    res.json({
      success: true,
      stats: { daysPresent, totalHours, avgHoursPerDay, totalSessions, streak, weeklyHours },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
