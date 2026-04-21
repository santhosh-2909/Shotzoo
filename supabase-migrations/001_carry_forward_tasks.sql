-- ═════════════════════════════════════════════════════════════════════════
-- Migration 001 — Employee detail + carry-forward workflow
-- ═════════════════════════════════════════════════════════════════════════
-- HOW TO APPLY:
--   1. Open Supabase project → SQL Editor → New query
--   2. Paste this file
--   3. Click Run
-- Safe to re-run (idempotent via IF NOT EXISTS / DROP+ADD patterns).
-- ═════════════════════════════════════════════════════════════════════════

-- 1. Expand the tasks.status CHECK constraint to allow the new states
--    used by the carry-forward workflow.
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (
  status IN (
    'Pending',
    'In Progress',
    'Completed',
    'Overdue',
    'Missed / Carried Forward',
    'Incomplete'
  )
);

-- 2. Audit trail columns on the tasks table. All nullable — existing rows
--    keep working without backfill.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS carried_from_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS carried_from_date    date,
  ADD COLUMN IF NOT EXISTS carried_to_task_id   uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS carried_to_date      date;

CREATE INDEX IF NOT EXISTS tasks_carried_from_idx ON public.tasks (carried_from_task_id);
CREATE INDEX IF NOT EXISTS tasks_carried_to_idx   ON public.tasks (carried_to_task_id);

-- ═════════════════════════════════════════════════════════════════════════
-- Done. Verify with:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'tasks' AND column_name LIKE 'carried_%';
-- ═════════════════════════════════════════════════════════════════════════
