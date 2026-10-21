import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary: "bg-brand-600 text-white shadow-card hover:bg-brand-700 disabled:bg-brand-300",
  secondary: "bg-white text-slate-700 border border-slate-300 shadow-card hover:bg-slate-50 disabled:text-slate-400 disabled:hover:bg-white",
  danger: "bg-red-700 text-white shadow-card hover:bg-red-800 disabled:bg-red-300",
  success: "bg-emerald-700 text-white shadow-card hover:bg-emerald-800 disabled:bg-emerald-300",
  ghost: "text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent",
};
const SIZES = { sm: "px-2.5 py-1.5 text-xs", md: "px-4 py-2 text-sm" };

export default function Button({ variant = "primary", size = "md", loading = false, icon: Icon, children, className = "", disabled, type = "button", ...props }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
