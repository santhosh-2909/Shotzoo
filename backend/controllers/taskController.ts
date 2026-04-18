import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { TaskRow, taskRowToPublic } from '../types/db';

interface AssigneeLite {
  id:         string;
  name:       string;
  employeeId: string;
}

type TaskPublic = ReturnType<typeof taskRowToPublic>;
type EnrichedTask = TaskPublic & { assignedTo: AssigneeLite | null };

async function fetchAssigneeMap(userIds: string[]): Promise<Record<string, AssigneeLite>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, employee_id')
    .in('id', unique);
  if (error || !data) return {};
  const map: Record<string, AssigneeLite> = {};
  for (const u of data as { id: string; full_name: string; employee_id: string }[]) {
    map[u.id] = { id: u.id, name: u.full_name, employeeId: u.employee_id };
  }
  return map;
}

function enrichOne(row: TaskRow, map: Record<string, AssigneeLite>): EnrichedTask {
  return { ...taskRowToPublic(row), assignedTo: map[row.user_id] ?? null };
}

export const getTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, priority, search, sort, page = '1', limit = '50' } = req.query as {
      status?: string; priority?: string; search?: string; sort?: string;
      page?: string;   limit?: string;
    };

    const pg   = Number.parseInt(page, 10);
    const lim  = Number.parseInt(limit, 10);
    const from = (pg - 1) * lim;
    const to   = from + lim - 1;

    const isAdmin = req.user!.role === 'Admin';

    let query = supabase.from('tasks').select('*', { count: 'exact' });
    if (!isAdmin) query = query.eq('user_id', req.user!.id);

    if (status)   query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (search) {
      // Search title OR description (tags array search is trickier, keep simple)
      query = query.or('title.ilike.%' + search + '%,description.ilike.%' + search + '%');
    }

    if (sort === 'deadline')      query = query.order('deadline',  { ascending: true,  nullsFirst: false });
    else if (sort === 'priority') query = query.order('priority',  { ascending: false });
    else                          query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query.range(from, to);
    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }

    const rows  = (data as TaskRow[] | null) ?? [];
    const map   = await fetchAssigneeMap(rows.map(r => r.user_id));
    const tasks = rows.map(r => enrichOne(r, map));
    const total = count ?? tasks.length;

    res.json({
      success: true,
      count:   tasks.length,
      total,
      page:    pg,
      pages:   Math.ceil(total / lim),
      tasks,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getTodayTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', req.user!.id)
      .in('status', ['Pending', 'In Progress'])
      .order('priority',  { ascending: false })
      .order('deadline',  { ascending: true, nullsFirst: false });

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    const tasks = (data as TaskRow[] | null ?? []).map(taskRowToPublic);
    res.json({ success: true, count: tasks.length, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getTaskStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = req.user!.id;
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [totalQ, pendingQ, overdueQ, completedQ] = await Promise.all([
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', uid).in('status', ['Pending', 'In Progress']),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'Overdue'),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'Completed').gte('completed_at', start.toISOString()),
    ]);

    res.json({
      success: true,
      stats: {
        total:          totalQ.count     ?? 0,
        pending:        pendingQ.count   ?? 0,
        overdue:        overdueQ.count   ?? 0,
        completedToday: completedQ.count ?? 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getUpcomingDeadlines = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', req.user!.id)
      .in('status', ['Pending', 'In Progress'])
      .gte('deadline', new Date().toISOString())
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(10);

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    const tasks = (data as TaskRow[] | null ?? []).map(taskRowToPublic);
    res.json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user!.role === 'Admin';

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ success: false, message: 'Task not found.' });
      return;
    }

    const row = data as TaskRow;
    if (!isAdmin && row.user_id !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Forbidden.' });
      return;
    }

    const map = await fetchAssigneeMap([row.user_id]);
    res.json({ success: true, task: enrichOne(row, map) });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const createTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const tags: string[] = typeof body.tags === 'string'
      ? (body.tags).split(',').map((t) => t.trim()).filter(Boolean)
      : Array.isArray(body.tags) ? (body.tags as string[]) : [];

    const insertPayload: Record<string, unknown> = {
      user_id:           req.user!.id,
      title:             body.title,
      description:       body.description       ?? '',
      context:           body.context           ?? '',
      execution_steps:   body.executionSteps    ?? '',
      priority:          body.priority          ?? 'Medium',
      tags,
      estimated_hours:   body.estimatedHours    ?? 0,
      estimated_minutes: body.estimatedMinutes  ?? 0,
      deadline:          body.deadline          ?? null,
      status:            body.status            ?? 'Pending',
      progress:          body.progress          ?? 0,
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error || !data) {
      res.status(500).json({ success: false, message: error?.message ?? 'Failed to create task.' });
      return;
    }
    res.status(201).json({ success: true, task: taskRowToPublic(data as TaskRow) });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

function buildTaskUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  const map: Record<string, string> = {
    title:            'title',
    description:      'description',
    context:          'context',
    executionSteps:   'execution_steps',
    priority:         'priority',
    estimatedHours:   'estimated_hours',
    estimatedMinutes: 'estimated_minutes',
    deadline:         'deadline',
    status:           'status',
    progress:         'progress',
  };
  for (const [camel, snake] of Object.entries(map)) {
    if (body[camel] !== undefined) update[snake] = body[camel];
  }
  if (body.tags !== undefined) {
    update.tags = typeof body.tags === 'string'
      ? (body.tags as string).split(',').map((t) => t.trim()).filter(Boolean)
      : body.tags;
  }
  if (body.status === 'Completed') {
    update.completed_at = new Date().toISOString();
    update.progress     = 100;
  }
  return update;
}

export const updateTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const body   = req.body as Record<string, unknown>;
    const update = buildTaskUpdate(body);

    const { data, error } = await supabase
      .from('tasks')
      .update(update)
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id)
      .select('*')
      .maybeSingle();

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ success: false, message: 'Task not found.' });
      return;
    }
    const task = taskRowToPublic(data as TaskRow);

    if (body.status === 'Completed') {
      await supabase.from('notifications').insert({
        user_id: req.user!.id,
        type:    'Completion',
        title:   'Task Completed',
        message: 'You completed "' + task.title + '"',
        task_id: task._id,
      });
    }
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const updateTaskStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, progress } = req.body as { status?: string; progress?: number };
    const isAdmin = req.user!.role === 'Admin';

    // Pre-check: make sure caller can touch this row before issuing the UPDATE.
    const { data: existing, error: findErr } = await supabase
      .from('tasks')
      .select('id, user_id')
      .eq('id', req.params.id)
      .maybeSingle();

    if (findErr) {
      res.status(500).json({ success: false, message: findErr.message });
      return;
    }
    if (!existing) {
      res.status(404).json({ success: false, message: 'Task not found.' });
      return;
    }
    if (!isAdmin && (existing as { user_id: string }).user_id !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Forbidden.' });
      return;
    }

    const update: Record<string, unknown> = { status };
    if (progress !== undefined) update.progress = progress;
    if (status === 'Completed') {
      update.completed_at = new Date().toISOString();
      update.progress     = 100;
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(update)
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ success: false, message: 'Task not found.' });
      return;
    }
    const row  = data as TaskRow;
    const map  = await fetchAssigneeMap([row.user_id]);
    const task = enrichOne(row, map);

    if (status === 'Completed') {
      await supabase.from('notifications').insert({
        user_id: row.user_id,
        type:    'Completion',
        title:   'Task Completed',
        message: 'Task "' + task.title + '" completed.',
        task_id: task._id,
      });
    }
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id)
      .select('id')
      .maybeSingle();

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ success: false, message: 'Task not found.' });
      return;
    }
    res.json({ success: true, message: 'Task deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
