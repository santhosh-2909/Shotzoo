# ShotZoo — KPI & Task Tracking

Employee task, attendance, and KPI tracking system for small teams. Employees sign up, clock in/out, receive tasks, file daily reports, and managers track everything from an admin panel.

## Features

- Employee registration with auto-generated Employee IDs (format `SZ-YYYY-###`) delivered by email
- Login with either email or Employee ID
- Task management: create, assign, update status, auto-flag overdue tasks
- Attendance check-in / check-out with daily reports
- Notifications for deadlines and overdue tasks (hourly cron job)
- Admin panel for user and task oversight
- JWT-based authentication

## Tech Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT, Nodemailer, node-cron
- **Frontend:** Vanilla HTML/CSS/JS (no framework)
- **Admin UI:** Separate static pages under `UI/`

## Project Structure

```
ShotZoo/
├── backend/         Express API + static file server
│   ├── config/      DB connection
│   ├── controllers/ Route handlers
│   ├── middleware/  Auth middleware
│   ├── models/      Mongoose schemas
│   ├── routes/      API route definitions
│   ├── utils/       Email service, helpers
│   └── server.js    Entry point
├── frontend/        Employee-facing HTML pages
└── UI/              Admin panel HTML pages
```

## Setup

### 1. Prerequisites

- Node.js 18 or newer
- MongoDB running locally (or a connection string to a remote instance)

### 2. Install dependencies

```bash
cd backend
npm install
```

### 3. Configure environment

Create `backend/.env` with:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/shotzoo
JWT_SECRET=your_jwt_secret_here
ALLOWED_ORIGINS=http://localhost:5000,http://localhost:3000

# Email (for sending Employee IDs on signup)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
```

For Gmail, generate an App Password from your Google account (Security → App passwords). Regular passwords will not work.

### 4. Run the server

```bash
npm start
```

The server serves both the API and the frontend on a single port.

- App: http://localhost:5000/
- Sign in: http://localhost:5000/signin
- Dashboard: http://localhost:5000/dashboard
- Admin panel: http://localhost:5000/admin
- Health check: http://localhost:5000/api/health

## API Overview

| Route | Purpose |
|-------|---------|
| `POST /api/auth/register` | Employee signup (emails Employee ID) |
| `POST /api/auth/login` | Login with email or Employee ID |
| `GET  /api/tasks` | List tasks for current user |
| `POST /api/tasks` | Create a task |
| `POST /api/attendance/check-in` | Record check-in |
| `POST /api/attendance/check-out` | Record check-out |
| `GET  /api/notifications` | List notifications |
| `GET  /api/daily-reports` | Daily report history |
| `GET  /api/admin/*` | Admin-only endpoints |

## Background Jobs

A cron job runs every hour to:
- Mark tasks past their deadline as `Overdue` and create a notification
- Warn on tasks due within the next 24 hours

## Troubleshooting

- **Email not sending:** verify `EMAIL_USER` / `EMAIL_PASSWORD` in `.env`. For Gmail, confirm you're using an App Password, not your account password.
- **Cannot connect to MongoDB:** make sure MongoDB is running and `MONGO_URI` is reachable.
- **CORS errors:** add your frontend origin to `ALLOWED_ORIGINS` in `.env`.
- **Port already in use:** another process is on port 5000. Change `PORT` in `.env` or stop the other process.

## License

Private project — all rights reserved.
