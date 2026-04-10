const User = require('../models/User');
const { sendOtpEmail } = require('../utils/emailService');

// In-memory OTP store keyed by user id. Each entry: { code, expiresAt }.
// 5-minute TTL. Single-use — verifying clears the entry.
// IMPORTANT: this is process-local and gets wiped on server restart, which is
// fine for a single-instance dev backend. Move to Redis if you ever scale out.
const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
function generateOtp() { return String(Math.floor(100000 + Math.random() * 900000)); }

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, user });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.updateProfile = async (req, res) => {
  try {
    const allowed = [
      'fullName', 'phone', 'email', 'employeeType', 'bio', 'company', 'role',
      'joiningDate', 'gender', 'dateOfBirth', 'linkedinUrl', 'workRole'
    ];
    const updates = {};
    for (const f of allowed) {
      if (req.body[f] === undefined) continue;
      // Empty strings on date fields would fail Mongoose Date casting, so coerce to null.
      if ((f === 'joiningDate' || f === 'dateOfBirth') && req.body[f] === '') {
        updates[f] = null;
      } else {
        updates[f] = req.body[f];
      }
    }
    if (req.file) updates.photo = '/uploads/' + req.file.filename;
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ success: true, user });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ success: false, message: 'Email already in use.' });
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: 'New passwords do not match.' });
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// ---------- Forgot Password (OTP-gated reset) ----------
// Replaces the old "View Password" reveal flow. The user proves email access
// via a 6-digit OTP, then sets a new password without needing to know their
// current one.
//
// Key namespace prefix: 'reset:' so it can't collide with future OTP flows.
//
// SMS delivery is not wired today (no SMS provider in this codebase). The
// frontend disables the "Send to Mobile" pill and falls back to email. If the
// caller passes channel: 'mobile' anyway we reject the request explicitly.

// Mask helpers — used in the request response so the modal can show
// "tej***@gmail.com" / "******7890" without revealing the full value to the
// browser before the user has authenticated against the OTP. Reading them
// back from the API also means we don't have to trust the client to mask
// correctly.
function maskEmail(email) {
  if (!email) return '';
  const parts = String(email).split('@');
  if (parts.length !== 2) return email;
  const local = parts[0];
  const domain = parts[1];
  const visible = local.slice(0, Math.min(3, Math.max(1, local.length - 1)));
  return visible + '*'.repeat(Math.max(1, local.length - visible.length)) + '@' + domain;
}
function maskPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 4) return '*'.repeat(digits.length);
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}

exports.requestPasswordResetOtp = async (req, res) => {
  try {
    const channel = (req.body.channel || 'email').toLowerCase();
    if (channel !== 'email' && channel !== 'mobile') {
      return res.status(400).json({ success: false, message: 'Invalid channel. Use "email" or "mobile".' });
    }
    if (channel === 'mobile') {
      return res.status(501).json({ success: false, message: 'SMS delivery is not configured. Please use email.' });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (!user.email) return res.status(400).json({ success: false, message: 'No email on file.' });

    const code = generateOtp();
    otpStore.set('reset:' + String(user._id), { code, expiresAt: Date.now() + OTP_TTL_MS });
    sendOtpEmail(user.email, user.fullName, code).catch(function () {});
    res.json({
      success: true,
      message: 'OTP sent. Check your email.',
      destination: maskEmail(user.email),
      channel: 'email'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify the OTP and set a new password atomically. We do not have a
// separate "verify only" endpoint because that would let an attacker who
// observed a valid OTP for one second hijack the reset window from a
// different device. Bundling verify+set means the OTP is consumed exactly
// when the password is rotated.
exports.resetPasswordWithOtp = async (req, res) => {
  try {
    const { code, newPassword, confirmPassword } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'OTP code is required.' });
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: 'New passwords do not match.' });

    const key = 'reset:' + String(req.user._id);
    const entry = otpStore.get(key);
    if (!entry) return res.status(400).json({ success: false, message: 'No OTP requested or it has expired.' });
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(key);
      return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });
    }
    if (String(code).trim() !== entry.code) {
      // Leave the entry in place so the user can retry within the window.
      return res.status(401).json({ success: false, message: 'Invalid OTP. Try again.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    user.password = newPassword;
    await user.save();
    otpStore.delete(key); // single-use on success
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const { email, push, weeklyReports, dailyReminderTime } = req.body;
    const updates = {};
    if (email !== undefined) updates['notifications.email'] = email;
    if (push !== undefined) updates['notifications.push'] = push;
    if (weeklyReports !== undefined) updates['notifications.weeklyReports'] = weeklyReports;
    if (dailyReminderTime !== undefined) updates['notifications.dailyReminderTime'] = dailyReminderTime;
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ success: true, user });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};
