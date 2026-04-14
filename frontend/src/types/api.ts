import type { TaskPriority, TaskStatus, NotificationType } from './models';

// ─── Generic wrappers ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pages: number;
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  photo: string;
  employeeId: string;
  isAdmin: boolean;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: AuthUser;
}

// ─── Admin stats ───────────────────────────────────────────────────────────

export interface AdminStatsResponse {
  totalEmployees: number;
  tasksCompletedToday: number;
  openTasks: number;
  overdueTasks: number;
}

export interface TaskBreakdown {
  Pending: number;
  'In Progress': number;
  Completed: number;
  Overdue: number;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  total: number;
}

// ─── Payloads ──────────────────────────────────────────────────────────────

export interface CreateTaskPayload {
  title: string;
  description: string;
  context: string;
  executionSteps: string;
  priority: TaskPriority;
  tags: string[];
  estimatedHours: number;
  estimatedMinutes?: number;
  deadline?: string;
  /** Present only when admin creates a task for another user */
  userId?: string;
}

export interface UpdateTaskStatusPayload {
  status: TaskStatus;
}

export interface NotifyPayload {
  /** Omit when sendToAll is true */
  userIds?: string[];
  sendToAll: boolean;
  type: NotificationType;
  title: string;
  message: string;
  urgent: boolean;
  /** ISO string — omit for immediate send */
  scheduledFor?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  employeeType?: 'Office' | 'Home';
}

export interface PasswordResetRequestPayload {
  email: string;
  channel: 'email';
}

export interface PasswordResetConfirmPayload {
  code: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateProfilePayload {
  fullName?: string;
  phone?: string;
  bio?: string;
  employeeType?: 'Office' | 'Home';
  joiningDate?: string;
  gender?: 'Male' | 'Female' | 'Prefer not to say' | '';
  dateOfBirth?: string;
  linkedinUrl?: string;
  workRole?: string;
  notifications?: {
    email?: boolean;
    push?: boolean;
    weeklyReports?: boolean;
    dailyReminderTime?: string;
  };
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

// ─── Daily Report ──────────────────────────────────────────────────────────

export interface CreateReportPayload {
  type: 'BOD' | 'MOD' | 'EOD';
  title: string;
  description: string;
  isLate?: boolean;
  lateReason?: string;
}
