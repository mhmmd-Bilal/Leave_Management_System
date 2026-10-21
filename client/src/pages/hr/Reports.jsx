import { Download } from "lucide-react";
import { useState } from "react";
import EmployeePicker from "../../components/EmployeePicker.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import { Input, Select } from "../../components/ui/Field.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import { useGetLeaveTypesQuery } from "../../features/leaves/leavesApi.js";
import { useGetReportQuery, useLazyExportCsvQuery } from "../../features/reports/reportsApi.js";
import { useDebounce } from "../../hooks/useDebounce.js";
import { useToast } from "../../hooks/useToast.js";
import { LEAVE_STATUSES } from "../../utils/constants.js";
import { MONTH_NAMES } from "../../utils/format.js";

const REPORTS = [
  { name: "monthly", label: "Monthly" },
  { name: "annual", label: "Annual" },
  { name: "employees", label: "Employee-wise" },
  { name: "departments", label: "Department-wise" },
  { name: "leave-types", label: "Leave-type-wise" },
  { name: "status-summary", label: "Status summary" },
  { name: "balances", label: "Leave balances" },
];

export default function Reports() {
  const toast = useToast();
  const [name, setName] = useState("monthly");
  const [filters, setFilters] = useState({ year: "", month: "", from: "", to: "", department: "", status: "", leaveTypeId: "" });
  const [employee, setEmployee] = useState(null);
  const department = useDebounce(filters.department);
  const types = useGetLeaveTypesQuery({ includeInactive: true });
  const params = { ...filters, department, employeeId: employee?.id };
  const report = useGetReportQuery({ name, ...params });
  const [exportCsv, { isFetching: exporting }] = useLazyExportCsvQuery();
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const isBalance = name === "balances";

  const download = async () => {
    const res = await exportCsv({ report: name, ...params });
    if (res.error) return toast.fromError(res.error);
    // the CSV text comes from the backend (escaped, formula-injection safe); re-add the BOM the browser strips
    const blob = new Blob([`\uFEFF${res.data}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leave-report-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return toast.success("CSV downloaded");
  };

  return (
    <>
      <PageHeader title="Reports" subtitle="Built from live leave data. A request belongs to the period containing its start date."
        actions={<Button icon={Download} loading={exporting} onClick={download}>Export CSV</Button>} />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {REPORTS.map((r) => (
          <button key={r.name} role="tab" aria-selected={name === r.name} onClick={() => setName(r.name)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${name === r.name ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>{r.label}</button>
        ))}
      </div>
      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Year" type="number" min="2000" max="2200" placeholder="Current leave year" value={filters.year} onChange={set("year")} />
          {!isBalance && (
            <Select label="Month" value={filters.month} onChange={set("month")}>
              <option value="">Whole year</option>{MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
          )}
          {!isBalance && <Input label="From (overrides month/year)" type="date" value={filters.from} onChange={set("from")} />}
          {!isBalance && <Input label="To" type="date" value={filters.to} onChange={set("to")} />}
          <Input label="Department" placeholder="All" value={filters.department} onChange={set("department")} />
          <Select label="Leave type" value={filters.leaveTypeId} onChange={set("leaveTypeId")}>
            <option value="">All</option>{types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          {!isBalance && (
            <Select label="Status" value={filters.status} onChange={set("status")}>
              <option value="">All</option>{LEAVE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          )}
          <EmployeePicker label="Employee" value={employee} onChange={setEmployee} status="" />
        </div>
      </Card>
      <Card padded={false}>
        <DataTable rows={report.data?.rows} isLoading={report.isLoading} isFetching={report.isFetching} error={report.error} onRetry={report.refetch}
          rowKey={(r) => JSON.stringify(r)} emptyTitle="No data for these filters"
          columns={(report.data?.columns || []).map((c) => ({ key: c.key, header: c.label }))} />
      </Card>
    </>
  );
}
