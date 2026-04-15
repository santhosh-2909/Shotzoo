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

// CORS — permissive for known-safe origins, strict for everything else.
//
// Dev (NODE_ENV != production):
//   - Any http(s)://localhost:<port>
//   - Any http(s)://127.0.0.1:<port>
//   - Any http(s)://[::1]:<port>
//   - Any http(s)://<private-LAN-IP>:<port>  (192.168.x, 10.x, 172.16–31.x)
//   - Anything explicitly in ALLOWED_ORIGINS
//   - Any *.vercel.app subdomain
//
// Production (NODE_ENV=production):
//   - Anything explicitly in ALLOWED_ORIGINS env var (custom domain support)
//   - Any *.vercel.app subdomain (canonical prod URL + every git/preview deploy)
//   - Nothing else
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const PRIVATE_LAN_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?$/;

// Vercel hands out subdomains like:
//   shotzoo-2026.vercel.app                             (canonical prod)
//   shotzoo-2026-git-main-santhosh-ss-projects.vercel.app   (git branch preview)
//   shotzoo-2026-abc123-santhosh-ss-projects.vercel.app     (deployment preview)
// All of them share the .vercel.app suffix and use [a-z0-9-] in the host.
const VERCEL_APP_RE = /^https:\/\/[a-z0-9][a-z0-9-]*\.vercel\.app$/i;

const isAllowedOrigin = (origin: string): boolean => {
  if (allowedOrigins.includes(origin)) return true;
  if (VERCEL_APP_RE.test(origin)) return true;
  if (!isProd && PRIVATE_LAN_RE.test(origin)) return true;
  return false;
};

const corsMiddleware = cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Same-origin / curl / mobile / server-side → no Origin header
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
});
app.use(corsMiddleware);
app.options('*', corsMiddleware);

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

// JSON 404 for any unmatched /api/* route (so the frontend never has to
// JSON-parse Express's default HTML error page).
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found: ' + req.method + ' ' + req.originalUrl,
  });
});

// Error handler — always returns JSON. Recognizes multer errors, mongoose
// validation errors, and CORS rejections so the frontend gets a useful
// message instead of "Server error (HTTP 500)".
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Express error type is loose
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack || err.message || err);

  if (res.headersSent) {
    return next(err);
  }

  // Multer file upload errors
  if (err?.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      success: false,
      message: err.message || 'File upload failed',
    });
  }

  // Mongoose validation errors
  if (err?.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: err.message || 'Validation failed',
    });
  }

  // Mongoose duplicate key (e.g. email already exists)
  if (err?.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'A record with that value already exists.',
    });
  }

  // CORS rejection
  if (typeof err?.message === 'string' && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  // Generic fallback
  const status = typeof err?.status === 'number' ? err.status : 500;
  return res.status(status).json({
    success: false,
    message: err?.message || 'Internal server error',
  });
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
