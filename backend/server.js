const express = require('express');
const cors = require('cors');
const path = require('node:path');
const cron = require('node-cron');
require('dotenv').config();

const connectDB = require('./config/db');
const Task = require('./models/Task');
const Notification = require('./models/Notification');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5000,http://localhost:3000').split(',');
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use((req, res, next) => {
  req.cookies = {};
  const h = req.headers.cookie;
  if (h) h.split(';').forEach(c => {
    const [name, ...rest] = c.split('=');
    req.cookies[name.trim()] = decodeURIComponent(rest.join('='));
  });
  next();
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes (before static files)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/daily-reports', require('./routes/dailyReports'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Admin panel clean URLs (before static, so /admin doesn't 301)
const ui = path.resolve(__dirname, '..', 'UI');
app.get('/admin', (req, res) => res.sendFile(path.resolve(ui, 'adminsign.html')));
app.get('/admin/register', (req, res) => res.sendFile(path.resolve(ui, 'creatacc.html')));

// Frontend page routes (clean URLs, before static)
const frontend = path.resolve(__dirname, '..', 'frontend');
app.get('/', (req, res) => res.sendFile(path.resolve(frontend, 'splash.html')));
app.get('/signin', (req, res) => res.sendFile(path.resolve(frontend, 'Sign_in.html')));
app.get('/signup', (req, res) => res.redirect('/signin'));
app.get('/dashboard', (req, res) => res.sendFile(path.resolve(frontend, 'Dashboard.html')));
app.get('/add-task', (req, res) => res.sendFile(path.resolve(frontend, 'Add_task.html')));
app.get('/my-tasks', (req, res) => res.sendFile(path.resolve(frontend, 'My_task.html')));
app.get('/daily-reports', (req, res) => res.sendFile(path.resolve(frontend, 'Daily_reports.html')));
app.get('/attendance', (req, res) => res.sendFile(path.resolve(frontend, 'Attendance.html')));
app.get('/notifications', (req, res) => res.sendFile(path.resolve(frontend, 'Notification.html')));
app.get('/profile', (req, res) => res.sendFile(path.resolve(frontend, 'Profile.html')));

// Static file serving (after route definitions so clean URLs take priority)
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/admin', express.static(path.join(__dirname, '..', 'UI')));

// Cron: check overdue tasks every hour
cron.schedule('0 * * * *', async () => {
  try {
    const overdue = await Task.find({ status: { $in: ['Pending', 'In Progress'] }, deadline: { $lt: new Date() } });
    for (const task of overdue) {
      task.status = 'Overdue';
      await task.save();
      const exists = await Notification.findOne({ task: task._id, type: 'Overdue' });
      if (!exists) {
        await Notification.create({ user: task.user, type: 'Overdue', title: 'Task Overdue', message: '"' + task.title + '" has passed its deadline', task: task._id });
      }
    }
    // Deadline approaching (within 24h)
    const soon = await Task.find({ status: { $in: ['Pending', 'In Progress'] }, deadline: { $gt: new Date(), $lte: new Date(Date.now() + 86400000) } });
    for (const task of soon) {
      const exists = await Notification.findOne({ task: task._id, type: 'Deadline', createdAt: { $gte: new Date(Date.now() - 86400000) } });
      if (!exists) {
        await Notification.create({ user: task.user, type: 'Deadline', title: 'Deadline Approaching', message: '"' + task.title + '" is due within 24 hours', task: task._id });
      }
    }
  } catch (e) { console.error('Cron error:', e.message); }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('');
  console.log('  ShotZoo Server Running!');
  console.log('  ========================');
  console.log('  Local:   http://localhost:' + PORT);
  console.log('  API:     http://localhost:' + PORT + '/api/health');
  console.log('');
});
