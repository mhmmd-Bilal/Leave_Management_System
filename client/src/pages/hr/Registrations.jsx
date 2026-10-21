import { Check, X } from "lucide-react";
import { useState } from "react";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import Modal from "../../components/ui/Modal.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import {
  useApproveRegistrationMutation, useGetPendingRegistrationsQuery, useGetRejectedRegistrationsQuery, useRejectRegistrationMutation,
} from "../../features/employees/employeesApi.js";
import { useToast } from "../../hooks/useToast.js";
import { formatDate, formatDateTime } from "../../utils/format.js";

export default function Registrations() {
  const toast = useToast();
  const [tab, setTab] = useState("pending");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null); // { type: "approve" | "reject", user }
  const pending = useGetPendingRegistrationsQuery({ page, limit: 10, sortBy: "createdAt", order: "asc" }, { skip: tab !== "pending", pollingInterval: 30000, skipPollingIfUnfocused: true });
  const rejected = useGetRejectedRegistrationsQuery({ page, limit: 10 }, { skip: tab !== "rejected" });
  const q = tab === "pending" ? pending : rejected;
  const [approve, approveState] = useApproveRegistrationMutation();
  const [reject, rejectState] = useRejectRegistrationMutation();

  const confirm = async (reason) => {
    try {
      if (action.type === "approve") await approve(action.user.id).unwrap();
      else await reject({ id: action.user.id, reason }).unwrap();
      toast.success(action.type === "approve" ? `${action.user.name} approved` : `${action.user.name} rejected`);
    } catch (e) {
      toast.fromError(e);
    }
    setAction(null);
    setSelected(null);
  };

  const columns = [
    { key: "name", header: "Name", render: (r) => <button className="font-medium text-brand-700 hover:underline" onClick={() => setSelected(r)}>{r.name}</button> },
    { key: "employeeId", header: "Employee ID" },
    { key: "department", header: "Department" },
    { key: "email", header: "Email" },
    { key: "createdAt", header: "Registered", render: (r) => formatDateTime(r.createdAt) },
    tab === "pending"
      ? { key: "act", header: "", render: (r) => (
        <div className="flex gap-2">
          <Button size="sm" variant="success" icon={Check} onClick={() => setAction({ type: "approve", user: r })}>Approve</Button>
          <Button size="sm" variant="danger" icon={X} onClick={() => setAction({ type: "reject", user: r })}>Reject</Button>
        </div>) }
      : { key: "reason", header: "Reason", render: (r) => r.statusReason || "-" },
  ];

  return (
    <>
      <PageHeader title="Registration verification" subtitle="Only approved employees can sign in and use the system." />
      <div className="mb-4 flex gap-2" role="tablist">
        {["pending", "rejected"].map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setPage(1); }}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${tab === t ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>{t}</button>
        ))}
      </div>
      <Card padded={false}>
        <DataTable rows={q.data?.items} isLoading={q.isLoading} isFetching={q.isFetching} error={q.error} onRetry={q.refetch} pagination={q.data?.pagination} onPage={setPage}
          emptyTitle={tab === "pending" ? "No pending registrations" : "No rejected registrations"} columns={columns} />
      </Card>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Employee details"
        footer={selected?.status === "pending" && (<>
          <Button variant="danger" onClick={() => setAction({ type: "reject", user: selected })}>Reject</Button>
          <Button variant="success" onClick={() => setAction({ type: "approve", user: selected })}>Approve</Button></>)}>
        {selected && (
          <dl className="grid grid-cols-3 gap-y-2 text-sm">
            {[["Name", selected.name], ["Employee ID", selected.employeeId], ["Email", selected.email], ["Phone", selected.phone], ["Department", selected.department],
              ["Joining date", formatDate(selected.joiningDate)], ["Registered", formatDateTime(selected.createdAt)]].map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd className="col-span-2">{v}</dd></div>
            ))}
            <dt className="text-slate-500">Status</dt><dd className="col-span-2"><Badge status={selected.status} /></dd>
            {selected.statusReason && <><dt className="text-slate-500">Reason</dt><dd className="col-span-2">{selected.statusReason}</dd></>}
          </dl>
        )}
      </Modal>

      <ConfirmDialog open={action?.type === "approve"} title="Approve registration?" variant="success" confirmLabel="Approve"
        message={`${action?.user.name} will be able to sign in and apply for leave.`} loading={approveState.isLoading} onCancel={() => setAction(null)} onConfirm={confirm} />
      <ConfirmDialog open={action?.type === "reject"} title="Reject registration?" variant="danger" confirmLabel="Reject" reasonLabel="Reason (optional)"
        message={`${action?.user.name} will not be able to sign in.`} loading={rejectState.isLoading} onCancel={() => setAction(null)} onConfirm={confirm} />
    </>
  );
}
