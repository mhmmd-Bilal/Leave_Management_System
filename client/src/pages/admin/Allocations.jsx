import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import { Alert } from "../../components/ui/ErrorState.jsx";
import { Checkbox, Input } from "../../components/ui/Field.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { useInitializeBalancesMutation } from "../../features/balances/balancesApi.js";
import { useGetSettingsQuery, useUpdateSettingsMutation } from "../../features/admin/adminApi.js";
import { useGetLeaveTypesQuery, useUpdateLeaveTypeMutation } from "../../features/leaves/leavesApi.js";
import { useToast } from "../../hooks/useToast.js";
import { getErrorMessage } from "../../utils/errors.js";

export default function Allocations() {
  const toast = useToast();
  const types = useGetLeaveTypesQuery({ includeInactive: true });
  const settings = useGetSettingsQuery();
  const [updateType] = useUpdateLeaveTypeMutation();
  const [updateSettings, savingOverrides] = useUpdateSettingsMutation();
  const [initialize, init] = useInitializeBalancesMutation();
  const [limits, setLimits] = useState({});
  const [overrides, setOverrides] = useState([]);
  const [year, setYear] = useState("");
  const [selected, setSelected] = useState([]);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [result, setResult] = useState(null);

  // Default to the current leave year (depends on the configured start month), not the calendar year.
  const leaveYear = settings.data ? (new Date().getMonth() + 1 >= settings.data.leaveYearStartMonth ? new Date().getFullYear() : new Date().getFullYear() - 1) : "";
  useEffect(() => { if (settings.data) setOverrides(settings.data.allocationDefaults.map((o) => ({ ...o }))); }, [settings.data]);

  const saveLimit = async (t) => {
    try {
      await updateType({ id: t.id, yearlyLimit: Number(limits[t.id]) }).unwrap();
      toast.success(`${t.name}: yearly limit updated for new balances`);
      setLimits((l) => { const n = { ...l }; delete n[t.id]; return n; });
    } catch (e) { toast.fromError(e); }
  };
  const saveOverrides = async () => {
    try {
      await updateSettings({ allocationDefaults: overrides.filter((o) => o.leaveTypeCode).map((o) => ({ leaveTypeCode: o.leaveTypeCode.toUpperCase(), days: Number(o.days) })) }).unwrap();
      toast.success("Allocation overrides saved");
    } catch (e) { toast.fromError(e); }
  };
  const run = async () => {
    setResult(null);
    try {
      const r = await initialize({ year: Number(year || leaveYear), leaveTypeIds: selected.length ? selected : undefined, updateExisting }).unwrap();
      setResult(r);
      toast.success("Annual balances initialized");
    } catch (e) { toast.fromError(e); }
  };
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      <PageHeader title="Annual allocations" subtitle="Yearly limits apply to balances created from now on. Initialization is idempotent and never changes days already used." />
      <div className="space-y-6">
        <Card title="Yearly limit per leave type" padded={false}>
          <DataTable rows={types.data} isLoading={types.isLoading} error={types.error} onRetry={types.refetch}
            columns={[
              { key: "name", header: "Leave type", render: (t) => <>{t.name} {!t.active && <Badge status="inactive">inactive</Badge>}</> },
              { key: "cur", header: "Current limit", render: (t) => t.yearlyLimit },
              { key: "new", header: "New limit", render: (t) => <div className="w-28"><Input aria-label={`New limit for ${t.name}`} type="number" min="0" step="0.5" value={limits[t.id] ?? ""} placeholder={String(t.yearlyLimit)} onChange={(e) => setLimits({ ...limits, [t.id]: e.target.value })} /></div> },
              { key: "save", header: "", render: (t) => <Button size="sm" disabled={limits[t.id] === undefined || limits[t.id] === ""} onClick={() => saveLimit(t)}>Save</Button> },
            ]} />
        </Card>

        <Card title="Allocation overrides (by leave type code)" action={<Button size="sm" variant="secondary" icon={Plus} onClick={() => setOverrides([...overrides, { leaveTypeCode: "", days: 0 }])}>Add</Button>}>
          {settings.isLoading ? <Spinner /> : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">An override replaces the leave type's yearly limit when new balances are created.</p>
              {overrides.length === 0 && <p className="text-sm text-slate-500">No overrides.</p>}
              {overrides.map((o, i) => (
                <div key={i} className="flex items-end gap-3">
                  <div className="flex-1"><Input label="Leave type code" value={o.leaveTypeCode} onChange={(e) => setOverrides(overrides.map((x, j) => (j === i ? { ...x, leaveTypeCode: e.target.value.toUpperCase() } : x)))} /></div>
                  <div className="w-28"><Input label="Days" type="number" min="0" step="0.5" value={o.days} onChange={(e) => setOverrides(overrides.map((x, j) => (j === i ? { ...x, days: e.target.value } : x)))} /></div>
                  <Button variant="ghost" aria-label="Remove override" icon={Trash2} onClick={() => setOverrides(overrides.filter((_, j) => j !== i))} />
                </div>
              ))}
              <Button loading={savingOverrides.isLoading} onClick={saveOverrides}>Save overrides</Button>
            </div>
          )}
        </Card>

        <Card title="Initialize annual balances">
          <div className="space-y-4">
            <div className="max-w-xs"><Input label="Year" type="number" min="2000" max="2200" value={year || leaveYear} onChange={(e) => setYear(e.target.value)} /></div>
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-slate-700">Leave types <span className="font-normal text-slate-400">(none selected = all active)</span></legend>
              <div className="flex flex-wrap gap-4">{types.data?.filter((t) => t.active).map((t) => <Checkbox key={t.id} label={t.name} checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />)}</div>
            </fieldset>
            <Checkbox label="Also sync base allocation of existing balances to the current limits (keeps used days and manual adjustments)" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
            {init.error && <Alert>{getErrorMessage(init.error)}</Alert>}
            <Button loading={init.isLoading} onClick={run}>Initialize balances</Button>
            {result && (
              <Alert tone="success">Year {result.year}: {result.created} created, {result.existing} already existed, {result.updated} synced{result.skipped.length > 0 && `, ${result.skipped.length} skipped (would go negative)`}.</Alert>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
