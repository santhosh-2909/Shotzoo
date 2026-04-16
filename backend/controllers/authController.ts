import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase';
import { UserRow, userRowToPublic, randomEmployeeId } from '../types/db';
import { sendEmployeeIdEmail } from '../utils/emailService';
import { fileToDataUrl } from '../middleware/upload';

const generateToken = (id: string): string =>
  jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRE || '7d') as SignOptions['expiresIn'],
  });

const sendTokenResponse = (user: UserRow, statusCode: number, res: Response): void => {
  const token = generateToken(user.id);
  res
    .status(statusCode)
    .cookie('token', token, {
      expires:  new Date(Date.now() + 7 * 24 * 3600000),
      httpOnly: true,
      sameSite: 'lax',
    })
    .json({
      success: true,
      token,
      user: userRowToPublic(user),
    });
};

// Generate a unique employee ID, retrying on collision.
async function uniqueEmployeeId(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = randomEmployeeId();
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('employee_id', candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  // Extremely unlikely — fall back to a longer ID
  return 'SZ-EMP-' + Date.now().toString().slice(-6);
}

// ─── First-admin-only self-registration ───────────────────────────────────
// Public, but rejected once any Admin row exists. Further admins must be
// provisioned from inside the admin console.
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { count: adminCount, error: countErr } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'Admin');

    if (countErr) {
      res.status(500).json({ success: false, message: countErr.message });
      return;
    }
    if ((adminCount ?? 0) > 0) {
      res.status(403).json({
        success: false,
        message: 'Registration is closed. Contact your admin.',
      });
      return;
    }

    const {
      fullName, email, company, password, confirmPassword,
      phone, workRole, joiningDate, employeeType, dateOfBirth, gender, linkedinUrl, bio,
    } = req.body as Record<string, string | undefined>;

    if (!fullName || !email || !password || !phone || !company) {
      res.status(400).json({ success: false, message: 'Name, email, phone, company and password are required.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Passwords do not match.' });
      return;
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (existing) {
      res.status(400).json({ success: false, message: 'Email already registered.' });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const employee_id = await uniqueEmployeeId();

    const { data: inserted, error } = await supabase
      .from('users')
      .insert({
        employee_id,
        full_name:     fullName,
        email:         email.toLowerCase(),
        company,
        phone,
        role:          'Admin',
        password:      hash,
        employee_type: employeeType === 'Home' ? 'Home' : 'Office',
        work_role:     workRole ?? '',
        joining_date:  joiningDate || null,
        date_of_birth: dateOfBirth || null,
        gender:        (gender ?? '') as UserRow['gender'],
        linkedin_url:  linkedinUrl ?? '',
        bio:           bio ?? '',
        photo:         fileToDataUrl(req.file) ?? '',
      })
      .select('*')
      .single();

    if (error || !inserted) {
      res.status(500).json({ success: false, message: error?.message ?? 'Failed to create user.' });
      return;
    }

    setTimeout(() => {
      void sendEmployeeIdEmail(inserted.email, inserted.full_name, inserted.employee_id);
    }, 100);

    sendTokenResponse(inserted as UserRow, 201, res);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Admin creates an employee account ────────────────────────────────────
export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      fullName, email, phone, role, employeeType, password,
      joiningDate, workRole, dateOfBirth, gender, linkedinUrl, bio, company,
    } = req.body as Record<string, string | undefined>;

    if (!fullName || !email || !password || !phone) {
      res.status(400).json({ success: false, message: 'Name, email, phone and password are required.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      return;
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (existing) {
      res.status(400).json({ success: false, message: 'Email already registered.' });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const employee_id = await uniqueEmployeeId();

    const { data: inserted, error } = await supabase
      .from('users')
      .insert({
        employee_id,
        full_name:     fullName,
        email:         email.toLowerCase(),
        phone,
        role:          role || 'Employee',
        password:      hash,
        employee_type: employeeType === 'Home' ? 'Home' : 'Office',
        joining_date:  joiningDate || null,
        date_of_birth: dateOfBirth || null,
        work_role:     workRole    ?? '',
        gender:        (gender ?? '') as UserRow['gender'],
        linkedin_url:  linkedinUrl ?? '',
        bio:           bio         ?? '',
        company:       company     ?? '',
      })
      .select('*')
      .single();

    if (error || !inserted) {
      res.status(500).json({ success: false, message: error?.message ?? 'Failed to create employee.' });
      return;
    }

    res.status(201).json({
      success: true,
      user:    userRowToPublic(inserted as UserRow),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Login ───────────────────────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Please provide email and password.' });
      return;
    }

    // Accept either an email or an employee ID (SZ-EMP-XXXX)
    const query = email.startsWith('SZ-')
      ? supabase.from('users').select('*').eq('employee_id', email)
      : supabase.from('users').select('*').eq('email', email.toLowerCase());

    const { data: user } = await query.maybeSingle();

    if (!user) {
      res.status(401).json({ success: false, message: 'Account not found. Contact your admin.' });
      return;
    }
    if (!(await bcrypt.compare(password, (user as UserRow).password))) {
      res.status(401).json({ success: false, message: 'Invalid credentials.' });
      return;
    }

    sendTokenResponse(user as UserRow, 200, res);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const logout = (_req: Request, res: Response): void => {
  res.cookie('token', 'none', { expires: new Date(Date.now() + 5000), httpOnly: true });
  res.status(200).json({ success: true, message: 'Logged out.' });
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, user: userRowToPublic(req.user!) });
};

// ─── Check whether any admin exists (public) ──────────────────────────────
// Used by the frontend SetupGate on app load to decide whether to force
// the user onto /setup (first-run) or let them hit /signin normally.
export const checkSetup = async (_req: Request, res: Response): Promise<void> => {
  try {
    const { count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'Admin');

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    res.json({ success: true, data: { hasAdmin: (count ?? 0) > 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// Generate a unique SZ-ADM-XXXX employee ID.
async function uniqueAdminId(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const n = Math.floor(1000 + Math.random() * 9000);
    const cand = 'SZ-ADM-' + String(n);
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('employee_id', cand)
      .maybeSingle();
    if (!data) return cand;
  }
  return 'SZ-ADM-' + Date.now().toString().slice(-6);
}

// ─── First-admin-only setup (public, rejects if admin exists) ─────────────
// Behaves like register BUT refuses once any Admin row exists. Accepts both
// the spec's field names (name, companyName, workType) and the existing
// app's names (fullName, company, employeeType) so both frontends work.
export const setupAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { count: adminCount, error: countErr } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'Admin');

    if (countErr) {
      res.status(500).json({ success: false, message: countErr.message });
      return;
    }
    if ((adminCount ?? 0) > 0) {
      res.status(403).json({
        success: false,
        message: 'An admin account already exists. Please sign in instead.',
      });
      return;
    }

    const body = req.body as Record<string, string | undefined>;
    const name     = (body.fullName ?? body.name ?? '').trim();
    const company  = (body.company ?? body.companyName ?? '').trim();
    const email    = (body.email ?? '').trim().toLowerCase();
    const phone    = (body.phone ?? '').trim();
    const password = body.password ?? '';
    const confirm  = body.confirmPassword;

    if (!name || !email || !password || !phone || !company) {
      res.status(400).json({
        success: false,
        message: 'Name, email, phone, company and password are required.',
      });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
      return;
    }
    if (confirm !== undefined && password !== confirm) {
      res.status(400).json({ success: false, message: 'Passwords do not match.' });
      return;
    }

    const wt = (body.workType ?? body.employeeType ?? 'office').toLowerCase();
    const employee_type: UserRow['employee_type'] =
      wt === 'home' || wt === 'remote' || wt === 'hybrid' ? 'Home' : 'Office';

    const hash        = await bcrypt.hash(password, 12);
    const employee_id = await uniqueAdminId();

    const { data: inserted, error } = await supabase
      .from('users')
      .insert({
        employee_id,
        full_name:     name,
        email,
        company,
        phone,
        role:          'Admin',
        password:      hash,
        employee_type,
        work_role:     body.workRole    ?? '',
        joining_date:  body.joiningDate || null,
        date_of_birth: body.dateOfBirth || null,
        gender:        (body.gender ?? '') as UserRow['gender'],
        linkedin_url:  body.linkedinUrl ?? '',
        bio:           body.bio         ?? '',
      })
      .select('*')
      .single();

    if (error || !inserted) {
      if (error?.code === '23505') {
        res.status(400).json({ success: false, message: 'Email already in use.' });
        return;
      }
      res.status(500).json({ success: false, message: error?.message ?? 'Failed to create admin.' });
      return;
    }

    sendTokenResponse(inserted as UserRow, 201, res);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
