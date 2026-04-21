// ─── User ──────────────────────────────────────────────────────────────────

export interface UserNotificationPrefs {
  email: boolean;
  push: boolean;
  weeklyReports: boolean;
  dailyReminderTime: string;
}

export interface User {
  _id: string;
  employeeId: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  photo: string;
  employeeType: 'Office' | 'Home';
  bio: string;
  joiningDate?: string;
  gender: 'Male' | 'Female' | 'Prefer not to say' | '';
  dateOfBirth?: string;
  linkedinUrl: string;
  workRole: string;
  notifications: UserNotificationPrefs;
  createdAt: string;
  updatedAt: string;
}

// ─── Task ──────────────────────────────────────────────────────────────────

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus   =
  | 'Pending'
  | 'In Progress'
  | 'Completed'
  | 'Overdue'
  | 'Missed / Carried Forward'
  | 'Incomplete';

export interface TaskAssignee {
  id:         string;
  name:       string;
  employeeId: string;
}

export interface TaskUserInfo {
  fullName:   string;
  employeeId: string;
  photo:      string;
  role:       string;
}

export interface Task {
  _id: string;
  user: string | User;
  userInfo?: TaskUserInfo | null;
  title: string;
  description: string;
  context: string;
  executionSteps: string;
  priority: TaskPriority;
  tags: string[];
  estimatedHours: number;
  estimatedMinutes: number;
  deadline?: string;
  status: TaskStatus;
  progress: number;
  completedAt?: string;
  carriedFromTaskId?: string | null;
  carriedFromDate?: string | null;
  carriedToTaskId?: string | null;
  carriedToDate?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo?: TaskAssignee | null;
}

// ─── Attendance ────────────────────────────────────────────────────────────

export interface AttendanceBreak {
  _id: string;
  startTime: string;
  endTime: string | null;
}

export interface AttendanceSession {
  _id: string;
  checkInTime: string;
  checkOutTime: string | null;
  breaks: AttendanceBreak[];
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Half-day' | 'On Leave';

export interface Attendance {
  _id: string;
  user: string | User;
  date: string;
  sessions: AttendanceSession[];
  dayStarted: boolean;
  hoursWorked: number;
  status: AttendanceStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Daily Report ──────────────────────────────────────────────────────────

export type ReportType = 'BOD' | 'MOD' | 'EOD';

export interface DailyReport {
  _id: string;
  user: string | User;
  date: string;
  type: ReportType;
  title: string;
  description: string;
  isLate: boolean;
  lateReason: string;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Notification ──────────────────────────────────────────────────────────

export type NotificationType =
  | 'Deadline'
  | 'Overdue'
  | 'Message'
  | 'Completion'
  | 'System'
  | 'Announcement'
  | 'Reminder'
  | 'Alert'
  | 'Task Update';

export interface Notification {
  _id: string;
  user: string | User;
  type: NotificationType;
  title: string;
  message: string;
  task?: string | Task;
  read: boolean;
  urgent: boolean;
  groupId?: string;
  audience: 'All' | 'Selected';
  recipientCount: number;
  dismissedAt?: string;
  createdAt: string;
  updatedAt: string;
}
