import { Check, Paperclip, X as XIcon } from "lucide-react";
import { useState } from "react";
import { useApproveLeaveMutation, useCancelLeaveMutation, useGetLeaveQuery, useLazyGetDocumentLinkQuery, useRejectLeaveMutation } from "../features/leaves/leavesApi.js";
import { useAuth } from "../hooks/useAuth.js";
import { useToast } from "../hooks/useToast.js";
import { formatDate, formatDateTime, formatDays } from "../utils/format.js";
import Badge from "./ui/Badge.jsx";
import Button from "./ui/Button.jsx";
import ConfirmDialog from "./ui/ConfirmDialog.jsx";
import ErrorState from "./ui/ErrorState.jsx";
import Modal from "./ui/Modal.jsx";
import Spinner from "./ui/Spinner.jsx";

const Row = ({ label, children }) => (
  <div className="grid grid-cols-3 gap-2 border-b border-slate-50 py-2 text-sm">
    <dt className="text-slate-500">{label}</dt>
    <dd className="col-span-2 text-slate-800">{children}</dd>
  </div>
);

/** Shared by employees (details + cancel) and HR/Admin (details + approve/reject). */
export default function LeaveDetailsModal({ leaveId, onClose }) {
  const { role } = useAuth();
  const toast = useToast();
  const { data: leave, isLoading, error, refetch } = useGetLeaveQuery(leaveId, { skip: !leaveId });
  const [getLink, { isFetching: linking }] = useLazyGetDocumentLinkQuery();
  const [cancelLeave, cancelState] = useCancelLeaveMutation();
  const [approveLeave, approveState] = useApproveLeaveMutation();
  const [rejectLeave, rejectState] = useRejectLeaveMutation();
  const [confirm, setConfirm] = useState(null); // "cancel" | "approve" | "reject"
  const reviewer = role === "hr" || role === "admin";

  const openDocument = async () => {
    const res = await getLink(leaveId);
    if (res.error) return toast.fromError(res.error);
    window.open(res.data.url, "_blank", "noopener,noreferrer"); // short-lived signed Cloudinary URL
    return undefined;
  };

  const run = async (fn, okMessage) => {
    try {
      await fn().unwrap();
      toast.success(okMessage);
      setConfirm(null);
      onClose();
    } catch (err) {
      toast.fromError(err);
      setConfirm(null);
    }
  };

  const pending = leave?.status === "pending";
  return (
    <>
      <Modal open={Boolean(leaveId)} onClose={onClose} title="Leave request details" wide
        footer={pending && (
          <>
            {reviewer ? (
              <>
                <Button variant="danger" icon={XIcon} onClick={() => setConfirm("reject")}>Reject</Button>
                <Button variant="success" icon={Check} onClick={() => setConfirm("approve")}>Approve</Button>
              </>
            ) : (
              <Button variant="danger" onClick={() => setConfirm("cancel")}>Cancel request</Button>
            )}
          </>
        )}>
        {isLoading && <Spinner />}
        {error && <ErrorState error={error} onRetry={refetch} />}
        {leave && (
          <dl>
            {reviewer && leave.employee && <Row label="Employee">{leave.employee.name} <span className="text-slate-400">({leave.employee.employeeId} - {leave.employee.department})</span></Row>}
            <Row label="Leave type">{leave.leaveType?.name}</Row>
            <Row label="Dates">{formatDate(leave.startDate)} to {formatDate(leave.endDate)}</Row>
            <Row label="Days">{formatDays(leave.days)}{leave.isHalfDay && " (half day)"}</Row>
            {leave.yearBreakdown?.length > 1 && <Row label="Per year">{leave.yearBreakdown.map((y) => `${y.year}: ${y.days}`).join(" | ")}</Row>}
            <Row label="Status"><Badge status={leave.status} /></Row>
            <Row label="Reason">{leave.reason}</Row>
            <Row label="Submitted">{formatDateTime(leave.createdAt)}</Row>
            {leave.reviewedBy && <Row label="Reviewed by">{leave.reviewedBy.name} on {formatDateTime(leave.reviewedAt)}</Row>}
            {leave.rejectionReason && <Row label="Rejection reason">{leave.rejectionReason}</Row>}
            {leave.cancelledAt && <Row label="Cancelled">{formatDateTime(leave.cancelledAt)}</Row>}
            {leave.medicalDocument && (
              <Row label="Document">
                <Button variant="secondary" size="sm" icon={Paperclip} loading={linking} onClick={openDocument}>
                  {leave.medicalDocument.originalName}
                </Button>
              </Row>
            )}
          </dl>
        )}
      </Modal>

      <ConfirmDialog open={confirm === "cancel"} title="Cancel this request?" message="Your leave balance is not affected. This cannot be undone." confirmLabel="Yes, cancel request" variant="danger"
        loading={cancelState.isLoading} onCancel={() => setConfirm(null)} onConfirm={() => run(() => cancelLeave(leaveId), "Leave request cancelled")} />
      <ConfirmDialog open={confirm === "approve"} title="Approve this request?" confirmLabel="Approve" variant="success"
        message="The leave days will be deducted from the employee's balance now (atomically). The employee is notified."
        loading={approveState.isLoading} onCancel={() => setConfirm(null)} onConfirm={() => run(() => approveLeave(leaveId), "Leave approved")} />
      <ConfirmDialog open={confirm === "reject"} title="Reject this request?" confirmLabel="Reject" variant="danger" reasonLabel="Rejection reason (optional)"
        message="No leave balance is deducted. The employee is notified."
        loading={rejectState.isLoading} onCancel={() => setConfirm(null)} onConfirm={(reason) => run(() => rejectLeave({ id: leaveId, reason }), "Leave rejected")} />
    </>
  );
}
