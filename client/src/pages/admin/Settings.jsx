import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { Checkbox, Input, Select } from "../../components/ui/Field.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { useGetSettingsQuery, useUpdateSettingsMutation } from "../../features/admin/adminApi.js";
import { useToast } from "../../hooks/useToast.js";
import { MONTH_NAMES, WEEKDAYS, formatDate } from "../../utils/format.js";

export default function Settings() {
  const toast = useToast();
  const { data, isLoading, error, refetch } = useGetSettingsQuery();
  const [save, { isLoading: saving }] = useUpdateSettingsMutation();
  const [workingDays, setWorkingDays] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [startMonth, setStartMonth] = useState(1);
  const [timezone, setTimezone] = useState("");
  const [maxAdvance, setMaxAdvance] = useState(365);
  const [newHoliday, setNewHoliday] = useState({ date: "", name: "" });

  useEffect(() => {
    if (!data) return;
    setWorkingDays(data.workingDays);
    setHolidays(data.holidays);
    setStartMonth(data.leaveYearStartMonth);
    setTimezone(data.timezone);
    setMaxAdvance(data.policies.maxAdvanceDays);
  }, [data]);

  const toggleDay = (d) => setWorkingDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d].sort()));
  const addHoliday = () => {
    if (!newHoliday.date || !newHoliday.name.trim()) return toast.error("Enter a date and a name for the holiday");
    if (holidays.some((h) => h.date === newHoliday.date)) return toast.error("That date is already a holiday");
    setHolidays([...holidays, { date: newHoliday.date, name: newHoliday.name.trim() }].sort((a, b) => a.date.localeCompare(b.date)));
    return setNewHoliday({ date: "", name: "" });
  };

  const submit = async () => {
    try {
      await save({ workingDays, holidays, leaveYearStartMonth: Number(startMonth), timezone, policies: { maxAdvanceDays: Number(maxAdvance) } }).unwrap();
      toast.success("Settings saved. Existing approved leave is not changed.");
    } catch (e) { toast.fromError(e); }
  };

  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <>
      <PageHeader title="System settings" subtitle="Changes affect new leave calculations only - approved leave is never recalculated." actions={<Button loading={saving} onClick={submit}>Save settings</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Working days & weekends">
          <fieldset>
            <legend className="mb-2 text-sm text-slate-500">Checked days are working days; unchecked days are weekends.</legend>
            <div className="flex flex-wrap gap-4">{WEEKDAYS.map((w, i) => <Checkbox key={w} label={w} checked={workingDays.includes(i)} onChange={() => toggleDay(i)} />)}</div>
          </fieldset>
          <p className="mt-3 text-xs text-slate-500">Whether weekends or holidays count as leave is configured per leave type.</p>
        </Card>
        <Card title="Leave year & policies">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Leave year starts in" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} hint="Locked by the server once balances exist">
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
            <Input label="Time zone (IANA)" value={timezone} onChange={(e) => setTimezone(e.target.value)} hint="e.g. Asia/Kolkata - decides what 'today' is" />
            <Input label="Max booking horizon (days)" type="number" min="0" value={maxAdvance} onChange={(e) => setMaxAdvance(e.target.value)} hint="How far ahead leave can be applied" />
          </div>
        </Card>
        <Card title="Holidays" className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="w-44"><Input label="Date" type="date" value={newHoliday.date} onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })} /></div>
            <div className="min-w-48 flex-1"><Input label="Name" value={newHoliday.name} onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })} /></div>
            <Button variant="secondary" icon={Plus} onClick={addHoliday}>Add holiday</Button>
          </div>
          {holidays.length === 0 ? <p className="text-sm text-slate-500">No holidays configured.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {holidays.map((h) => (
                <li key={h.date} className="flex items-center justify-between py-2"><span>{formatDate(h.date)} - {h.name}</span>
                  <Button variant="ghost" size="sm" aria-label={`Remove ${h.name}`} icon={Trash2} onClick={() => setHolidays(holidays.filter((x) => x.date !== h.date))} /></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
