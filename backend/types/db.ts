/**
 * Database row types (snake_case, matching the Postgres schema in
 * supabase-schema.sql) and mappers that convert them to/from the
 * camelCase JSON shape the frontend has always consumed.
 *
 * The mapper functions preserve the exact output shape the old Mongoose
 * code produced, including `_id` aliases for `id`, so the frontend
 * doesn't need to change at all.
 */

// ─── Row types (match Postgres columns exactly) ───────────────────────────

export interface UserNotifications {
  email:             boolean;
  push:              boolean;
  weeklyReports:     boolean;
  dailyReminderTime: string;
}

export interface UserRow {
  id:            string;
  employee_id:   string;
  full_name:     string;
  email:         string;
  phone:         string;
  company:       string;
  role:          string;
  password:      string;
  photo:         string;
  employee_type: 'Office' | 'Home';
  bio:           string;
  joining_date:  string | null;
  gender:        '' | 'Male' | 'Female' | 'Prefer not to say';
  date_of_birth: string | null;
  linkedin_url:  string;
  work_role:     string;
  notifications: UserNotifications;
  created_at:    string;
  updated_at:    string;
}

export interface AttendanceBreak {
  startTime: string;
  endTime?:  string | null;
}

export interface AttendanceSession {
  checkInTime:   string;
  checkOutTime?: string | null;
  breaks:        AttendanceBreak[];
}

export interface TaskRow {
  id:                string;
  user_id:           string;
  title:             string;
  description:       string;
  context:           string;
  execution_steps:   string;
  priority:          'Low' | 'Medium' | 'High' | 'Urgent';
  tags:              string[];
  estimated_hours:   number;
  estimated_minutes: number;
  deadline:          string | null;
  status:            'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  progress:          number;
  completed_at:      string | null;
  created_at:        string;
  updated_at:        string;
}

export interface AttendanceRow {
  id:           string;
  user_id:      string;
  date:         string;
  sessions:     AttendanceSession[];
  day_started:  boolean;
  hours_worked: number;
  status:       'Present' | 'Absent' | 'Half-day' | 'On Leave';
  created_at:   string;
  updated_at:   string;
}

export interface DailyReportRow {
  id:           string;
  user_id:      string;
  date:         string;
  type:         'BOD' | 'MOD' | 'EOD';
  title:        string;
  description:  string;
  is_late:      boolean;
  late_reason:  string;
  submitted_at: string;
  created_at:   string;
  updated_at:   string;
}

export interface NotificationRow {
  id:              string;
  user_id:         string;
  type:            'Deadline' | 'Overdue' | 'Message' | 'Completion' | 'System' | 'Announcement' | 'Reminder' | 'Alert' | 'Task Update';
  title:           string;
  message:         string;
  task_id:         string | null;
  read:            boolean;
  urgent:          boolean;
  group_id:        string | null;
  audience:        'All' | 'Selected';
  recipient_count: number;
  dismissed_at:    string | null;
  created_at:      string;
  updated_at:      string;
}

// ─── Public (API) shapes — what the frontend consumes ────────────────────

export interface UserPublic {
  _id:           string;
  employeeId:    string;
  fullName:      string;
  email:         string;
  phone:         string;
  company:       string;
  role:          string;
  photo:         string;
  employeeType:  'Office' | 'Home';
  bio:           string;
  joiningDate:   string | null;
  gender:        string;
  dateOfBirth:   string | null;
  linkedinUrl:   string;
  workRole:      string;
  notifications: UserNotifications;
  createdAt:     string;
  updatedAt:     string;
  isAdmin:       boolean;
}

export interface TaskPublic {
  _id:              string;
  user:             string;
  title:            string;
  description:      string;
  context:          string;
  executionSteps:   string;
  priority:         'Low' | 'Medium' | 'High' | 'Urgent';
  tags:             string[];
  estimatedHours:   number;
  estimatedMinutes: number;
  deadline:         string | null;
  status:           'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  progress:         number;
  completedAt:      string | null;
  createdAt:        string;
  updatedAt:        string;
}

export interface AttendancePublic {
  _id:         string;
  user:        string;
  date:        string;
  sessions:    AttendanceSession[];
  dayStarted:  boolean;
  hoursWorked: number;
  status:      'Present' | 'Absent' | 'Half-day' | 'On Leave';
  createdAt:   string;
  updatedAt:   string;
}

export interface DailyReportPublic {
  _id:         string;
  user:        string;
  date:        string;
  type:        'BOD' | 'MOD' | 'EOD';
  title:       string;
  description: string;
  isLate:      boolean;
  lateReason:  string;
  submittedAt: string;
  createdAt:   string;
  updatedAt:   string;
}

