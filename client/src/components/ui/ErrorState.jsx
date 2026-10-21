import { AlertCircle } from "lucide-react";
import { getErrorMessage } from "../../utils/errors.js";
import Button from "./Button.jsx";

export default function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center" role="alert">
      <AlertCircle className="h-8 w-8 text-red-400" aria-hidden="true" />
      <p className="text-sm text-slate-700">{getErrorMessage(error, "Could not load data.")}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Alert({ tone = "error", children }) {
  const tones = {
    error: "border-red-200 bg-red-50 text-red-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    info: "border-brand-200 bg-brand-50 text-brand-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}
