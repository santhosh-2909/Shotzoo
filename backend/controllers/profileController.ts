import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase';
import { UserRow, userRowToPublic } from '../types/db';
import { sendOtpEmail } from '../utils/emailService';
import { fileToDataUrl } from '../middleware/upload';

interface OtpEntry {
  code:      string;
  expiresAt: number;
}

// In-memory OTP store. 5-minute TTL, single-use.
const otpStore = new Map<string, OtpEntry>();
const OTP_TTL_MS = 5 * 60 * 1000;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskEmail(email: string): string {
  if (!email) return '';
  const parts = String(email).split('@');
  if (parts.length !== 2) return email;
  const local  = parts[0];
  const domain = parts[1];
  const visible = local.slice(0, Math.min(3, Math.max(1, local.length - 1)));
  return visible + '*'.repeat(Math.max(1, local.length - visible.length)) + '@' + domain;
}

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user!.id)
      .maybeSingle();
    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    res.json({ success: true, user: data ? userRowToPublic(data as UserRow) : null });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// Map camelCase incoming fields → snake_case DB columns
const FIELD_MAP: Record<string, string> = {
  fullName:     'full_name',
  phone:        'phone',
  email:        'email',
  employeeType: 'employee_type',
  bio:          'bio',
  company:      'company',
  role:         'role',
  joiningDate:  'joining_date',
  gender:       'gender',
  dateOfBirth:  'date_of_birth',
  linkedinUrl:  'linkedin_url',
  workRole:     'work_role',
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    for (const [camel, snake] of Object.entries(FIELD_MAP)) {
      if (body[camel] === undefined) continue;
      if ((snake === 'joining_date' || snake === 'date_of_birth') && body[camel] === '') {
        updates[snake] = null;
      } else if (snake === 'email' && typeof body[camel] === 'string') {
        updates[snake] = (body[camel] as string).toLowerCase();
      } else {
        updates[snake] = body[camel];
      }
    }

    const dataUrl = fileToDataUrl(req.file);
    if (dataUrl) updates.photo = dataUrl;

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user!.id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        res.status(400).json({ success: false, message: 'Email already in use.' });
        return;
      }
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    res.json({ success: true, user: data ? userRowToPublic(data as UserRow) : null });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body as {
      currentPassword?: string; newPassword?: string; confirmPassword?: string;
    };

    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, message: 'New passwords do not match.' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      return;
    }

    const user = req.user!;
    if (!(await bcrypt.compare(currentPassword || '', user.password))) {
      res.status(401).json({ success: false, message: 'Current password is incorrect.' });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 12);
    const { error } = await supabase
      .from('users')
      .update({ password: hash })
      .eq('id', user.id);

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const requestPasswordResetOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const channel = ((req.body as { channel?: string }).channel || 'email').toLowerCase();
    if (channel !== 'email' && channel !== 'mobile') {
      res.status(400).json({ success: false, message: 'Invalid channel. Use "email" or "mobile".' });
      return;
    }
    if (channel === 'mobile') {
      res.status(501).json({ success: false, message: 'SMS delivery is not configured. Please use email.' });
      return;
    }

    const user = req.user!;
    if (!user.email) {
      res.status(400).json({ success: false, message: 'No email on file.' });
      return;
    }

    const code = generateOtp();
    otpStore.set('reset:' + user.id, { code, expiresAt: Date.now() + OTP_TTL_MS });
    sendOtpEmail(user.email, user.full_name, code).catch(() => { /* best-effort */ });

    res.json({
      success:     true,
      message:     'OTP sent. Check your email.',
      destination: maskEmail(user.email),
      channel:     'email',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const resetPasswordWithOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, newPassword, confirmPassword } = req.body as {
      code?: string; newPassword?: string; confirmPassword?: string;
    };

    if (!code) {
      res.status(400).json({ success: false, message: 'OTP code is required.' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, message: 'New passwords do not match.' });
      return;
    }

    const key = 'reset:' + req.user!.id;
    const entry = otpStore.get(key);
    if (!entry) {
      res.status(400).json({ success: false, message: 'No OTP requested or it has expired.' });
      return;
    }
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(key);
      res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });
      return;
    }
    if (String(code).trim() !== entry.code) {
      res.status(401).json({ success: false, message: 'Invalid OTP. Try again.' });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 12);
    const { error } = await supabase
      .from('users')
      .update({ password: hash })
      .eq('id', req.user!.id);

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }

    otpStore.delete(key);
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const updatePreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, push, weeklyReports, dailyReminderTime } = req.body as {
      email?: boolean; push?: boolean; weeklyReports?: boolean; dailyReminderTime?: string;
    };

    // Merge with existing notifications JSONB column
    const current = req.user!.notifications ?? {
      email: true, push: true, weeklyReports: false, dailyReminderTime: '09:00',
    };
    const updated = {
      email:             email             !== undefined ? email             : current.email,
      push:              push              !== undefined ? push              : current.push,
      weeklyReports:     weeklyReports     !== undefined ? weeklyReports     : current.weeklyReports,
      dailyReminderTime: dailyReminderTime !== undefined ? dailyReminderTime : current.dailyReminderTime,
    };

    const { data, error } = await supabase
      .from('users')
      .update({ notifications: updated })
      .eq('id', req.user!.id)
      .select('*')
      .single();

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    res.json({ success: true, user: data ? userRowToPublic(data as UserRow) : null });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
