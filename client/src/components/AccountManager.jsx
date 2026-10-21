import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import Badge from "./ui/Badge.jsx";
import Button from "./ui/Button.jsx";
import Card from "./ui/Card.jsx";
import ConfirmDialog from "./ui/ConfirmDialog.jsx";
import DataTable from "./ui/DataTable.jsx";
import { Alert } from "./ui/ErrorState.jsx";
import { Input, Select } from "./ui/Field.jsx";
import Modal from "./ui/Modal.jsx";
import PageHeader from "./ui/PageHeader.jsx";
import {
  useCreateHrMutation, useGetAdminEmployeesQuery, useGetAdminHrQuery, useSetAdminEmployeeStatusMutation, useSetAdminHrStatusMutation,
  useUpdateAdminEmployeeMutation, useUpdateAdminHrMutation,
} from "../features/employees/employeesApi.js";
import { useDebounce } from "../hooks/useDebounce.js";
import { useToast } from "../hooks/useToast.js";
import { ACCOUNT_STATUSES } from "../utils/constants.js";
import { getErrorMessage } from "../utils/errors.js";
import { formatDate } from "../utils/format.js";

const EMPTY = { name: "", email: "", phone: "", employeeId: "", department: "", joiningDate: "", password: "" };

/** Admin account management for employees (kind="employee") or HR staff (kind="hr"). */
export default function AccountManager({ kind }) {
  const isHr = kind === "hr";
  const toast = useToast();
  const [filters, setFilters] = useState({ search: "", department: "", status: "" });
  const [page, setPage] = useState(1);
  const search = useDebounce(filters.search);
  const department = useDebounce(filters.department);
  const params = { search, department, status: filters.status, page, limit: 10 };
  const employees = useGetAdminEmployeesQuery(params, { skip: isHr });
  const hrs = useGetAdminHrQuery(params, { skip: !isHr });
  const q = isHr ? hrs : employees;
  const [updateEmployee, updEmp] = useUpdateAdminEmployeeMutation();
  const [updateHr, updHr] = useUpdateAdminHrMutation();
  const [setEmpStatus, stEmp] = useSetAdminEmployeeStatusMutation();
  const [setHrStatus, stHr] = useSetAdminHrStatusMutation();
  const [createHr, creating] = useCreateHrMutation();

  const [editing, setEditing] = useState(null); // account | "new"
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [statusAction, setStatusAction] = useState(null); // { user, status }
  const set = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };
  const f = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const openEdit = (u) => {
    setFormError("");
    setEditing(u);
    setForm(u === "new" ? EMPTY : { name: u.name, email: u.email, phone: u.phone, employeeId: u.employeeId, department: u.department, joiningDate: u.joiningDate?.slice(0, 10), password: "" });
  };

  const save = async () => {
    setFormError("");
    try {
      if (editing === "new") {
        await createHr(form).unwrap();
        toast.success("HR account created");
      } else {
        const { password: _p, ...patch } = form;
        await (isHr ? updateHr : updateEmployee)({ id: editing.id, ...patch }).unwrap();
        toast.success("Account updated");
      }
      setEditing(null);
    } catch (e) {
      setFormError(getErrorMessage(e));
    }
  };

  const changeStatus = async (reason) => {
    try {
      await (isHr ? setHrStatus : setEmpStatus)({ id: statusAction.user.id, status: statusAction.status, reason: reason || undefined }).unwrap();
      toast.success(`${statusAction.user.name} is now ${statusAction.status}`);
    } catch (e) {
      toast.fromError(e);
    }
    setStatusAction(null);
  };

  const actions = (u) => {
    const out = [<Button key="e" size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(u)}>Edit</Button>];
    if (u.status === "active") {
      out.push(<Button key="d" size="sm" variant="secondary" onClick={() => setStatusAction({ user: u, status: "disabled" })}>Disable</Button>);
      if (!isHr) out.push(<Button key="r" size="sm" variant="secondary" onClick={() => setStatusAction({ user: u, status: "relieved" })}>Mark relieved</Button>);
    }
    if (u.status === "disabled") {
      out.push(<Button key="a" size="sm" variant="success" onClick={() => setStatusAction({ user: u, status: "active" })}>Reactivate</Button>);
      if (!isHr) out.push(<Button key="r" size="sm" variant="secondary" onClick={() => setStatusAction({ user: u, status: "relieved" })}>Mark relieved</Button>);
    }
    return <div className="flex flex-wrap gap-1">{out}</div>;
  };

  const saving = creating.isLoading || updEmp.isLoading || updHr.isLoading;
  const statusLoading = stEmp.isLoading || stHr.isLoading;
  const verb = { disabled: "Disable", active: "Reactivate", relieved: "Mark as relieved" };

  return (
    <>
      <PageHeader title={isHr ? "HR staff" : "Employees"} subtitle={isHr ? "Create and manage HR accounts. HR accounts cannot be created through public registration." : "Search, edit and manage employee accounts. New registrations are approved under Registrations."}
        actions={isHr && <Button icon={Plus} onClick={() => openEdit("new")}>Create HR account</Button>} />
      <Card padded={false}>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
          <Input label="Search" placeholder="Name, email or employee ID" value={filters.search} onChange={set("search")} />
          <Input label="Department" placeholder="Any" value={filters.department} onChange={set("department")} />
          <Select label="Status" value={filters.status} onChange={set("status")}>
            <option value="">All</option>{ACCOUNT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
        <DataTable rows={q.data?.items} isLoading={q.isLoading} isFetching={q.isFetching} error={q.error} onRetry={q.refetch} pagination={q.data?.pagination} onPage={setPage}
          emptyTitle="No accounts found"
          columns={[
            { key: "name", header: "Name", render: (u) => <div><p className="font-medium">{u.name}</p><p className="text-xs text-slate-400">{u.email}</p></div> },
            { key: "employeeId", header: "ID" },
            { key: "department", header: "Department" },
            { key: "joiningDate", header: "Joined", render: (u) => formatDate(u.joiningDate) },
            { key: "status", header: "Status", render: (u) => <Badge status={u.status} /> },
            { key: "act", header: "", render: actions },
          ]} />
      </Card>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === "new" ? "Create HR account" : "Edit account"} wide
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={saving} onClick={save}>{editing === "new" ? "Create account" : "Save changes"}</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {formError && <div className="sm:col-span-2"><Alert>{formError}</Alert></div>}
          <Input label="Full name" value={form.name} onChange={f("name")} required />
          <Input label="Email" type="email" value={form.email} onChange={f("email")} required />
          <Input label="Phone" value={form.phone} onChange={f("phone")} required />
          <Input label="Employee ID" value={form.employeeId} onChange={f("employeeId")} required />
          <Input label="Department" value={form.department} onChange={f("department")} required />
          <Input label="Joining date" type="date" value={form.joiningDate} onChange={f("joiningDate")} required />
          {editing === "new" && <div className="sm:col-span-2"><Input label="Initial password" type="password" value={form.password} onChange={f("password")} hint="Min 8 characters with a letter and a number. Share it securely; the user can change it after signing in." required /></div>}
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(statusAction)} title={`${verb[statusAction?.status] || ""}?`} variant={statusAction?.status === "active" ? "success" : "danger"} confirmLabel={verb[statusAction?.status]}
        reasonLabel="Reason (optional)" loading={statusLoading} onCancel={() => setStatusAction(null)} onConfirm={changeStatus}
        message={statusAction?.status === "active" ? `${statusAction?.user.name} will be able to sign in again.` : `${statusAction?.user.name} is signed out immediately and loses access. Pending leave requests can still be rejected by HR.`} />
    </>
  );
}
