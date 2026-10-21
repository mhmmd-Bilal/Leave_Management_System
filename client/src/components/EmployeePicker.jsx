import { useEffect, useRef, useState } from "react";
import { useGetHrEmployeesQuery } from "../features/employees/employeesApi.js";
import { useDebounce } from "../hooks/useDebounce.js";
import { Input } from "./ui/Field.jsx";

/** Search-as-you-type picker over GET /hr/employees (real MongoDB search). */
export default function EmployeePicker({ label = "Employee", value, onChange, status = "active" }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const search = useDebounce(text.trim());
  // Only query while the list is actually visible
  const { data, isFetching } = useGetHrEmployeesQuery(
    { search, status, limit: 8, sortBy: "name", order: "asc" },
    { skip: Boolean(value) || !open }
  );

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (value) {
    return (
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
        <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <span>{value.name} <span className="text-slate-400">({value.employeeId})</span></span>
          <button
            type="button"
            className="text-xs text-brand-600 hover:underline"
            onClick={() => { onChange(null); setText(""); }}
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  const select = (employee) => {
    onChange(employee);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <Input
        label={label}
        placeholder="Search by name, email or employee ID"
        value={text}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-pop" role="listbox">
          {isFetching && <li className="px-3 py-2 text-xs text-slate-400">Searching...</li>}
          {!isFetching && data?.items?.length === 0 && <li className="px-3 py-2 text-xs text-slate-400">No employees found</li>}
          {data?.items?.map((e) => (
            <li key={e.id} role="option" aria-selected="false">
              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-50" onClick={() => select(e)}>
                {e.name} <span className="text-slate-400">- {e.employeeId} - {e.department}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}