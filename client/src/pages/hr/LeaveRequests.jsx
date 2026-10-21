import { Eye } from "lucide-react";
import { useState } from "react";
import EmployeePicker from "../../components/EmployeePicker.jsx";
import LeaveDetailsModal from "../../components/LeaveDetailsModal.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import { Input, Select } from "../../components/ui/Field.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import {
  useGetHrLeavesQuery,
  useGetLeaveTypesQuery,
} from "../../features/leaves/leavesApi.js";
import { useDebounce } from "../../hooks/useDebounce.js";
import { LEAVE_STATUSES } from "../../utils/constants.js";
import { formatDate, formatDateTime } from "../../utils/format.js";

const INITIAL = {
  status: "pending",
  leaveTypeId: "",
  department: "",
  startDate: "",
  endDate: "",
  submittedFrom: "",
  submittedTo: "",
  sortBy: "createdAt",
  order: "asc",
};

export default function LeaveRequests() {
  const [filters, setFilters] = useState(INITIAL);
  const [employee, setEmployee] = useState(null);
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const department = useDebounce(filters.department);
  const types = useGetLeaveTypesQuery({ includeInactive: true });
  const { data, isLoading, isFetching, error, refetch } = useGetHrLeavesQuery(
    { ...filters, department, employeeId: employee?.id, page, limit: 10 },
    { pollingInterval: 30000, skipPollingIfUnfocused: true },
  );
  const set = (k) => (e) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Leave requests"
        subtitle="Review, filter and decide on employee leave requests."
      />
      <Card padded={false}>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <EmployeePicker
            value={employee}
            onChange={(e) => {
              setEmployee(e);
              setPage(1);
            }}
            status=""
          />
          <Input
            label="Department"
            placeholder="Any"
            value={filters.department}
            onChange={set("department")}
          />
          <Select
            label="Status"
            value={filters.status}
            onChange={set("status")}
          >
            <option value="">All statuses</option>
            {LEAVE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            label="Leave type"
            value={filters.leaveTypeId}
            onChange={set("leaveTypeId")}
          >
            <option value="">All types</option>
            {types.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.active ? "" : " (inactive)"}
              </option>
            ))}
          </Select>
          <Input
            label="Leave from"
            type="date"
            value={filters.startDate}
            onChange={set("startDate")}
          />
          <Input
            label="Leave to"
            type="date"
            value={filters.endDate}
            onChange={set("endDate")}
          />
          <Select
            label="Sort by"
            value={filters.sortBy}
            onChange={set("sortBy")}
          >
            <option value="createdAt">Submitted date</option>
            <option value="startDate">Leave start</option>
            <option value="days">Days</option>
            <option value="status">Status</option>
          </Select>
          <Select label="Order" value={filters.order} onChange={set("order")}>
            <option value="asc">Oldest first</option>
            <option value="desc">Newest first</option>
          </Select>
        </div>
        <DataTable
          rows={data?.items}
          isLoading={isLoading}
          isFetching={isFetching}
          error={error}
          onRetry={refetch}
          pagination={data?.pagination}
          onPage={setPage}
          emptyTitle="No leave requests match these filters"
          columns={[
            {
              key: "emp",
              header: "Employee",
              render: (r) => (
                <div>
                  <p className="font-medium">{r.employee?.name}</p>
                  <p className="text-xs text-slate-400">
                    {r.employee?.department}
                  </p>
                </div>
              ),
            },
            { key: "type", header: "Type", render: (r) => r.leaveType?.name },
            {
              key: "dates",
              header: "Dates",
              render: (r) =>
                `${formatDate(r.startDate)} - ${formatDate(r.endDate)}`,
            },
            { key: "days", header: "Days" },
            {
              key: "status",
              header: "Status",
              render: (r) => <Badge status={r.status} />,
            },
            {
              key: "sub",
              header: "Submitted",
              render: (r) => formatDateTime(r.createdAt),
            },
            {
              key: "act",
              header: "",
              render: (r) => (
                <Button
                  size="sm"
                  variant={r.status === "pending" ? "primary" : "ghost"}
                  icon={Eye}
                  onClick={() => setDetailId(r.id)}
                >
                  {r.status === "pending" ? "Review" : "View"}
                </Button>
              ),
            },
          ]}
        />
      </Card>
      {detailId && (
        <LeaveDetailsModal
          leaveId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </>
  );
}
