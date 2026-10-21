import { Building2, CheckCircle2, Clock, Layers, PlaneTakeoff, Settings, ShieldCheck, UserCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import Card from "../../components/ui/Card.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import StatCard from "../../components/ui/StatCard.jsx";
import { useGetAdminHrQuery } from "../../features/employees/employeesApi.js";
import { useGetLeaveTypesQuery } from "../../features/leaves/leavesApi.js";
import { useGetHrDashboardQuery } from "../../features/reports/reportsApi.js";

const LINKS = [
  { to: "/admin/employees", label: "Manage employees", icon: Users },
  { to: "/admin/hr", label: "Manage HR staff", icon: Building2 },
  { to: "/admin/leave-types", label: "Leave types & policies", icon: Layers },
  { to: "/admin/allocations", label: "Annual allocations", icon: Clock },
  { to: "/admin/settings", label: "System settings", icon: Settings },
  { to: "/admin/audit-logs", label: "Audit logs", icon: ShieldCheck },
  { to: "/hr/registrations", label: "Review registrations", icon: UserCheck },
];

export default function AdminDashboard() {
  const stats = useGetHrDashboardQuery({});
  const hr = useGetAdminHrQuery({ limit: 1 });
  const hrActive = useGetAdminHrQuery({ limit: 1, status: "active" });
  const types = useGetLeaveTypesQuery({ includeInactive: true });
  const d = stats.data;
  return (
    <>
      <PageHeader title="Admin dashboard" subtitle="System overview from live data" />
      {stats.isLoading ? <Spinner /> : stats.error ? <ErrorState error={stats.error} onRetry={stats.refetch} /> : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Active employees" value={d.totalEmployees} icon={Users} />
          <StatCard label="Pending registrations" value={d.pendingRegistrations} icon={UserCheck} tone="amber" />
          <StatCard label="Pending leave requests" value={d.pendingLeaveRequests} icon={Clock} tone="amber" />
          <StatCard label="Approved requests" value={d.approvedLeaveRequests} icon={CheckCircle2} tone="emerald" />
          <StatCard label="On leave today" value={d.employeesOnLeave} icon={PlaneTakeoff} tone="slate" />
          <StatCard label="HR accounts" value={hr.data?.pagination.total} hint={`${hrActive.data?.pagination.total ?? "-"} active - ${types.data?.length ?? "-"} leave types`} icon={Building2} />
        </div>
      )}
      <Card title="Administration">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 text-sm font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50/40">
              <Icon className="h-5 w-5 text-brand-600" aria-hidden="true" /> {label}
            </Link>
          ))}
        </div>
      </Card>
    </>
  );
}
