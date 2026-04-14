import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { sendEmployeeIdEmail } from '../utils/emailService';
import { fileToDataUrl } from '../middleware/upload';

const generateToken = (id: unknown): string =>
  jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRE || '7d') as SignOptions['expiresIn'],
  });

const sendTokenResponse = (user: IUser, statusCode: number, res: Response): void => {
  const token = generateToken(user._id);
  res
    .status(statusCode)
    .cookie('token', token, {
      expires: new Date(Date.now() + 7 * 24 * 3600000),
      httpOnly: true,
      sameSite: 'lax',
    })
    .json({
      success: true,
      token,
      user: {
        _id: user._id,
        employeeId: user.employeeId,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        employeeType: user.employeeType,
        role: user.role,
        photo: user.photo,
        bio: user.bio,
        notifications: user.notifications,
        isAdmin: user.role === 'Admin',
      },
    });
};

// Public admin self-registration — always creates Admin role
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      fullName, email, company, password, confirmPassword,
      phone, workRole, joiningDate, employeeType, dateOfBirth, gender, linkedinUrl, bio,
    } = req.body as {
      fullName?:        string;
      email?:           string;
      company?:         string;
      password?:        string;
      confirmPassword?: string;
      phone?:           string;
      workRole?:        string;
      joiningDate?:     string;
      employeeType?:    string;
      dateOfBirth?:     string;
      gender?:          string;
      linkedinUrl?:     string;
      bio?:             string;
    };

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
    if (await User.findOne({ email })) {
      res.status(400).json({ success: false, message: 'Email already registered.' });
      return;
    }

    const user = await User.create({
      fullName,
      email,
      company,
      phone,
      role:         'Admin',
      password,
      employeeType: employeeType === 'Home' ? 'Home' : 'Office',
      workRole:     workRole    || '',
      joiningDate:  joiningDate ? new Date(joiningDate) : undefined,
      dateOfBirth:  dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender:       gender      || '',
      linkedinUrl:  linkedinUrl || '',
      bio:          bio         || '',
      photo:        fileToDataUrl(req.file) ?? '',
    });

    setTimeout(() => {
      sendEmployeeIdEmail(user.email, user.fullName, user.employeeId);
    }, 100);

    sendTokenResponse(user, 201, res);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// Protected — admin creates an employee account, returns credentials (no token issued)
export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      fullName, email, phone, role, employeeType, password,
      joiningDate, workRole, dateOfBirth, gender, linkedinUrl, bio, company,
    } = req.body as {
      fullName?:     string;
      email?:        string;
      phone?:        string;
      role?:         string;
      employeeType?: string;
      password?:     string;
      joiningDate?:  string;
      workRole?:     string;
      dateOfBirth?:  string;
      gender?:       string;
      linkedinUrl?:  string;
      bio?:          string;
      company?:      string;
    };

    if (!fullName || !email || !password || !phone) {
      res.status(400).json({ success: false, message: 'Name, email, phone and password are required.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      return;
    }
    if (await User.findOne({ email })) {
      res.status(400).json({ success: false, message: 'Email already registered.' });
      return;
    }

    const user = await User.create({
      fullName,
      email,
      phone,
      role:         role || 'Employee',
      password,
      employeeType: employeeType || 'Office',
      joiningDate:  joiningDate  ? new Date(joiningDate)  : undefined,
      dateOfBirth:  dateOfBirth  ? new Date(dateOfBirth)  : undefined,
      workRole:     workRole     || '',
      gender:       gender       || '',
      linkedinUrl:  linkedinUrl  || '',
      bio:          bio          || '',
      company:      company      || '',
    });

    res.status(201).json({
      success: true,
      user: {
        _id:          user._id,
        employeeId:   user.employeeId,
        fullName:     user.fullName,
        email:        user.email,
        phone:        user.phone,
        role:         user.role,
        employeeType: user.employeeType,
        workRole:     user.workRole,
        joiningDate:  user.joiningDate,
        dateOfBirth:  user.dateOfBirth,
        gender:       user.gender,
        linkedinUrl:  user.linkedinUrl,
        bio:          user.bio,
        company:      user.company,
        createdAt:    user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Please provide email and password.' });
      return;
    }

    const query = email.startsWith('SZ-') ? { employeeId: email } : { email };
    const user = await User.findOne(query).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ success: false, message: 'Invalid credentials.' });
      return;
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const logout = (_req: Request, res: Response): void => {
  res.cookie('token', 'none', { expires: new Date(Date.now() + 5000), httpOnly: true });
  res.status(200).json({ success: true, message: 'Logged out.' });
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, user: req.user });
};
