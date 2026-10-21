import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useGetCalendarQuery } from "../features/reports/reportsApi.js";
import { useAuth } from "../hooks/useAuth.js";
import { useDebounce } from "../hooks/useDebounce.js";
import { MONTH_NAMES, WEEKDAYS, formatDate, toIsoDate } from "../utils/format.js";
import Badge from "./ui/Badge.jsx";
import Button from "./ui/Button.jsx";
import { Input } from "./ui/Field.jsx";
import ErrorState from "./ui/ErrorState.jsx";
import Spinner from "./ui/Spinner.jsx";

const COLORS = ["bg-brand-100 text-brand-800", "bg-emerald-100 text-emerald-800", "bg-amber-100 text-amber-800", "bg-sky-100 text-sky-800", "bg-rose-100 text-rose-800"];

/** Monthly calendar of APPROVED leave (data from GET /calendar/leaves; no reasons or documents). */
export default function LeaveCalendar() {
  const { role } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [department, setDepartment] = useState("");
  const [selected, setSelected] = useState(null);
  const privileged = role === "hr" || role === "admin";
  const debouncedDepartment = useDebounce(department.trim());
  const { data, isLoading, isFetching, error, refetch } = useGetCalendarQuery({ month, year, department: privileged ? debouncedDepartment : "" });

  const shift = (delta) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setSelected(null);
  };

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const days = new Date(year, month, 0).getDate();
    const out = Array.from({ length: first.getDay() }, () => null);
    for (let d = 1; d <= days; d += 1) out.push(toIsoDate(new Date(year, month - 1, d)));
    return out;
  }, [year, month]);

  const eventsOn = (iso) => (data?.events || []).filter((e) => e.startDate <= iso && e.endDate >= iso);
  const colorFor = (id) => COLORS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length];
  const todayIso = toIsoDate(new Date());
  const selectedEvents = selected ? eventsOn(selected) : [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="min-w-40 text-center text-base font-semibold">{MONTH_NAMES[month - 1]} {year}</h2>
          <Button variant="secondary" size="sm" onClick={() => shift(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }}>Today</Button>
        {privileged && <div className="w-48"><Input label="Department" placeholder="All departments" value={department} onChange={(e) => setDepartment(e.target.value)} /></div>}
        {!privileged && <p className="text-xs text-slate-500">Showing approved leave in your department.</p>}
      </div>

      {isLoading ? <Spinner /> : error ? <ErrorState error={error} onRetry={refetch} /> : (
        <div className={isFetching ? "opacity-70" : ""}>
          <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 bg-white text-xs">
            {WEEKDAYS.map((w) => <div key={w} className="border-b border-slate-200 bg-slate-50 px-2 py-2 text-center font-semibold text-slate-500">{w}</div>)}
            {cells.map((iso, i) => {
              const evts = iso ? eventsOn(iso) : [];
              return (
                <button key={iso || `blank-${i}`} type="button" disabled={!iso} onClick={() => iso && setSelected(iso)}
                  className={`min-h-20 border-b border-r border-slate-100 p-1.5 text-left align-top sm:min-h-24 ${iso ? "hover:bg-brand-50/40" : "bg-slate-50/50"} ${iso === selected ? "ring-2 ring-inset ring-brand-400" : ""}`}>
                  {iso && (
                    <>
                      <span className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${iso === todayIso ? "bg-brand-600 font-semibold text-white" : "text-slate-500"}`}>{Number(iso.slice(8))}</span>
                      <div className="space-y-0.5">
                        {evts.slice(0, 2).map((e) => <div key={e.id} className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ${colorFor(e.employee.id)}`}>{e.employee.name}</div>)}
                        {evts.length > 2 && <div className="text-[10px] text-slate-400">+{evts.length - 2} more</div>}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          {data?.events?.length === 0 && <p className="mt-3 text-sm text-slate-500">No approved leave in this month.</p>}
          {selected && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold">{formatDate(selected)}</h3>
              {selectedEvents.length === 0 ? <p className="text-sm text-slate-500">Nobody is on approved leave.</p> : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {selectedEvents.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="font-medium">{e.employee.name} <span className="font-normal text-slate-400">{e.employee.department}</span></span>
                      <span className="flex items-center gap-2 text-slate-600">
                        {e.leaveType && <Badge status="info">{e.leaveType.name}</Badge>}
                        {formatDate(e.startDate)} - {formatDate(e.endDate)} ({e.days}d)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
