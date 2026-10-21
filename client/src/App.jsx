import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Toaster from "./components/ui/Toaster.jsx";
import { useGetMeQuery } from "./features/auth/authApi.js";
import { useAuth } from "./hooks/useAuth.js";
import AppLayout from "./layouts/AppLayout.jsx";
import Login from "./pages/auth/Login.jsx";
import Register from "./pages/auth/Register.jsx";
import AdminAllocations from "./pages/admin/Allocations.jsx";
import AdminAuditLogs from "./pages/admin/AuditLogs.jsx";
import AdminDashboard from "./pages/admin/Dashboard.jsx";
import AdminEmployees from "./pages/admin/Employees.jsx";
import AdminHrManagement from "./pages/admin/HrManagement.jsx";
import AdminLeaveTypes from "./pages/admin/LeaveTypes.jsx";
import AdminSettings from "./pages/admin/Settings.jsx";
import EmployeeApplyLeave from "./pages/employee/ApplyLeave.jsx";
import EmployeeBalances from "./pages/employee/Balances.jsx";
import EmployeeDashboard from "./pages/employee/Dashboard.jsx";
import EmployeeMyLeaves from "./pages/employee/MyLeaves.jsx";
import HrBalances from "./pages/hr/BalanceManagement.jsx";
import HrDashboard from "./pages/hr/Dashboard.jsx";
import HrLeaveRequests from "./pages/hr/LeaveRequests.jsx";
import HrRegistrations from "./pages/hr/Registrations.jsx";
import HrReports from "./pages/hr/Reports.jsx";
import CalendarPage from "./pages/shared/CalendarPage.jsx";
import NotFound from "./pages/shared/NotFound.jsx";
import NotificationsPage from "./pages/shared/Notifications.jsx";
import ProfilePage from "./pages/shared/Profile.jsx";
import { homeFor } from "./utils/constants.js";

function RootRedirect() {
  const { user, initialized } = useAuth();
  if (!initialized) return null;
  return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
}

export default function App() {
  useGetMeQuery(); // restores the session from the HTTP-only cookie on page load
  return (
    <>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            <Route element={<ProtectedRoute roles={["employee"]} />}>
              <Route path="/employee" element={<EmployeeDashboard />} />
              <Route path="/employee/apply" element={<EmployeeApplyLeave />} />
              <Route path="/employee/leaves" element={<EmployeeMyLeaves />} />
              <Route path="/employee/balances" element={<EmployeeBalances />} />
            </Route>

            <Route element={<ProtectedRoute roles={["hr", "admin"]} />}>
              <Route path="/hr" element={<HrDashboard />} />
              <Route path="/hr/registrations" element={<HrRegistrations />} />
              <Route path="/hr/leaves" element={<HrLeaveRequests />} />
              <Route path="/hr/balances" element={<HrBalances />} />
              <Route path="/hr/reports" element={<HrReports />} />
            </Route>

            <Route element={<ProtectedRoute roles={["admin"]} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/employees" element={<AdminEmployees />} />
              <Route path="/admin/hr" element={<AdminHrManagement />} />
              <Route path="/admin/leave-types" element={<AdminLeaveTypes />} />
              <Route path="/admin/allocations" element={<AdminAllocations />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </>
  );
}
