import EmptyState from "./EmptyState.jsx";
import ErrorState from "./ErrorState.jsx";
import Pagination from "./Pagination.jsx";
import { TableSkeleton } from "./Skeleton.jsx";

/**
 * columns: [{ key, header, render?(row), className? }]
 * Handles loading (skeleton) / error / empty states and pagination in one place.
 */
export default function DataTable({ columns, rows, isLoading, isFetching, error, onRetry, pagination, onPage, emptyTitle, emptyMessage, rowKey = (r) => r.id }) {
  if (isLoading) return <TableSkeleton cols={Math.min(columns.length || 4, 6)} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (!rows?.length) return <EmptyState title={emptyTitle} message={emptyMessage} />;
  return (
    <div className={isFetching ? "opacity-70 transition-opacity" : ""} aria-busy={isFetching || undefined}>
      <div className="overflow-x-auto">
        <table className="num min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium uppercase tracking-wider text-slate-500">
              {columns.map((c) => <th key={c.key} scope="col" className={`whitespace-nowrap px-4 py-3 ${c.className || ""}`}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="transition-colors hover:bg-slate-50/70">
                {columns.map((c) => <td key={c.key} className={`px-4 py-3.5 align-middle text-slate-700 ${c.className || ""}`}>{c.render ? c.render(row) : row[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pagination} onPage={onPage} />
    </div>
  );
}
