import { Router, Request, Response } from 'express';
import { protect, restrictTo } from '../middleware/auth';
import { supabase } from '../config/supabase';
import {
  UserRow,
  TaskRow,
  AttendanceRow,
  NotificationRow,
  userRowToPublic,
  taskRowToPublic,
  attendanceRowToPublic,
} from '../types/db';
import { randomUUID } from 'node:crypto';

const router = Router();

// Every /api/admin/* route requires a logged-in user with role = 'Admin'.
router.use(protect, restrictTo('Admin'));

// GET /api/admin/stats — dashboard summary numbers
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [empRes, openRes, completedRes, overdueRes] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['Pending', 'In Progress']),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'Completed').gte('completed_at', todayStart.toISOString()),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'Overdue'),
    ]);

    res.json({
      success: true,
      stats: {
        totalEmployees: empRes.count      ?? 0,
        openTasks:      openRes.count     ?? 0,
        completedToday: completedRes.count ?? 0,
        overdueCount:   overdueRes.count  ?? 0,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/admin/employees — all registered users
router.get('/employees', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    const employees = (data as UserRow[] ?? []).map(userRowToPublic);
    res.json({ success: true, count: employees.length, employees });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// DELETE /api/admin/employees/:id — remove a user permanently.
// Cascades to tasks, attendance, daily_reports and notifications via
// ON DELETE CASCADE in the schema. Admin-only (router-level guard above).
router.delete('/employees/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, message: 'Employee id is required.' });
      return;
    }
    if (req.user?.id === id) {
      res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
      return;
    }

    const { data: existing, error: findErr } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (findErr) {
      res.status(500).json({ success: false, message: findErr.message });
      return;
    }
    if (!existing) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const { error: delErr } = await supabase.from('users').delete().eq('id', id);
    if (delErr) {
      res.status(500).json({ success: false, message: delErr.message });
      return;
    }

    res.json({ success: true, message: 'Employee removed.' });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/admin/tasks — all tasks with employee info
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const { status, priority } = req.query as { status?: string; priority?: string };

    let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (status)   query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);

    const { data: taskData, error: taskErr } = await query;
    if (taskErr) {
      res.status(500).json({ success: false, message: taskErr.message });
      return;
    }

    const taskRows: TaskRow[] = taskData ?? [];
    const userIds = [...new Set(taskRows.map((t) => t.user_id).filter(Boolean))];

    let userMap: Record<string, { fullName: string; employeeId: string; photo: string; role: string }> = {};
    if (userIds.length > 0) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, full_name, employee_id, photo, role')
        .in('id', userIds);
      for (const u of userData ?? []) {
        userMap[u.id] = {
          fullName:   u.full_name,
          employeeId: u.employee_id,
          photo:      u.photo,
          role:       u.role,
        };
      }
    }

    const tasks = taskRows.map((t) => ({
      ...taskRowToPublic(t),
      userInfo: userMap[t.user_id] ?? null,
    }));

    res.json({ success: true, count: tasks.length, tasks });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/admin/tasks — create task and assign to employee
router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { userId, title, description, priority, deadline, tags, estimatedHours } = req.body as {
      userId?:        string;
      title?:         string;
      description?:   string;
      priority?:      string;
      deadline?:      string;
      tags?:          string[];
      estimatedHours?: number;
    };

    if (!userId || !title) {
      res.status(400).json({ success: false, message: 'userId and title are required.' });
      return;
    }

    const { data: taskData, error: taskErr } = await supabase
      .from('tasks')
      .insert({
        user_id:         userId,
        title,
        description:     description     ?? '',
        priority:        priority        ?? 'Medium',
        deadline:        deadline        ?? null,
        tags:            tags            ?? [],
        estimated_hours: estimatedHours  ?? 0,
        status:          'Pending',
        progress:        0,
      })
      .select('*')
      .single();

    if (taskErr || !taskData) {
      res.status(500).json({ success: false, message: taskErr?.message ?? 'Failed to create task.' });
      return;
    }

    await supabase.from('notifications').insert({
      user_id: userId,
      type:    'System',
      title:   'New Task Assigned',
      message: '"' + title + '" has been assigned to you',
      task_id: (taskData as TaskRow).id,
    });

    res.status(201).json({ success: true, task: taskRowToPublic(taskData as TaskRow) });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/admin/notify — send notification to one or all employees
router.post('/notify', async (req: Request, res: Response) => {
  try {
    const { userIds, title, message, type, urgent } = req.body as {
      userIds?:  string[];
      title?:    string;
      message?:  string;
      type?:     string;
      urgent?:   boolean;
    };

    if (!message) {
      res.status(400).json({ success: false, message: 'Message is required.' });
      return;
    }

    let targets: string[];
    let audience: string;
    if (!userIds || userIds.length === 0) {
      const { data } = await supabase.from('users').select('id');
      targets  = (data ?? []).map((u: { id: string }) => u.id);
      audience = 'All';
    } else {
      targets  = userIds;
      audience = 'Selected';
    }

    const validTypes = [
      'Deadline', 'Overdue', 'Message', 'Completion', 'System',
      'Announcement', 'Reminder', 'Alert', 'Task Update',
    ];
    const notiType = validTypes.includes(type ?? '') ? type : 'Announcement';
    const groupId  = randomUUID();

    const docs = targets.map((uid) => ({
      user_id:         uid,
      type:            notiType,
      title:           title ?? 'Admin Notification',
      message,
      urgent:          !!urgent,
      group_id:        groupId,
      audience,
      recipient_count: targets.length,
    }));

    const { error } = await supabase.from('notifications').insert(docs);
    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }

    res.json({ success: true, sent: targets.length, groupId });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/admin/notifications/sent — aggregated history of sent broadcasts
router.get('/notifications/sent', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .not('group_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }

    const rows: NotificationRow[] = data ?? [];

    // Group by group_id in code (replaces the Mongoose $group aggregation)
    const groupMap = new Map<string, {
      groupId:        string;
      type:           string;
      title:          string;
      message:        string;
      urgent:         boolean;
      audience:       string;
      recipientCount: number;
      createdAt:      string;
      recipientIds:   string[];
    }>();

    for (const r of rows) {
      if (!r.group_id) continue;
      if (!groupMap.has(r.group_id)) {
        groupMap.set(r.group_id, {
          groupId:        r.group_id,
          type:           r.type,
          title:          r.title,
          message:        r.message,
          urgent:         r.urgent,
          audience:       r.audience,
          recipientCount: r.recipient_count,
          createdAt:      r.created_at,
          recipientIds:   [],
        });
      }
      groupMap.get(r.group_id)!.recipientIds.push(r.user_id);
    }

    const groups = [...groupMap.values()].slice(0, 50);

    // Fetch names for all unique recipient IDs
    const allIds = [...new Set(groups.flatMap((g) => g.recipientIds))];
    let nameMap: Record<string, string> = {};
    if (allIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', allIds);
      nameMap = Object.fromEntries(
        (users ?? []).map((u: { id: string; full_name: string }) => [u.id, u.full_name]),
      );
    }

    const enriched = groups.map((g) => ({
      groupId:        g.groupId,
      type:           g.type,
      title:          g.title,
      message:        g.message,
      urgent:         g.urgent,
      audience:       g.audience,
      recipientCount: g.recipientCount,
      createdAt:      g.createdAt,
      recipientNames: g.recipientIds.map((id) => nameMap[id]).filter(Boolean),
    }));

    res.json({ success: true, groups: enriched });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/admin/activity — unified live activity feed for the dashboard
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) ?? '10', 10), 50);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [createdRes, completedRes, attendanceRes] = await Promise.all([
      supabase.from('tasks').select('id, user_id, title, created_at')
        .gte('created_at', since).order('created_at', { ascending: false }).limit(limit * 2),
      supabase.from('tasks').select('id, user_id, title, completed_at')
        .eq('status', 'Completed').gte('completed_at', since)
        .order('completed_at', { ascending: false }).limit(limit * 2),
      supabase.from('attendance').select('user_id, sessions, date')
        .gte('date', since.split('T')[0]).order('date', { ascending: false }).limit(limit * 2),
    ]);

    // Gather unique user IDs across all result sets
    const userIds = new Set<string>();
    for (const t of createdRes.data   ?? []) userIds.add(t.user_id);
    for (const t of completedRes.data ?? []) userIds.add(t.user_id);
    for (const a of attendanceRes.data ?? []) userIds.add(a.user_id);

    let userMap: Record<string, { fullName: string; employeeId: string }> = {};
    if (userIds.size > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, employee_id')
        .in('id', [...userIds]);
      userMap = Object.fromEntries(
        (users ?? []).map((u: { id: string; full_name: string; employee_id: string }) => [
          u.id,
          { fullName: u.full_name, employeeId: u.employee_id },
        ]),
      );
    }

    const events: {
      kind:     string;
      at:       string;
      userName: string;
      userId:   string;
      text:     string;
    }[] = [];

    for (const t of createdRes.data ?? []) {
      const u = userMap[t.user_id];
      if (!u) continue;
      events.push({
        kind: 'task_created', at: t.created_at,
        userName: u.fullName, userId: u.employeeId,
        text: 'created task "' + t.title + '"',
      });
    }
    for (const t of completedRes.data ?? []) {
      const u = userMap[t.user_id];
      if (!u || !t.completed_at) continue;
      events.push({
        kind: 'task_completed', at: t.completed_at,
        userName: u.fullName, userId: u.employeeId,
        text: 'marked "' + t.title + '" as Completed',
      });
    }
    for (const a of attendanceRes.data ?? []) {
      const u = userMap[a.user_id];
      if (!u || !a.sessions) continue;
      for (const s of a.sessions as { checkInTime?: string; checkOutTime?: string }[]) {
        if (s.checkInTime && s.checkInTime >= since) {
          events.push({ kind: 'check_in', at: s.checkInTime, userName: u.fullName, userId: u.employeeId, text: 'checked in' });
        }
        if (s.checkOutTime && s.checkOutTime >= since) {
          events.push({ kind: 'check_out', at: s.checkOutTime, userName: u.fullName, userId: u.employeeId, text: 'checked out' });
        }
      }
    }

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    res.json({
      success: true,
      count:   Math.min(events.length, limit),
      events:  events.slice(0, limit),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/admin/attendance — all attendance records for a given date
router.get('/attendance', async (req: Request, res: Response) => {
  try {
    const dateStr = req.query.date
      ? String(req.query.date).split('T')[0]
      : new Date().toISOString().split('T')[0];

    const [attRes, empRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('date', dateStr),
      supabase.from('users').select('id', { count: 'exact', head: true }),
    ]);

    if (attRes.error) {
      res.status(500).json({ success: false, message: attRes.error.message });
      return;
    }

    const records = (attRes.data as AttendanceRow[] ?? []).map(attendanceRowToPublic);
    const present   = records.filter((r) => (r.sessions ?? []).length > 0).length;
    const totalEmp  = empRes.count ?? 0;

    res.json({
      success:        true,
      count:          records.length,
      present,
      absent:         totalEmp - present,
      totalEmployees: totalEmp,
      records,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/admin/reports-today — all employees with their daily report status
// Delegates to the same controller used by /api/daily-reports/all-today.
router.get('/reports-today', async (req: Request, res: Response) => {
  const { getAllTodayReports } = await import('../controllers/dailyReportController');
  await getAllTodayReports(req, res);
});

// ─── Employee detail + carry-forward workflow ────────────────────────────
// The `:id` path param accepts EITHER the UUID primary key OR the
// human-readable employee_id (e.g. "SZ-EMP-3417"). URL links from the
// admin UI use employee_id for cleaner URLs.
async function resolveEmployee(idOrEmpId: string): Promise<UserRow | null> {
  const byEmpId = await supabase
    .from('users')
    .select('*')
    .eq('employee_id', idOrEmpId)
    .maybeSingle();
  if (byEmpId.data) return byEmpId.data as UserRow;
  const byId = await supabase
    .from('users')
    .select('*')
    .eq('id', idOrEmpId)
    .maybeSingle();
  return (byId.data as UserRow | null);
}

// GET /api/admin/employees/:id — profile + aggregate task stats + last activity
router.get('/employees/:id', async (req: Request, res: Response) => {
  try {
    const employee = await resolveEmployee(req.params.id);
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const { data: allTasks, error: taskErr } = await supabase
      .from('tasks')
      .select('status, updated_at')
      .eq('user_id', employee.id);

    if (taskErr) {
      res.status(500).json({ success: false, message: taskErr.message });
      return;
    }

    const rows = (allTasks ?? []) as Array<{ status: string; updated_at: string }>;
    const stats = {
      total:              rows.length,
      completed:          rows.filter((t) => t.status === 'Completed').length,
      pendingInProgress:  rows.filter((t) => t.status === 'Pending' || t.status === 'In Progress').length,
      overdue:            rows.filter((t) => t.status === 'Overdue').length,
    };

    const lastActivity = rows.length
      ? rows.map((t) => t.updated_at).sort().slice(-1)[0]
      : null;

    res.json({
      success:  true,
      employee: userRowToPublic(employee),
      stats,
      lastActivity,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/admin/employees/:id/tasks?date=YYYY-MM-DD
// Returns tasks for this employee where deadline falls on the given date.
// Uses `deadline` as the date-bucket field per the feature spec.
router.get('/employees/:id/tasks', async (req: Request, res: Response) => {
  try {
    const employee = await resolveEmployee(req.params.id);
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const dateStr = req.query.date
      ? String(req.query.date).split('T')[0]
      : new Date().toISOString().split('T')[0];

    // Bracket the whole day in UTC-ish range so any deadline that falls on
    // dateStr (in any timezone representation) is caught. We use the date
    // boundaries inclusive-start, exclusive-end.
    const start = dateStr + 'T00:00:00.000Z';
    const end   = new Date(new Date(start).getTime() + 24 * 3600 * 1000).toISOString();

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', employee.id)
      .gte('deadline', start)
      .lt('deadline', end)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }

    const tasks = (data as TaskRow[] ?? []).map(taskRowToPublic);
    res.json({ success: true, date: dateStr, count: tasks.length, tasks });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/admin/tasks/:taskId/carry-forward
// Body: { toDate: 'YYYY-MM-DD' }
// - Marks the original task as 'Missed / Carried Forward' and records
//   carried_to_task_id / carried_to_date.
// - Creates a duplicate task for toDate (deadline = end of that day)
//   with status 'Pending' and carried_from_task_id / carried_from_date.
router.post('/tasks/:taskId/carry-forward', async (req: Request, res: Response) => {
  try {
    const { toDate } = req.body as { toDate?: string };
    if (!toDate || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      res.status(400).json({ success: false, message: 'toDate must be a YYYY-MM-DD string.' });
      return;
    }

    const { data: orig, error: fetchErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', req.params.taskId)
      .maybeSingle();

    if (fetchErr) {
      res.status(500).json({ success: false, message: fetchErr.message });
      return;
    }
    if (!orig) {
      res.status(404).json({ success: false, message: 'Task not found.' });
      return;
    }
    const origTask = orig as TaskRow;

    if (origTask.status === 'Completed') {
      res.status(400).json({ success: false, message: 'Cannot carry forward a completed task.' });
      return;
    }
    if (origTask.status === 'Missed / Carried Forward' || origTask.carried_to_task_id) {
      res.status(400).json({ success: false, message: 'Task has already been carried forward.' });
      return;
    }

    const origDate = origTask.deadline
      ? origTask.deadline.split('T')[0]
      : origTask.created_at.split('T')[0];

    // New deadline = end of toDate in IST (UTC+5:30). Stored as UTC by Postgres.
    const newDeadline = toDate + 'T23:59:59+05:30';

    const { data: newTaskData, error: insertErr } = await supabase
      .from('tasks')
      .insert({
        user_id:            origTask.user_id,
        title:              origTask.title,
        description:        origTask.description,
        context:            origTask.context,
        execution_steps:    origTask.execution_steps,
        priority:           origTask.priority,
        tags:               origTask.tags ?? [],
        estimated_hours:    origTask.estimated_hours,
        estimated_minutes:  origTask.estimated_minutes,
        deadline:           newDeadline,
        status:             'Pending',
        progress:           0,
        carried_from_task_id: origTask.id,
        carried_from_date:    origDate,
      })
      .select('*')
      .single();

    if (insertErr || !newTaskData) {
      res.status(500).json({ success: false, message: insertErr?.message ?? 'Failed to create carried-forward task.' });
      return;
    }

    const newTask = newTaskData as TaskRow;

    const { data: updatedOrigData, error: updateErr } = await supabase
      .from('tasks')
      .update({
        status:             'Missed / Carried Forward',
        carried_to_task_id: newTask.id,
        carried_to_date:    toDate,
      })
      .eq('id', origTask.id)
      .select('*')
      .single();

    if (updateErr || !updatedOrigData) {
      // Roll back the inserted duplicate so the audit trail isn't half-written.
      await supabase.from('tasks').delete().eq('id', newTask.id);
      res.status(500).json({ success: false, message: updateErr?.message ?? 'Failed to update original task.' });
      return;
    }

    res.json({
      success:      true,
      originalTask: taskRowToPublic(updatedOrigData as TaskRow),
      newTask:      taskRowToPublic(newTask),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// PATCH /api/admin/tasks/:taskId/mark-incomplete
router.patch('/tasks/:taskId/mark-incomplete', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({ status: 'Incomplete' })
      .eq('id', req.params.taskId)
      .select('*')
      .single();

    if (error || !data) {
      res.status(500).json({ success: false, message: error?.message ?? 'Failed to mark task incomplete.' });
      return;
    }

    res.json({ success: true, task: taskRowToPublic(data as TaskRow) });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

export default router;
