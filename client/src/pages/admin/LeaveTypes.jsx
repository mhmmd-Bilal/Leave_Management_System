import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import { Alert } from "../../components/ui/ErrorState.jsx";
import { Checkbox, Input, Textarea } from "../../components/ui/Field.jsx";
import Modal from "../../components/ui/Modal.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import { useCreateLeaveTypeMutation, useGetLeaveTypesQuery, useSetLeaveTypeStatusMutation, useUpdateLeaveTypeMutation } from "../../features/leaves/leavesApi.js";
import { useToast } from "../../hooks/useToast.js";
import { getErrorMessage } from "../../utils/errors.js";

const DEFAULTS = {
  name: "", code: "", description: "", yearlyLimit: "12",
  rules: { minDays: 0.5, maxDays: 30, requiresDocument: false, allowHalfDay: false, countWeekends: false, countHolidays: false, advanceNoticeDays: 0, maxBackdateDays: 0, allowNegativeBalance: false },
};
const FLAGS = [
  ["requiresDocument", "Requires medical document"], ["allowHalfDay", "Half-day allowed"], ["countWeekends", "Count weekends as leave"],
  ["countHolidays", "Count holidays as leave"], ["allowNegativeBalance", "Allow negative balance"],
];

export default function LeaveTypes() {
  const toast = useToast();
  const { data, isLoading, error, refetch } = useGetLeaveTypesQuery({ includeInactive: true });
  const [create, creating] = useCreateLeaveTypeMutation();
  const [update, updating] = useUpdateLeaveTypeMutation();
  const [setStatus, statusState] = useSetLeaveTypeStatusMutation();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULTS);
  const [formError, setFormError] = useState("");
  const [toggle, setToggle] = useState(null);

  const open = (t) => {
    setFormError("");
    setEditing(t);
    setForm(t === "new" ? DEFAULTS : { name: t.name, code: t.code, description: t.description || "", yearlyLimit: String(t.yearlyLimit), rules: { ...DEFAULTS.rules, ...t.rules } });
  };
  const rule = (k, v) => setForm((s) => ({ ...s, rules: { ...s.rules, [k]: v } }));

  const save = async () => {
    setFormError("");
    const body = {
      name: form.name.trim(), code: form.code.trim(), description: form.description.trim(), yearlyLimit: Number(form.yearlyLimit),
      rules: { ...form.rules, minDays: Number(form.rules.minDays), maxDays: Number(form.rules.maxDays), advanceNoticeDays: Number(form.rules.advanceNoticeDays), maxBackdateDays: Number(form.rules.maxBackdateDays) },
    };
    // Client-side checks mirror the server rules so mistakes are caught before the request.
    if (body.name.length < 2) return setFormError("Name must be at least 2 characters");
    if (!/^[A-Z0-9_]{2,20}$/.test(body.code)) return setFormError("Code must be 2-20 characters: A-Z, 0-9 or _");
    if (form.yearlyLimit === "" || !(body.yearlyLimit >= 0 && body.yearlyLimit <= 366)) return setFormError("Yearly limit must be a number between 0 and 366");
    if (!(body.rules.minDays >= 0.5) || !(body.rules.maxDays >= 0.5)) return setFormError("Minimum and maximum days must be at least 0.5");
    if (body.rules.minDays > body.rules.maxDays) return setFormError("Minimum days cannot be greater than maximum days");
    if (!(body.rules.advanceNoticeDays >= 0) || !(body.rules.maxBackdateDays >= 0)) return setFormError("Advance notice and back-dating must be 0 or more");
    try {
      if (editing === "new") await create(body).unwrap();
      else await update({ id: editing.id, ...body }).unwrap();
      toast.success(editing === "new" ? "Leave type created" : "Leave type updated");
      setEditing(null);
    } catch (e) {
      setFormError(getErrorMessage(e));
    }
  };

  const confirmToggle = async () => {
    try {
      await setStatus({ id: toggle.id, active: !toggle.active }).unwrap();
      toast.success(`${toggle.name} ${toggle.active ? "deactivated" : "activated"}`);
    } catch (e) {
      toast.fromError(e);
    }
    setToggle(null);
  };

  return (
    <>
      <PageHeader title="Leave types" subtitle="Policies apply to new requests. Existing requests and approved leave are never changed. Leave types are deactivated, never deleted."
        actions={<Button icon={Plus} onClick={() => open("new")}>New leave type</Button>} />
      <Card padded={false}>
        <DataTable rows={data} isLoading={isLoading} error={error} onRetry={refetch} emptyTitle="No leave types"
          columns={[
            { key: "name", header: "Name", render: (t) => <div><p className="font-medium">{t.name}</p><p className="text-xs text-slate-400">{t.code}</p></div> },
            { key: "yearlyLimit", header: "Yearly limit" },
            { key: "dur", header: "Duration", render: (t) => `${t.rules.minDays}-${t.rules.maxDays}d` },
            { key: "rules", header: "Rules", render: (t) => <div className="flex flex-wrap gap-1">{[t.rules.requiresDocument && "document", t.rules.allowHalfDay && "half-day", t.rules.countWeekends && "weekends", t.rules.countHolidays && "holidays", t.rules.allowNegativeBalance && "negative ok", t.rules.advanceNoticeDays > 0 && `${t.rules.advanceNoticeDays}d notice`, t.rules.maxBackdateDays > 0 && `backdate ${t.rules.maxBackdateDays}d`].filter(Boolean).map((r) => <Badge key={r} status="info">{r}</Badge>)}</div> },
            { key: "active", header: "Status", render: (t) => <Badge status={t.active ? "active" : "inactive"}>{t.active ? "active" : "inactive"}</Badge> },
            { key: "act", header: "", render: (t) => (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => open(t)}>Edit</Button>
                <Button size="sm" variant="secondary" onClick={() => setToggle(t)}>{t.active ? "Deactivate" : "Activate"}</Button>
              </div>) },
          ]} />
      </Card>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} wide title={editing === "new" ? "New leave type" : `Edit ${form.name}`}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={creating.isLoading || updating.isLoading} onClick={save}>Save</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {formError && <div className="sm:col-span-2"><Alert>{formError}</Alert></div>}
          <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Code" required hint="A-Z, 0-9, _ (2-20 chars)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <div className="sm:col-span-2"><Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <Input label="Yearly limit (days)" type="number" min="0" step="0.5" value={form.yearlyLimit} onChange={(e) => setForm({ ...form, yearlyLimit: e.target.value })} />
          <span />
          <Input label="Minimum days" type="number" min="0.5" step="0.5" value={form.rules.minDays} onChange={(e) => rule("minDays", e.target.value)} />
          <Input label="Maximum days" type="number" min="0.5" step="0.5" value={form.rules.maxDays} onChange={(e) => rule("maxDays", e.target.value)} />
          <Input label="Advance notice (days)" type="number" min="0" value={form.rules.advanceNoticeDays} onChange={(e) => rule("advanceNoticeDays", e.target.value)} />
          <Input label="Back-dating allowed (days)" type="number" min="0" value={form.rules.maxBackdateDays} onChange={(e) => rule("maxBackdateDays", e.target.value)} />
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            {FLAGS.map(([k, label]) => <Checkbox key={k} label={label} checked={Boolean(form.rules[k])} onChange={(e) => rule(k, e.target.checked)} />)}
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={Boolean(toggle)} title={`${toggle?.active ? "Deactivate" : "Activate"} ${toggle?.name}?`} variant={toggle?.active ? "danger" : "success"} confirmLabel={toggle?.active ? "Deactivate" : "Activate"}
        message={toggle?.active ? "Employees can no longer apply for this leave type. Existing and pending requests keep working." : "Employees will be able to apply for this leave type again."}
        loading={statusState.isLoading} onCancel={() => setToggle(null)} onConfirm={confirmToggle} />
    </>
  );
}