export interface NotificationPublic {
  _id:            string;
  user:           string;
  type:           NotificationRow['type'];
  title:          string;
  message:        string;
  task:           string | null;
  read:           boolean;
  urgent:         boolean;
  groupId:        string | null;
  audience:       'All' | 'Selected';
  recipientCount: number;
  dismissedAt:    string | null;
  createdAt:      string;
  updatedAt:      string;
}

// ─── Mappers: Row → Public ────────────────────────────────────────────────

export function userRowToPublic(r: UserRow): UserPublic {
  return {
    _id:           r.id,
    employeeId:    r.employee_id,
    fullName:      r.full_name,
    email:         r.email,
    phone:         r.phone,
    company:       r.company,
    role:          r.role,
    photo:         r.photo,
    employeeType:  r.employee_type,
    bio:           r.bio,
    joiningDate:   r.joining_date,
    gender:        r.gender,
    dateOfBirth:   r.date_of_birth,
    linkedinUrl:   r.linkedin_url,
    workRole:      r.work_role,
    notifications: r.notifications,
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
    isAdmin:       r.role === 'Admin',
  };
}

export function taskRowToPublic(r: TaskRow): TaskPublic {
  return {
    _id:              r.id,
    user:             r.user_id,
    title:            r.title,
    description:      r.description,
    context:          r.context,
    executionSteps:   r.execution_steps,
    priority:         r.priority,
    tags:             r.tags,
    estimatedHours:   Number(r.estimated_hours),
    estimatedMinutes: r.estimated_minutes,
    deadline:         r.deadline,
    status:           r.status,
    progress:         r.progress,
    completedAt:      r.completed_at,
    createdAt:        r.created_at,
    updatedAt:        r.updated_at,
  };
}

export function attendanceRowToPublic(r: AttendanceRow): AttendancePublic {
  return {
    _id:         r.id,
    user:        r.user_id,
    date:        r.date,
    sessions:    r.sessions ?? [],
    dayStarted:  r.day_started,
    hoursWorked: Number(r.hours_worked),
    status:      r.status,
    createdAt:   r.created_at,
    updatedAt:   r.updated_at,
  };
}

export function dailyReportRowToPublic(r: DailyReportRow): DailyReportPublic {
  return {
    _id:         r.id,
    user:        r.user_id,
    date:        r.date,
    type:        r.type,
    title:       r.title,
    description: r.description,
    isLate:      r.is_late,
    lateReason:  r.late_reason,
    submittedAt: r.submitted_at,
    createdAt:   r.created_at,
    updatedAt:   r.updated_at,
  };
}

export function notificationRowToPublic(r: NotificationRow): NotificationPublic {
  return {
    _id:            r.id,
    user:           r.user_id,
    type:           r.type,
    title:          r.title,
    message:        r.message,
    task:           r.task_id,
    read:           r.read,
    urgent:         r.urgent,
    groupId:        r.group_id,
    audience:       r.audience,
    recipientCount: r.recipient_count,
    dismissedAt:    r.dismissed_at,
    createdAt:      r.created_at,
    updatedAt:      r.updated_at,
  };
}

// ─── Attendance working-time helper ───────────────────────────────────────

/** Sum the working milliseconds in a session (total time minus breaks). */
export function sessionWorkingMs(s: AttendanceSession): number {
  if (!s.checkInTime) return 0;
  const end = s.checkOutTime ? new Date(s.checkOutTime) : new Date();
  let ms = end.getTime() - new Date(s.checkInTime).getTime();
  for (const brk of s.breaks ?? []) {
    const bEnd = brk.endTime
      ? new Date(brk.endTime)
      : (s.checkOutTime ? new Date(s.checkOutTime) : new Date());
    ms -= bEnd.getTime() - new Date(brk.startTime).getTime();
  }
  return Math.max(0, ms);
}

/** Compute hours_worked + status from the sessions array before writing. */
export function computeAttendanceDerived(sessions: AttendanceSession[]): {
  hoursWorked: number;
  status:      AttendanceRow['status'];
} {
  let totalMs = 0;
  for (const s of sessions) totalMs += sessionWorkingMs(s);
  const hoursWorked = Number((totalMs / 3_600_000).toFixed(2));
  const status: AttendanceRow['status'] =
    sessions.length === 0
      ? 'Absent'
      : hoursWorked < 4
        ? 'Half-day'
        : 'Present';
  return { hoursWorked, status };
}

/** Generate the next available SZ-EMP-XXXX ID. Collision-tolerant. */
export function randomEmployeeId(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return 'SZ-EMP-' + String(n);
}
