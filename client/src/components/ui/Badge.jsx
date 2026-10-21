// Quiet status chips: tinted background, hairline ring and a small dot. No saturated fills.
const COLORS = {
  pending: "bg-amber-50 text-amber-800 ring-amber-600/20",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  active: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  rejected: "bg-red-50 text-red-800 ring-red-600/20",
  disabled: "bg-slate-100 text-slate-700 ring-slate-500/20",
  relieved: "bg-slate-100 text-slate-700 ring-slate-500/20",
  cancelled: "bg-slate-100 text-slate-700 ring-slate-500/20",
  inactive: "bg-slate-100 text-slate-700 ring-slate-500/20",
  info: "bg-brand-50 text-brand-700 ring-brand-600/20",
};
const DOTS = {
  pending: "bg-amber-500", approved: "bg-emerald-500", active: "bg-emerald-500", rejected: "bg-red-500",
  disabled: "bg-slate-400", relieved: "bg-slate-400", cancelled: "bg-slate-400", inactive: "bg-slate-400", info: "bg-brand-500",
};

export default function Badge({ status, children }) {
  const key = COLORS[status] ? status : "info";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${COLORS[key]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[key]}`} aria-hidden="true" />
      {children ?? status}
    </span>
  );
}
