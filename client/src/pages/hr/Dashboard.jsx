import { CheckCircle2, Clock, PlaneTakeoff, UserCheck, Users, XCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import LeaveDetailsModal from "../../components/LeaveDetailsModal.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { Input } from "../../components/ui/Field.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import StatCard from "../../components/ui/StatCard.jsx";
import { useGetHrLeavesQuery } from "../../features/leaves/leavesApi.js";
import { useGetHrDashboardQuery } from "../../features/reports/reportsApi.js";
import { useDebounce } from "../../hooks/useDebounce.js";
import { formatDate } from "../../utils/format.js";

export default function HrDashboard() {
  const [filters, setFilters] = useState({ from: "", to: "", department: "" });
  const [detailId, setDetailId] = useState(null);
  const department = useDebounce(filters.department);
  const live = { pollingInterval: 30000, skipPollingIfUnfocused: true }; // near-real-time refresh while the tab is visible
  const stats = useGetHrDashboardQuery({ ...filters, department }, live);
  const pending = useGetHrLeavesQuery({ status: "pending", limit: 5, sortBy: "createdAt", order: "asc" }, live);
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const d = stats.data;

  return (
    <>
      <PageHeader title="HR dashboard" subtitle={d ? `Live data as of ${formatDate(d.asOf)}` : "Live data from the database"} />
      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Input label="Submitted from" type="date" value={filters.from} onChange={set("from")} />
          <Input label="Submitted to" type="date" value={filters.to} onChange={set("to")} />
          <Input label="Department" placeholder="All" value={filters.department} onChange={set("department")} />
          <div className="flex items-end"><Button variant="secondary" onClick={() => setFilters({ from: "", to: "", department: "" })}>Reset filters</Button></div>
        </div>
        <p className="mt-2 text-xs text-slate-400">Filters apply to leave-request counts and employee statistics. "On leave" always refers to today.</p>
      </Card>

      {stats.isLoading ? <Spinner /> : stats.error ? <ErrorState error={stats.error} onRetry={stats.refetch} /> : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total employees" value={d.totalEmployees} icon={Users} />
          <StatCard label="Pending registrations" value={d.pendingRegistrations} icon={UserCheck} tone="amber" />
          <StatCard label="Pending leave requests" value={d.pendingLeaveRequests} icon={Clock} tone="amber" />
          <StatCard label="Approved requests" value={d.approvedLeaveRequests} icon={CheckCircle2} tone="emerald" />
          <StatCard label="Rejected requests" value={d.rejectedLeaveRequests} icon={XCircle} tone="red" />
          <StatCard label="Employees on leave today" value={d.employeesOnLeave} icon={PlaneTakeoff} tone="slate" />
        </div>
      )}

      <Card title="Oldest pending requests" padded={false} action={<Link to="/hr/leaves" className="text-xs text-brand-600 hover:underline">All requests</Link>}>
        <DataTable rows={pending.data?.items} isLoading={pending.isLoading} error={pending.error} onRetry={pending.refetch} emptyTitle="No pending requests" emptyMessage="You are all caught up."
          columns={[
            { key: "emp", header: "Employee", render: (r) => r.employee?.name },
            { key: "type", header: "Type", render: (r) => r.leaveType?.name },
            { key: "dates", header: "Dates", render: (r) => `${formatDate(r.startDate)} - ${formatDate(r.endDate)}` },
            { key: "days", header: "Days" },
            { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
            { key: "act", header: "", render: (r) => <Button size="sm" variant="secondary" onClick={() => setDetailId(r.id)}>Review</Button> },
          ]} />
      </Card>
      {detailId && <LeaveDetailsModal leaveId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}
