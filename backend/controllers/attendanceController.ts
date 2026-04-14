import { Request, Response } from 'express';
import Attendance, { IAttendance, ISession } from '../models/Attendance';
import { Types } from 'mongoose';

const getToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

async function findOrCreateToday(userId: Types.ObjectId): Promise<IAttendance> {
  const today = getToday();
  let attendance = await Attendance.findOne({ user: userId, date: today });
  if (!attendance) {
    attendance = await Attendance.create({ user: userId, date: today, sessions: [] });
  }
  return attendance;
}

function getActiveSession(attendance: IAttendance): ISession | null {
  if (!attendance.sessions.length) return null;
  const last = attendance.sessions[attendance.sessions.length - 1] as ISession;
  return last.checkOutTime ? null : last;
}

export const startDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const attendance = await findOrCreateToday(req.user!._id as Types.ObjectId);
    if (attendance.dayStarted) {
      res.status(400).json({ success: false, message: 'Day already started.' });
      return;
    }
    attendance.dayStarted = true;
    attendance.sessions.push({ checkInTime: new Date() } as ISession);
    await attendance.save();
    res.status(201).json({ success: true, attendance });
  } catch (error) {
    const err = error as { code?: number; message: string };
    if (err.code === 11000) {
      res.status(400).json({ success: false, message: 'Day already started.' });
      return;
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const checkIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const attendance = await findOrCreateToday(req.user!._id as Types.ObjectId);
    const active = getActiveSession(attendance);
    if (active) {
      res.status(400).json({ success: false, message: 'Already checked in. Check out first.' });
      return;
    }
    if (!attendance.dayStarted) attendance.dayStarted = true;
    attendance.sessions.push({ checkInTime: new Date() } as ISession);
    await attendance.save();
    res.status(201).json({ success: true, attendance });
  } catch (error) {
    const err = error as { code?: number; message: string };
    if (err.code === 11000) {
      res.status(400).json({ success: false, message: 'Attendance record conflict.' });
      return;
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const checkOut = async (req: Request, res: Response): Promise<void> => {
  try {
    const attendance = await findOrCreateToday(req.user!._id as Types.ObjectId);
    const active = getActiveSession(attendance);
    if (!active) {
      res.status(400).json({ success: false, message: 'No active session. Check in first.' });
      return;
    }
    const openBreak = active.breaks.find((b) => !b.endTime);
    if (openBreak) openBreak.endTime = new Date();
    active.checkOutTime = new Date();
    await attendance.save();
    res.json({ success: true, attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const toggleBreak = async (req: Request, res: Response): Promise<void> => {
  try {
    const attendance = await findOrCreateToday(req.user!._id as Types.ObjectId);
    const active = getActiveSession(attendance);
    if (!active) {
      res.status(400).json({ success: false, message: 'No active session.' });
      return;
    }
    const openBreak = active.breaks.find((b) => !b.endTime);
    if (openBreak) {
      openBreak.endTime = new Date();
    } else {
      active.breaks.push({ startTime: new Date() });
    }
    await attendance.save();
    res.json({ success: true, attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getTodayAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const attendance = await Attendance.findOne({ user: req.user!._id, date: getToday() });
    res.json({ success: true, attendance: attendance || null });
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
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    const records = await Attendance.find({
      user: req.user!._id,
      date: { $gte: start, $lte: end },
    }).sort({ date: 1 });
    res.json({ success: true, count: records.length, records });
  } catch (error) {
    console.error('Attendance history error:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const records = await Attendance.find({ user: req.user!._id, date: { $gte: startOfMonth } });

    const daysPresent = records.filter(
      (r) => r.status === 'Present' || r.status === 'Half-day'
    ).length;
    const totalHours = parseFloat(records.reduce((s, r) => s + r.hoursWorked, 0).toFixed(1));
    const avgHoursPerDay =
      daysPresent > 0 ? parseFloat((totalHours / daysPresent).toFixed(1)) : 0;
    const totalSessions = records.reduce((s, r) => s + r.sessions.length, 0);

    const weeklyHours: { date: string; day: string; hours: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const rec = records.find((r) => r.date.getTime() === d.getTime());
      weeklyHours.push({
        date: d.toISOString().split('T')[0],
        day: d.toLocaleDateString('en', { weekday: 'short' }),
        hours: rec ? rec.hoursWorked : 0,
      });
    }

    let streak = 0;
    const sorted = [...records].sort((a, b) => b.date.getTime() - a.date.getTime());
    for (const r of sorted) {
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
