import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import cron from 'node-cron';
import dotenv from 'dotenv';
dotenv.config();

import connectDB from './config/db';
import Task from './models/Task';
import Notification from './models/Notification';

import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import attendanceRoutes from './routes/attendance';
import notificationRoutes from './routes/notifications';
import profileRoutes from './routes/profile';
import dailyReportRoutes from './routes/dailyReports';
import adminRoutes from './routes/admin';

const app = express();
const isProd    = process.env.NODE_ENV === 'production';
const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Kick off DB connection at module load. In long-running mode it resolves
// before the first request; in serverless cold start, the mongoose driver
// buffers operations until the connection opens (bufferCommands default).
connectDB().catch((err: Error) => {
  console.error('DB connect failed:', err.message);
});

app.use(
  helmet({
    contentSecurityPolicy: isProd ? undefined : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(compression());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5000,http://localhost:5173')
  .split(',')
  .map((o) => o.trim());
app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Same-origin (no Origin header) → allow. Whitelisted → allow.
      // Vercel preview deploys → allow *.vercel.app if the base is in the list.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (allowedOrigins.some(o => o.endsWith('.vercel.app')) && origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  req.cookies = {} as Record<string, string>;
  const h = req.headers.cookie;
  if (h) {
    h.split(';').forEach((c) => {
      const [name, ...rest] = c.split('=');
      (req.cookies as Record<string, string>)[name.trim()] = decodeURIComponent(rest.join('='));
    });
  }
  next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 300 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' },
});

// Uploads are stored inline in the User doc (base64 data URLs), but we keep
// the /uploads static route for any legacy paths when running locally.
if (!isServerless) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tasks', apiLimiter, taskRoutes);
app.use('/api/attendance', apiLimiter, attendanceRoutes);
app.use('/api/notifications', apiLimiter, notificationRoutes);
app.use('/api/profile', apiLimiter, profileRoutes);
app.use('/api/daily-reports', apiLimiter, dailyReportRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);

app.get('/api/health', (_req: Request, res: Response) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
);

// Local-only SPA fallback. On Vercel, the frontend is served by Vercel's
// static hosting — the serverless function only handles /api/*.
if (isProd && !isServerless) {
  const frontendDist = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(frontendDist));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.resolve(frontendDist, 'index.html'));
  });
}

// Cron only makes sense for a long-running process. Serverless instances
// are ephemeral, so no periodic work here — set up a Vercel Cron or similar.
if (!isServerless) {
  cron.schedule('0 * * * *', async () => {
    try {
      const overdue = await Task.find({
        status: { $in: ['Pending', 'In Progress'] },
        deadline: { $lt: new Date() },
      });
      for (const task of overdue) {
        task.status = 'Overdue';
        await task.save();
        const exists = await Notification.findOne({ task: task._id, type: 'Overdue' });
        if (!exists) {
          await Notification.create({
            user: task.user,
            type: 'Overdue',
            title: 'Task Overdue',
            message: '"' + task.title + '" has passed its deadline',
            task: task._id,
          });
        }
      }
      const soon = await Task.find({
        status: { $in: ['Pending', 'In Progress'] },
        deadline: { $gt: new Date(), $lte: new Date(Date.now() + 86400000) },
      });
      for (const task of soon) {
        const exists = await Notification.findOne({
          task: task._id,
          type: 'Deadline',
          createdAt: { $gte: new Date(Date.now() - 86400000) },
        });
        if (!exists) {
          await Notification.create({
            user: task.user,
            type: 'Deadline',
            title: 'Deadline Approaching',
            message: '"' + task.title + '" is due within 24 hours',
            task: task._id,
          });
        }
      }
    } catch (e) {
      console.error('Cron error:', (e as Error).message);
    }
  });
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Only start a listener when run as a long-lived process (node dist/server.js).
// In serverless, Vercel invokes the exported default app as a handler.
if (!isServerless && require.main === module) {
  const PORT = Number(process.env.PORT) || 5000;
  app.listen(PORT, () => {
    console.log('');
    console.log('  ShotZoo Server Running');
    console.log('  ========================');
    console.log('  Mode:    ' + (isProd ? 'production' : 'development'));
    console.log('  Local:   http://localhost:' + PORT);
    console.log('  API:     http://localhost:' + PORT + '/api/health');
    console.log('');
  });
}

export default app;
