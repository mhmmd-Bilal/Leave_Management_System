import { zodResolver } from "@hookform/resolvers/zod";
import { Paperclip } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import { Alert } from "../../components/ui/ErrorState.jsx";
import { Checkbox, Input, Select, Textarea } from "../../components/ui/Field.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { useApplyLeaveMutation, useGetLeaveCalculationQuery, useGetLeaveTypesQuery } from "../../features/leaves/leavesApi.js";
import { useToast } from "../../hooks/useToast.js";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_MB } from "../../utils/constants.js";
import { getErrorMessage } from "../../utils/errors.js";
import { formatDate } from "../../utils/format.js";

const schema = z.object({
  leaveTypeId: z.string().min(1, "Select a leave type"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  isHalfDay: z.boolean().optional(),
  reason: z.string().trim().min(3, "Please give a reason (min 3 characters)").max(1000),
}).refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { message: "End date cannot be before start date", path: ["endDate"] });

export default function ApplyLeave() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const types = useGetLeaveTypesQuery({});
  const [apply, { isLoading, error }] = useApplyLeaveMutation();
  const { register, handleSubmit, control, setValue, getValues, formState: { errors } } = useForm({
    resolver: zodResolver(schema), defaultValues: { leaveTypeId: "", startDate: "", endDate: "", isHalfDay: false, reason: "" },
  });
  const [leaveTypeId, startDate, endDate, isHalfDay] = useWatch({ control, name: ["leaveTypeId", "startDate", "endDate", "isHalfDay"] });
  const type = types.data?.find((t) => t.id === leaveTypeId);
  // A half day is always a single day: keep the end date equal to the start date.
  useEffect(() => {
    if (isHalfDay && startDate && endDate !== startDate) setValue("endDate", startDate, { shouldValidate: true });
  }, [isHalfDay, startDate, endDate, setValue]);
  const ready = Boolean(leaveTypeId && startDate && endDate && endDate >= startDate);
  const calc = useGetLeaveCalculationQuery({ leaveTypeId, startDate, endDate, isHalfDay: String(Boolean(isHalfDay)) }, { skip: !ready || (Boolean(isHalfDay) && endDate !== startDate) });

  const onFile = (e) => {
    const f = e.target.files?.[0];
    setFileError("");
    if (!f) return setFile(null);
    if (!ALLOWED_UPLOAD_TYPES.includes(f.type)) { setFileError("Only PDF, JPG or PNG files are allowed"); e.target.value = ""; return setFile(null); }
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024) { setFileError(`File must be smaller than ${MAX_UPLOAD_MB} MB`); e.target.value = ""; return setFile(null); }
    return setFile(f);
  };

  const needsDoc = Boolean(type?.rules.requiresDocument);
  const canSubmit = ready && calc.isSuccess && !calc.isFetching && (!needsDoc || file);

  const submit = async () => {
    const v = getValues();
    const fd = new FormData();
    fd.append("leaveTypeId", v.leaveTypeId);
    fd.append("startDate", v.startDate);
    fd.append("endDate", v.endDate);
    fd.append("days", String(calc.data.days)); // the server re-calculates and verifies this value
    fd.append("reason", v.reason.trim());
    fd.append("isHalfDay", String(Boolean(v.isHalfDay)));
    if (file) fd.append("medicalDocument", file);
    try {
      await apply(fd).unwrap();
      toast.success("Leave request submitted. Your balance is deducted only if it is approved.");
      navigate("/employee/leaves");
    } catch (e) {
      toast.fromError(e);
      setConfirming(false);
    }
  };

  const insufficient = calc.data?.balances?.find((b) => !b.sufficient);
  return (
    <>
      <PageHeader title="Apply for leave" subtitle="Your balance is not deducted when you apply - only when HR approves." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {types.isLoading ? <Spinner /> : (
            <form onSubmit={handleSubmit(() => setConfirming(true))} className="space-y-4" noValidate>
              {error && !confirming && <Alert>{getErrorMessage(error)}</Alert>}
              <Select label="Leave type" required error={errors.leaveTypeId?.message} {...register("leaveTypeId", { onChange: () => setValue("isHalfDay", false) })}>
                <option value="">Select a leave type</option>
                {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Start date" type="date" required error={errors.startDate?.message} {...register("startDate")} />
                <Input label="End date" type="date" required min={startDate || undefined} readOnly={Boolean(isHalfDay)} hint={isHalfDay ? "Half day: same as the start date" : undefined} error={errors.endDate?.message} {...register("endDate")} />
              </div>
              {type?.rules.allowHalfDay && <Checkbox label="Half day (single day only)" {...register("isHalfDay")} />}
              <Textarea label="Reason" required error={errors.reason?.message} {...register("reason")} />

              <div>
                <span className="mb-1 block text-sm font-medium text-slate-700">Medical document {needsDoc ? <span className="text-red-500">*</span> : <span className="font-normal text-slate-400">(optional)</span>}</span>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={onFile} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700" aria-label="Medical document" />
                {fileError && <p className="mt-1 text-xs text-red-600" role="alert">{fileError}</p>}
                {file && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Paperclip className="h-3 w-3" /> {file.name} - uploaded privately to secure cloud storage when you submit</p>}
                {needsDoc && !file && <p className="mt-1 text-xs text-amber-700">This leave type requires a supporting document.</p>}
              </div>
              <Button type="submit" disabled={!canSubmit} loading={isLoading}>Review and submit</Button>
            </form>
          )}
        </Card>

        <Card title="Calculated leave">
          {!ready ? <p className="text-sm text-slate-500">Choose a leave type and dates to see how many days will be counted (weekends and holidays follow the leave policy).</p>
            : calc.isFetching ? <Spinner /> : calc.error ? <Alert>{getErrorMessage(calc.error)}</Alert> : (
              <div className="space-y-3">
                <p className="text-3xl font-semibold text-slate-900">{calc.data.days} <span className="text-base font-normal text-slate-500">day(s)</span></p>
                <p className="text-sm text-slate-500">{formatDate(startDate)} to {formatDate(endDate)}</p>
                {calc.data.balances.map((b) => (
                  <p key={b.year} className={`text-sm ${b.sufficient ? "text-slate-600" : "text-red-600"}`}>{b.year}: {b.days} day(s) from {b.available} available</p>
                ))}
                {insufficient && <Alert tone="warning">Your balance is not enough for this request; the server will reject it.</Alert>}
              </div>
            )}
          {type && (
            <dl className="mt-5 space-y-1 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <div className="flex justify-between"><dt>Duration</dt><dd>{type.rules.minDays} - {type.rules.maxDays} days</dd></div>
              <div className="flex justify-between"><dt>Advance notice</dt><dd>{type.rules.advanceNoticeDays} day(s)</dd></div>
              <div className="flex justify-between"><dt>Back-dating</dt><dd>{type.rules.maxBackdateDays ? `up to ${type.rules.maxBackdateDays} day(s)` : "not allowed"}</dd></div>
              <div className="flex justify-between"><dt>Document</dt><dd>{type.rules.requiresDocument ? "required" : "optional"}</dd></div>
            </dl>
          )}
        </Card>
      </div>

      <ConfirmDialog open={confirming} title="Submit leave request?" confirmLabel="Submit request" loading={isLoading}
        message={`${type?.name || "Leave"}: ${formatDate(startDate)} to ${formatDate(endDate)} (${calc.data?.days ?? "?"} day(s)). HR will review it.`}
        onCancel={() => setConfirming(false)} onConfirm={submit} />
    </>
  );
}
