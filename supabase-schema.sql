-- ═════════════════════════════════════════════════════════════════════════
-- ShotZoo — Supabase / Postgres schema
-- ═════════════════════════════════════════════════════════════════════════
-- HOW TO APPLY:
--   1. Open your Supabase project → left sidebar → "SQL Editor"
--   2. Click "New query"
--   3. Paste this whole file
--   4. Click "Run" (or Ctrl+Enter)
--   5. You should see "Success. No rows returned"
--
-- SAFE TO RE-RUN: every CREATE is idempotent (CREATE IF NOT EXISTS or
-- DROP+CREATE for triggers).
-- ═════════════════════════════════════════════════════════════════════════

-- ── Extensions ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

-- ── Shared updated_at trigger function ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ═══ USERS ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   text UNIQUE NOT NULL,
  full_name     text NOT NULL,
  email         text UNIQUE NOT NULL,
  phone         text NOT NULL DEFAULT '',
  company       text NOT NULL DEFAULT '',
  role          text NOT NULL DEFAULT 'Employee',
  password      text NOT NULL,
  photo         text NOT NULL DEFAULT '',
  employee_type text NOT NULL DEFAULT 'Office' CHECK (employee_type IN ('Office','Home')),
  bio           text NOT NULL DEFAULT '',
  joining_date  date,
  gender        text NOT NULL DEFAULT '' CHECK (gender IN ('','Male','Female','Prefer not to say')),
  date_of_birth date,
  linkedin_url  text NOT NULL DEFAULT '',
  work_role     text NOT NULL DEFAULT '',
  notifications jsonb NOT NULL DEFAULT '{"email":true,"push":true,"weeklyReports":false,"dailyReminderTime":"09:00"}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx       ON public.users (lower(email));
CREATE INDEX IF NOT EXISTS users_employee_id_idx ON public.users (employee_id);
CREATE INDEX IF NOT EXISTS users_created_idx     ON public.users (created_at DESC);

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══ TASKS ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text NOT NULL DEFAULT '',
  context           text NOT NULL DEFAULT '',
  execution_steps   text NOT NULL DEFAULT '',
  priority          text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High','Urgent')),
  tags              text[] NOT NULL DEFAULT '{}',
  estimated_hours   numeric NOT NULL DEFAULT 0,
  estimated_minutes integer NOT NULL DEFAULT 0,
  deadline          timestamptz,
  status            text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Completed','Overdue')),
  progress          integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_user_status_idx    ON public.tasks (user_id, status);
CREATE INDEX IF NOT EXISTS tasks_user_deadline_idx  ON public.tasks (user_id, deadline);
CREATE INDEX IF NOT EXISTS tasks_status_deadline_idx ON public.tasks (status, deadline);
CREATE INDEX IF NOT EXISTS tasks_created_idx         ON public.tasks (created_at DESC);
CREATE INDEX IF NOT EXISTS tasks_tags_idx            ON public.tasks USING GIN (tags);

DROP TRIGGER IF EXISTS tasks_set_updated_at ON public.tasks;
CREATE TRIGGER tasks_set_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══ ATTENDANCE ════════════════════════════════════════════════════════════
-- sessions is stored as JSONB array of
--   { checkInTime, checkOutTime, breaks: [{ startTime, endTime }] }
CREATE TABLE IF NOT EXISTS public.attendance (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date         date NOT NULL,
  sessions     jsonb NOT NULL DEFAULT '[]'::jsonb,
  day_started  boolean NOT NULL DEFAULT false,
  hours_worked numeric NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'Present' CHECK (status IN ('Present','Absent','Half-day','On Leave')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS attendance_user_date_idx ON public.attendance (user_id, date DESC);
CREATE INDEX IF NOT EXISTS attendance_date_idx      ON public.attendance (date DESC);

DROP TRIGGER IF EXISTS attendance_set_updated_at ON public.attendance;
CREATE TRIGGER attendance_set_updated_at
BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══ DAILY REPORTS ═════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date         date NOT NULL,
  type         text NOT NULL CHECK (type IN ('BOD','MOD','EOD')),
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  is_late      boolean NOT NULL DEFAULT false,
  late_reason  text NOT NULL DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, type)
);

CREATE INDEX IF NOT EXISTS daily_reports_user_date_idx ON public.daily_reports (user_id, date DESC);
CREATE INDEX IF NOT EXISTS daily_reports_date_idx      ON public.daily_reports (date DESC);

DROP TRIGGER IF EXISTS daily_reports_set_updated_at ON public.daily_reports;
CREATE TRIGGER daily_reports_set_updated_at
BEFORE UPDATE ON public.daily_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══ NOTIFICATIONS ═════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('Deadline','Overdue','Message','Completion','System','Announcement','Reminder','Alert','Task Update')),
  title           text NOT NULL,
  message         text NOT NULL,
  task_id         uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  read            boolean NOT NULL DEFAULT false,
  urgent          boolean NOT NULL DEFAULT false,
  group_id        text,
  audience        text NOT NULL DEFAULT 'All' CHECK (audience IN ('All','Selected')),
  recipient_count integer NOT NULL DEFAULT 1,
  dismissed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON public.notifications (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_group_idx     ON public.notifications (group_id);
CREATE INDEX IF NOT EXISTS notifications_created_idx   ON public.notifications (created_at DESC);

DROP TRIGGER IF EXISTS notifications_set_updated_at ON public.notifications;
CREATE TRIGGER notifications_set_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══ ROW-LEVEL SECURITY ════════════════════════════════════════════════════
-- All tables have RLS enabled with NO policies defined. This means:
--   • The backend using SUPABASE_SERVICE_KEY bypasses RLS (by design) and
--     has full read/write access — this is how our Express controllers work.
--   • The anon key (shipped in the frontend) is blocked from ALL operations,
--     so nothing sensitive can be queried directly from the browser.
--
-- If you ever want the frontend to read/write Supabase directly, add
-- per-table policies here. For now the Express backend is the only way in.
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;

-- ═══ DONE ══════════════════════════════════════════════════════════════════
-- The backend's seed.ts will create the default admin account
-- (admin@shotzoo.dev / admin123) on first boot once MONGODB is gone and
-- SUPABASE_URL + SUPABASE_SERVICE_KEY are set.
