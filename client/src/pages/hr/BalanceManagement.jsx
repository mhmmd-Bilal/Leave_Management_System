import { MinusCircle, PlusCircle } from "lucide-react";
import { useState } from "react";
import EmployeePicker from "../../components/EmployeePicker.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import { Alert } from "../../components/ui/ErrorState.jsx";
import { Input, Select, Textarea } from "../../components/ui/Field.jsx";
import Modal from "../../components/ui/Modal.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import { useAdjustBalanceMutation, useGetAdjustmentsQuery, useGetEmployeeBalancesQuery } from "../../features/balances/balancesApi.js";
import { useGetLeaveTypesQuery } from "../../features/leaves/leavesApi.js";
import { useToast } from "../../hooks/useToast.js";
import { getErrorMessage } from "../../utils/errors.js";
import { formatDateTime } from "../../utils/format.js";

export default function BalanceManagement() {
  const toast = useToast();
  const [employee, setEmployee] = useState(null);
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: "", mode: "add", amount: "1", reason: "" });
  const skip = !employee;
  const balances = useGetEmployeeBalancesQuery({ employeeId: employee?.id, year }, { skip });
  const history = useGetAdjustmentsQuery({ employeeId: employee?.id, page, limit: 5 }, { skip });
  const types = useGetLeaveTypesQuery({});
  const [adjust, { isLoading, error, reset }] = useAdjustBalanceMutation();
  const amount = Number(form.amount);
  const valid = form.leaveTypeId && amount > 0 && Number.isInteger(amount * 2) && form.reason.trim().length >= 5;

  const submit = async () => {
    try {
      await adjust({
        employeeId: employee.id, leaveTypeId: form.leaveTypeId, year: balances.data?.year,
        delta: form.mode === "add" ? amount : -amount, reason: form.reason.trim(),
      }).unwrap();
      toast.success("Balance adjusted. The employee has been notified.");
      setOpen(false);
      setForm({ leaveTypeId: "", mode: "add", amount: "1", reason: "" });
    } catch { /* shown in dialog */ }
  };

  return (
    <>
      <PageHeader title="Leave balance management" subtitle="Add or deduct allocation with a mandatory reason. Every change is audited."
        actions={employee && <Button icon={PlusCircle} onClick={() => { reset(); setOpen(true); }}>Adjust balance</Button>} />
      <Card className="mb-6"><div className="max-w-md"><EmployeePicker value={employee} onChange={(e) => { setEmployee(e); setPage(1); setYear(""); }} /></div></Card>

      {employee && (
        <div className="space-y-6">
          <Card title={`Balances - ${employee.name}${balances.data ? ` (${balances.data.year})` : ""}`} padded={false}
            action={balances.data?.availableYears?.length > 0 && (
              <div className="w-28"><Select aria-label="Year" value={year || balances.data.year} onChange={(e) => setYear(e.target.value)}>
                {[...new Set([balances.data.year, ...balances.data.availableYears])].sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
              </Select></div>)}>
            <DataTable rows={balances.data?.balances} isLoading={balances.isLoading} error={balances.error} onRetry={balances.refetch} emptyTitle="No balances for this year"
              columns={[
                { key: "t", header: "Leave type", render: (r) => r.leaveType.name },
                { key: "base", header: "Base", render: (r) => r.baseAllocation },
                { key: "adj", header: "Adjustments", render: (r) => (r.adjustment > 0 ? `+${r.adjustment}` : r.adjustment) },
                { key: "allocated", header: "Allocated" },
                { key: "used", header: "Used" },
                { key: "available", header: "Available", render: (r) => <strong>{r.available}</strong> },
              ]} />
          </Card>
          <Card title="Adjustment history" padded={false}>
            <DataTable rows={history.data?.items} isLoading={history.isLoading} error={history.error} onRetry={history.refetch} pagination={history.data?.pagination} onPage={setPage} emptyTitle="No manual adjustments yet"
              columns={[
                { key: "when", header: "Date", render: (r) => formatDateTime(r.createdAt) },
                { key: "t", header: "Leave type", render: (r) => r.leaveTypeId?.name },
                { key: "year", header: "Year" },
                { key: "delta", header: "Change", render: (r) => <span className={r.delta > 0 ? "text-emerald-700" : "text-red-700"}>{r.delta > 0 ? `+${r.delta}` : r.delta}</span> },
                { key: "bal", header: "Available", render: (r) => `${r.previousAvailable} -> ${r.newAvailable}` },
                { key: "reason", header: "Reason" },
                { key: "by", header: "By", render: (r) => r.actorId?.name },
              ]} />
          </Card>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={`Adjust balance - ${employee?.name || ""}`}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={isLoading} disabled={!valid} icon={form.mode === "add" ? PlusCircle : MinusCircle} onClick={submit}>{form.mode === "add" ? "Add days" : "Deduct days"}</Button></>}>
        <div className="space-y-3">
          {error && <Alert>{getErrorMessage(error)}</Alert>}
          <Select label="Leave type" required value={form.leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}>
            <option value="">Select leave type</option>{types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Action" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}><option value="add">Add allocation</option><option value="deduct">Deduct allocation</option></Select>
            <Input label="Days" type="number" min="0.5" step="0.5" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <Textarea label="Reason" required hint="Mandatory - at least 5 characters. Visible to the employee and in the audit log." value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={500} />
          <p className="text-xs text-slate-500">Applies to the {balances.data?.year} balance year shown above.</p>
        </div>
      </Modal>
    </>
  );
}
