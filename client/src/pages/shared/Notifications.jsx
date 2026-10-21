import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { Select } from "../../components/ui/Field.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import {
  useGetNotificationsQuery, useMarkAllNotificationsReadMutation, useMarkNotificationReadMutation,
} from "../../features/notifications/notificationsApi.js";
import { useToast } from "../../hooks/useToast.js";
import { formatDateTime } from "../../utils/format.js";

export default function NotificationsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [isRead, setIsRead] = useState("");
  const { data, isLoading, error, refetch } = useGetNotificationsQuery({ page, limit: 10, isRead });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();

  const onMarkAll = async () => {
    try {
      await markAll().unwrap();
      toast.success("All notifications marked as read");
    } catch (e) {
      toast.fromError(e);
    }
  };

  return (
    <>
      <PageHeader title="Notifications" actions={<Button variant="secondary" icon={CheckCheck} loading={markingAll} onClick={onMarkAll}>Mark all as read</Button>} />
      <Card padded={false}>
        <div className="border-b border-slate-100 p-4 sm:w-56">
          <Select label="Show" value={isRead} onChange={(e) => { setIsRead(e.target.value); setPage(1); }}>
            <option value="">All</option><option value="false">Unread</option><option value="true">Read</option>
          </Select>
        </div>
        {isLoading ? <Spinner /> : error ? <ErrorState error={error} onRetry={refetch} /> : data.items.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" message="Updates about your leave and account will appear here." />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {data.items.map((n) => (
                <li key={n.id} className={`flex items-start justify-between gap-3 px-5 py-4 ${n.isRead ? "" : "bg-brand-50/40"}`}>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{!n.isRead && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-600" aria-label="unread" />}{n.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && <Button variant="ghost" size="sm" onClick={() => markRead(n.id)}>Mark read</Button>}
                </li>
              ))}
            </ul>
            <Pagination pagination={data.pagination} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
