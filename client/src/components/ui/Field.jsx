import { forwardRef, useId } from "react";

const base =
  "block w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-800 shadow-card placeholder:text-slate-400 disabled:bg-slate-100";

function Wrapper({ label, error, hint, id, required, children }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-600" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

export const Input = forwardRef(function Input({ label, error, hint, className = "", required, ...props }, ref) {
  const id = useId();
  return (
    <Wrapper label={label} error={error} hint={hint} id={id} required={required}>
      <input id={id} ref={ref} aria-invalid={Boolean(error)} className={`${base} ${error ? "border-red-400" : "border-slate-300"} ${className}`} {...props} />
    </Wrapper>
  );
});

export const Select = forwardRef(function Select({ label, error, hint, children, className = "", required, ...props }, ref) {
  const id = useId();
  return (
    <Wrapper label={label} error={error} hint={hint} id={id} required={required}>
      <select id={id} ref={ref} aria-invalid={Boolean(error)} className={`${base} ${error ? "border-red-400" : "border-slate-300"} ${className}`} {...props}>
        {children}
      </select>
    </Wrapper>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, className = "", required, ...props }, ref) {
  const id = useId();
  return (
    <Wrapper label={label} error={error} hint={hint} id={id} required={required}>
      <textarea id={id} ref={ref} rows={3} aria-invalid={Boolean(error)} className={`${base} ${error ? "border-red-400" : "border-slate-300"} ${className}`} {...props} />
    </Wrapper>
  );
});

export const Checkbox = forwardRef(function Checkbox({ label, className = "", ...props }, ref) {
  const id = useId();
  return (
    <label htmlFor={id} className={`inline-flex items-center gap-2 text-sm text-slate-700 ${className}`}>
      <input id={id} ref={ref} type="checkbox" {...props} />
      {label}
    </label>
  );
});
