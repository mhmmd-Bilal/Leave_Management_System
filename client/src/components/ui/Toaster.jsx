import { CheckCircle2, X, XCircle } from "lucide-react";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { dismissToast } from "../../features/ui/uiSlice.js";

function Toast({ toast }) {
  const dispatch = useDispatch();
  useEffect(() => {
    const t = setTimeout(() => dispatch(dismissToast(toast.id)), 5000);
    return () => clearTimeout(t);
  }, [dispatch, toast.id]);
  const ok = toast.type === "success";
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div role={ok ? "status" : "alert"} className={`flex items-start gap-2 rounded-md border bg-white px-4 py-3 text-sm shadow-pop ${ok ? "border-emerald-200" : "border-red-200"}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ok ? "text-emerald-600" : "text-red-600"}`} aria-hidden="true" />
      <p className="flex-1 text-slate-700">{toast.message}</p>
      <button aria-label="Dismiss" onClick={() => dispatch(dismissToast(toast.id))} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
    </div>
  );
}

export default function Toaster() {
  const toasts = useSelector((s) => s.ui.toasts);
  return <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 [&>*]:pointer-events-auto">{toasts.map((t) => <Toast key={t.id} toast={t} />)}</div>;
}
