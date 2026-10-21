import { useEffect, useState } from "react";
import Button from "./Button.jsx";
import { Textarea } from "./Field.jsx";
import Modal from "./Modal.jsx";

/** Confirmation dialog. With `reasonLabel` it also collects a reason (optional unless reasonRequired). */
export default function ConfirmDialog({
  open, title, message, confirmLabel = "Confirm", variant = "primary", loading = false,
  reasonLabel, reasonRequired = false, reasonMin = 1, onConfirm, onCancel,
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  const tooShort = reasonLabel && reasonRequired && reason.trim().length < reasonMin;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant={variant} loading={loading} disabled={tooShort} onClick={() => onConfirm(reason.trim())}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
      {reasonLabel && (
        <div className="mt-4">
          <Textarea label={reasonLabel} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required={reasonRequired}
            hint={reasonRequired && reasonMin > 1 ? `At least ${reasonMin} characters` : undefined} />
        </div>
      )}
    </Modal>
  );
}
