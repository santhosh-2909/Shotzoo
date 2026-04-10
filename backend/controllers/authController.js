const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmployeeIdEmail } = require('../utils/emailService');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);
  res
    .status(statusCode)
    .cookie('token', token, { expires: new Date(Date.now() + 7 * 24 * 3600000), httpOnly: true, sameSite: 'lax' })
    .json({
      success: true, token,
      user: {
        _id: user._id, employeeId: user.employeeId, fullName: user.fullName,
        email: user.email, phone: user.phone, employeeType: user.employeeType,
        role: user.role, photo: user.photo,
        bio: user.bio, notifications: user.notifications
      }
    });
};

// Public admin self-registration — always creates Admin role
exports.register = async (req, res) => {
  try {
    const { fullName, email, company, password, confirmPassword } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    if (await User.findOne({ email })) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }
    const user = await User.create({
      fullName,
      email,
      company: company || '',
      role: 'Admin',
      password,
      employeeType: 'Office',
      photo: req.file ? '/uploads/' + req.file.filename : ''
    });
    setTimeout(() => {
      sendEmployeeIdEmail(user.email, user.fullName, user.employeeId);
    }, 100);
    sendTokenResponse(user, 201, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Protected — admin creates an employee account, returns credentials (no token issued)
exports.createEmployee = async (req, res) => {
  try {
    const { fullName, email, phone, role, employeeType, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    if (await User.findOne({ email })) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }
    const user = await User.create({
      fullName,
      email,
      phone: phone || '',
      role: role || 'Employee',
      password,
      employeeType: employeeType || 'Office'
    });
    res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        employeeId: user.employeeId,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        employeeType: user.employeeType
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password.' });
    }
    const query = email.startsWith('SZ-') ? { employeeId: email } : { email };
    const user = await User.findOne(query).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.logout = (req, res) => {
  res.cookie('token', 'none', { expires: new Date(Date.now() + 5000), httpOnly: true });
  res.status(200).json({ success: true, message: 'Logged out.' });
};

exports.getMe = async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
};
