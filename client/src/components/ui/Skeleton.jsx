export default function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Table-shaped placeholder shown while a list loads (keeps layout stable, no spinner flash). */
export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-slate-100">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 px-4 py-4">
          {Array.from({ length: cols }, (_c, c) => <Skeleton key={c} className={`h-4 ${c === 0 ? "w-1/4" : "flex-1"}`} />)}
        </div>
      ))}
    </div>
  );
}
