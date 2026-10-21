import { Eye } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import LeaveDetailsModal from "../../components/LeaveDetailsModal.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import { Input, Select } from "../../components/ui/Field.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import { useGetLeaveTypesQuery, useGetMyLeavesQuery } from "../../features/leaves/leavesApi.js";
import { LEAVE_STATUSES } from "../../utils/constants.js";
import { formatDate, formatDateTime } from "../../utils/format.js";

const INITIAL = { status: "", leaveTypeId: "", startDate: "", endDate: "", sortBy: "createdAt", order: "desc" };

export default function MyLeaves() {
  const [filters, setFilters] = useState(INITIAL);
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const types = useGetLeaveTypesQuery({});
  const { data, isLoading, isFetching, error, refetch } = useGetMyLeavesQuery({ ...filters, page, limit: 10 }, { pollingInterval: 30000, skipPollingIfUnfocused: true });
  const set = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };

  return (
    <>
      <PageHeader title="My leave requests" actions={<Link to="/employee/apply"><Button>Apply for leave</Button></Link>} />
      <Card padded={false}>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Select label="Status" value={filters.status} onChange={set("status")}>
            <option value="">All</option>{LEAVE_STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </Select>
          <Select label="Leave type" value={filters.leaveTypeId} onChange={set("leaveTypeId")}>
            <option value="">All</option>{types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Input label="From" type="date" value={filters.startDate} onChange={set("startDate")} />
          <Input label="To" type="date" value={filters.endDate} onChange={set("endDate")} />
          <Select label="Sort by" value={filters.sortBy} onChange={set("sortBy")}>
            <option value="createdAt">Submitted date</option><option value="startDate">Leave start date</option><option value="days">Days</option><option value="status">Status</option>
          </Select>
          <Select label="Order" value={filters.order} onChange={set("order")}><option value="desc">Newest first</option><option value="asc">Oldest first</option></Select>
        </div>
        <DataTable
          rows={data?.items} isLoading={isLoading} isFetching={isFetching} error={error} onRetry={refetch}
          pagination={data?.pagination} onPage={setPage}
          emptyTitle="No leave requests found" emptyMessage="Try different filters, or apply for leave."
          columns={[
            { key: "type", header: "Leave type", render: (r) => r.leaveType?.name },
            { key: "dates", header: "Dates", render: (r) => `${formatDate(r.startDate)} - ${formatDate(r.endDate)}` },
            { key: "days", header: "Days" },
            { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
            { key: "createdAt", header: "Submitted", render: (r) => formatDateTime(r.createdAt) },
            { key: "view", header: "", render: (r) => <Button variant="ghost" size="sm" icon={Eye} onClick={() => setDetailId(r.id)}>Details</Button> },
          ]}
        />
      </Card>
      {detailId && <LeaveDetailsModal leaveId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}
