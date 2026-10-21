import { useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import { Select } from "../../components/ui/Field.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import { useGetMyBalancesQuery } from "../../features/balances/balancesApi.js";

export default function Balances() {
  const [year, setYear] = useState("");
  const { data, isLoading, isFetching, error, refetch } = useGetMyBalancesQuery({ year });
  return (
    <>
      <PageHeader title="Leave balances" subtitle="available = allocated - used. Leave is deducted only when a request is approved."
        actions={data?.availableYears?.length > 0 && (
          <div className="w-32"><Select label="Year" value={year || data.year} onChange={(e) => setYear(e.target.value)}>
            {[...new Set([data.year, ...data.availableYears])].sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
          </Select></div>
        )} />
      {data && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.balances.map((b) => (
            <Card key={b.id} title={b.leaveType.name}>
              <p className="text-3xl font-semibold text-slate-900">{b.available}<span className="ml-1 text-base font-normal text-slate-500">available</span></p>
              <div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${b.allocated ? Math.max(0, Math.min(100, (b.available / b.allocated) * 100)) : 0}%` }} /></div>
              <p className="mt-2 text-xs text-slate-500">{b.used} used of {b.allocated} allocated</p>
            </Card>
          ))}
        </div>
      )}
      <Card title={`Breakdown ${data ? `- ${data.year}` : ""}`} padded={false}>
        <DataTable rows={data?.balances} isLoading={isLoading} isFetching={isFetching} error={error} onRetry={refetch}
          emptyTitle="No balance records for this year"
          columns={[
            { key: "type", header: "Leave type", render: (r) => r.leaveType.name },
            { key: "allocated", header: "Allocated" },
            { key: "adjustment", header: "Adjustments", render: (r) => (r.adjustment > 0 ? `+${r.adjustment}` : r.adjustment) },
            { key: "used", header: "Used" },
            { key: "available", header: "Available", render: (r) => <strong>{r.available}</strong> },
          ]} />
      </Card>
    </>
  );
}
