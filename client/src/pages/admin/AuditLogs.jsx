import { useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import { Input, Select } from "../../components/ui/Field.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import { useGetAuditLogsQuery } from "../../features/admin/adminApi.js";
import { formatDateTime } from "../../utils/format.js";

const ACTIONS = [
  "registration.approved", "registration.rejected", "user.registered", "user.status_changed", "user.hr_created", "user.updated", "user.password_changed",
  "leave.submitted", "leave.approved", "leave.rejected", "leave.cancelled", "leave.document_viewed", "balance.adjusted", "balance.initialized",
  "leave_type.created", "leave_type.updated", "leave_type.allocation_changed", "leave_type.status_changed", "settings.updated",
];
const TARGETS = ["User", "LeaveRequest", "LeaveBalance", "LeaveType", "SystemSetting"];

export default function AuditLogs() {
  const [filters, setFilters] = useState({ action: "", targetType: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, error, refetch } = useGetAuditLogsQuery({ ...filters, page, limit: 15 });
  const set = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };
  return (
    <>
      <PageHeader title="Audit logs" subtitle="Append-only record of important actions. Entries cannot be edited or deleted through the application." />
      <Card padded={false}>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Action" value={filters.action} onChange={set("action")}><option value="">All actions</option>{ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}</Select>
          <Select label="Target" value={filters.targetType} onChange={set("targetType")}><option value="">All targets</option>{TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
          <Input label="From" type="date" value={filters.from} onChange={set("from")} />
          <Input label="To" type="date" value={filters.to} onChange={set("to")} />
        </div>
        <DataTable rows={data?.items} isLoading={isLoading} isFetching={isFetching} error={error} onRetry={refetch} pagination={data?.pagination} onPage={setPage} emptyTitle="No audit entries match"
          columns={[
            { key: "when", header: "When", render: (r) => formatDateTime(r.createdAt) },
            { key: "actor", header: "Actor", render: (r) => (r.actor ? `${r.actor.name} (${r.actor.role})` : "system") },
            { key: "action", header: "Action", render: (r) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{r.action}</code> },
            { key: "target", header: "Target", render: (r) => r.targetType || "-" },
            { key: "meta", header: "Details", render: (r) => (
              <details className="text-xs"><summary className="cursor-pointer text-brand-600">View</summary>
                <pre className="mt-1 max-h-48 max-w-md overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2">{JSON.stringify(r.metadata, null, 2)}</pre></details>) },
          ]} />
      </Card>
    </>
  );
}
