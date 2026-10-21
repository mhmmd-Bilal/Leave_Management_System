import Skeleton from "./Skeleton.jsx";

const TONES = { brand: "text-brand-600", indigo: "text-brand-600", amber: "text-amber-600", emerald: "text-emerald-600", red: "text-red-600", slate: "text-slate-500" };

/** Key figure. Shows a skeleton while `value` is undefined (still loading). */
export default function StatCard({ label, value, icon: Icon, tone = "brand", hint }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
        {Icon && <Icon className={`h-4 w-4 ${TONES[tone] || TONES.brand}`} aria-hidden="true" />}
      </div>
      {value === undefined ? <Skeleton className="mt-3 h-8 w-16" /> : <p className="num mt-2 font-serif text-3xl font-semibold text-slate-900">{value ?? "-"}</p>}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
