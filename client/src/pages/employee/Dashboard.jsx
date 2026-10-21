import { CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import LeaveDetailsModal from "../../components/LeaveDetailsModal.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import StatCard from "../../components/ui/StatCard.jsx";
import { useGetMyBalancesQuery } from "../../features/balances/balancesApi.js";
import { useGetMyLeavesQuery } from "../../features/leaves/leavesApi.js";
import { useAuth } from "../../hooks/useAuth.js";
import { formatDate } from "../../utils/format.js";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [detailId, setDetailId] = useState(null);
  const live = { pollingInterval: 30000, skipPollingIfUnfocused: true }; // see HR decisions without reloading
  const balances = useGetMyBalancesQuery({}, live);
  const recent = useGetMyLeavesQuery({ page: 1, limit: 5 }, live);
  const pending = useGetMyLeavesQuery({ status: "pending", limit: 1 }, live);
  const approved = useGetMyLeavesQuery({ status: "approved", limit: 1 }, live);
  const rejected = useGetMyLeavesQuery({ status: "rejected", limit: 1 }, live);

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} subtitle={`${user.employeeId} - ${user.department}`}
        actions={<Link to="/employee/apply"><Button>Apply for leave</Button></Link>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending requests" value={pending.data?.pagination.total} icon={Clock} tone="amber" />
        <StatCard label="Approved requests" value={approved.data?.pagination.total} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Rejected requests" value={rejected.data?.pagination.total} icon={XCircle} tone="red" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={`Leave balances ${balances.data ? `(${balances.data.year})` : ""}`} className="lg:col-span-1" action={<Link className="text-xs text-brand-600 hover:underline" to="/employee/balances">Details</Link>}>
          {balances.isLoading ? <Spinner /> : balances.error ? <ErrorState error={balances.error} onRetry={balances.refetch} /> : (
            <ul className="space-y-4">
              {balances.data.balances.map((b) => (
                <li key={b.id}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{b.leaveType.name}</span><span className="text-slate-500">{b.available} / {b.allocated} left</span></div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${b.allocated ? Math.max(0, Math.min(100, (b.available / b.allocated) * 100)) : 0}%` }} /></div>
                </li>
              ))}
              {balances.data.balances.length === 0 && <p className="text-sm text-slate-500">No balances yet.</p>}
            </ul>
          )}
        </Card>

        <Card title="Recent requests" padded={false} className="lg:col-span-2" action={<Link className="text-xs text-brand-600 hover:underline" to="/employee/leaves">View all</Link>}>
          <DataTable
            rows={recent.data?.items} isLoading={recent.isLoading} error={recent.error} onRetry={recent.refetch}
            emptyTitle="No leave requests yet" emptyMessage="Apply for leave to see your requests here."
            columns={[
              { key: "type", header: "Type", render: (r) => r.leaveType?.name },
              { key: "dates", header: "Dates", render: (r) => `${formatDate(r.startDate)} - ${formatDate(r.endDate)}` },
              { key: "days", header: "Days" },
              { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
              { key: "view", header: "", render: (r) => <Button variant="ghost" size="sm" icon={FileText} onClick={() => setDetailId(r.id)}>View</Button> },
            ]}
          />
        </Card>
      </div>
      {detailId && <LeaveDetailsModal leaveId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}
