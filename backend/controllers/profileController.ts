import { Request, Response } from 'express';
import User from '../models/User';
import { sendOtpEmail } from '../utils/emailService';

interface OtpEntry {
  code: string;
  expiresAt: number;
}

// In-memory OTP store keyed by user id. Each entry: { code, expiresAt }.
// 5-minute TTL. Single-use — verifying clears the entry.
const otpStore = new Map<string, OtpEntry>();
const OTP_TTL_MS = 5 * 60 * 1000;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskEmail(email: string): string {
  if (!email) return '';
  const parts = String(email).split('@');
  if (parts.length !== 2) return email;
  const local = parts[0];
  const domain = parts[1];
  const visible = local.slice(0, Math.min(3, Math.max(1, local.length - 1)));
  return visible + '*'.repeat(Math.max(1, local.length - visible.length)) + '@' + domain;
}


export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const allowed = [
      'fullName', 'phone', 'email', 'employeeType', 'bio', 'company', 'role',
      'joiningDate', 'gender', 'dateOfBirth', 'linkedinUrl', 'workRole',
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const f of allowed) {
      if ((req.body as Record<string, unknown>)[f] === undefined) continue;
      if ((f === 'joiningDate' || f === 'dateOfBirth') && req.body[f] === '') {
        updates[f] = null;
      } else {
        updates[f] = req.body[f];
      }
    }
    if (req.file) updates.photo = '/uploads/' + req.file.filename;

    const user = await User.findByIdAndUpdate(req.user!._id, updates, {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, user });
  } catch (error) {
    const err = error as { code?: number; message: string };
    if (err.code === 11000) {
      res.status(400).json({ success: false, message: 'Email already in use.' });
      return;
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, message: 'New passwords do not match.' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      return;
    }

    const user = await User.findById(req.user!._id).select('+password');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    if (!(await user.comparePassword(currentPassword || ''))) {
      res.status(401).json({ success: false, message: 'Current password is incorrect.' });
      return;
    }

    user.password = newPassword;
    await user.save();
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

    const user = await User.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    if (!user.email) {
      res.status(400).json({ success: false, message: 'No email on file.' });
      return;
    }

    const code = generateOtp();
    otpStore.set('reset:' + String(user._id), { code, expiresAt: Date.now() + OTP_TTL_MS });
    sendOtpEmail(user.email, user.fullName, code).catch(() => {});

    res.json({
      success: true,
      message: 'OTP sent. Check your email.',
      destination: maskEmail(user.email),
      channel: 'email',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const resetPasswordWithOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, newPassword, confirmPassword } = req.body as {
      code?: string;
      newPassword?: string;
      confirmPassword?: string;
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

    const key = 'reset:' + String(req.user!._id);
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

    const user = await User.findById(req.user!._id).select('+password');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    user.password = newPassword;
    await user.save();
    otpStore.delete(key);
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const updatePreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, push, weeklyReports, dailyReminderTime } = req.body as {
      email?: boolean;
      push?: boolean;
      weeklyReports?: boolean;
      dailyReminderTime?: string;
    };

    const updates: Record<string, unknown> = {};
    if (email !== undefined) updates['notifications.email'] = email;
    if (push !== undefined) updates['notifications.push'] = push;
    if (weeklyReports !== undefined) updates['notifications.weeklyReports'] = weeklyReports;
    if (dailyReminderTime !== undefined) updates['notifications.dailyReminderTime'] = dailyReminderTime;

    const user = await User.findByIdAndUpdate(req.user!._id, updates, { new: true });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
