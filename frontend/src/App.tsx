import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import EmployeeGuard from '@/guards/EmployeeGuard';
import AdminGuard    from '@/guards/AdminGuard';
import EmployeeLayout from '@/layouts/EmployeeLayout';
import AdminLayout    from '@/layouts/AdminLayout';

// ── Auth / Public pages ───────────────────────────────────────────────────
const Splash   = lazy(() => import('@/pages/Splash'));
const Landing  = lazy(() => import('@/pages/Landing'));
const SignIn      = lazy(() => import('@/pages/auth/SignIn'));
const AdminSignin = lazy(() => import('@/pages/auth/AdminSignin'));
const SignUp      = lazy(() => import('@/pages/auth/SignUp'));

// ── Employee pages ────────────────────────────────────────────────────────
const Dashboard    = lazy(() => import('@/pages/employee/Dashboard'));
const MyTask       = lazy(() => import('@/pages/employee/MyTask'));
const AddTask      = lazy(() => import('@/pages/employee/AddTask'));
const Attendance   = lazy(() => import('@/pages/employee/Attendance'));
const DailyReports = lazy(() => import('@/pages/employee/DailyReports'));
const Notifications = lazy(() => import('@/pages/employee/Notifications'));
const Profile       = lazy(() => import('@/pages/employee/Profile'));

// ── Admin pages ───────────────────────────────────────────────────────────
const AdminDashboard     = lazy(() => import('@/pages/admin/AdminDashboard'));
const Analytics          = lazy(() => import('@/pages/admin/Analytics'));
const Employees          = lazy(() => import('@/pages/admin/Employees'));
const EmployeeDetail     = lazy(() => import('@/pages/admin/EmployeeDetail'));
const AllTasks           = lazy(() => import('@/pages/admin/AllTasks'));
const MyTaskAdmin        = lazy(() => import('@/pages/admin/MyTaskAdmin'));
const AddTaskAdmin       = lazy(() => import('@/pages/admin/AddTaskAdmin'));
const AdminAttendance    = lazy(() => import('@/pages/admin/AdminAttendance'));
const SendNotification   = lazy(() => import('@/pages/admin/SendNotification'));
const AdminProfile       = lazy(() => import('@/pages/admin/AdminProfile'));
const CreateAccount      = lazy(() => import('@/pages/admin/CreateAccount'));
const CompanyRegistration = lazy(() => import('@/pages/admin/CompanyRegistration'));

// ─── Spinner ────────────────────────────────────────────────────────────────

function PageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-primary" />
    </div>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* ── Public ───────────────────────────────────────────────── */}
          <Route path="/"        element={<Navigate to="/splash" replace />} />
          <Route path="/splash"  element={<Splash />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/signin"        element={<SignIn />} />
          <Route path="/admin/signin"  element={<AdminSignin />} />
          <Route path="/signup"        element={<SignUp />} />

          {/* ── Employee (protected) ─────────────────────────────────── */}
          <Route element={<EmployeeGuard />}>
            <Route element={<EmployeeLayout />}>
              <Route path="/employee/dashboard"     element={<Dashboard />} />
              <Route path="/employee/my-tasks"      element={<MyTask />} />
              <Route path="/employee/add-task"      element={<AddTask />} />
              <Route path="/employee/attendance"    element={<Attendance />} />
              <Route path="/employee/daily-reports" element={<DailyReports />} />
              <Route path="/employee/notifications" element={<Notifications />} />
              <Route path="/employee/profile"       element={<Profile />} />
            </Route>
          </Route>

          {/* ── Admin (protected + isAdmin) ──────────────────────────── */}
          <Route element={<AdminGuard />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard"     element={<AdminDashboard />} />
              <Route path="/admin/analytics"     element={<Analytics />} />
              <Route path="/admin/employees"     element={<Employees />} />
              <Route path="/admin/employees/:id" element={<EmployeeDetail />} />
              <Route path="/admin/all-tasks"     element={<AllTasks />} />
              <Route path="/admin/my-tasks"      element={<MyTaskAdmin />} />
              <Route path="/admin/add-task"      element={<AddTaskAdmin />} />
              <Route path="/admin/attendance"    element={<AdminAttendance />} />
              <Route path="/admin/notifications" element={<SendNotification />} />
              <Route path="/admin/profile"       element={<AdminProfile />} />
              <Route path="/admin/create-account" element={<CreateAccount />} />
              <Route path="/admin/register"      element={<CompanyRegistration />} />
            </Route>
          </Route>

          {/* ── Catch-all ────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/splash" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
