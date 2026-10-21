import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useGetUnreadCountQuery } from "../features/notifications/notificationsApi.js";

// Near-real-time: the unread count is polled every 30 s while the tab is visible, and refetched
// immediately when the tab regains focus or the connection returns (no websockets involved).
export default function NotificationBell() {
  const { data: unread = 0 } = useGetUnreadCountQuery(undefined, { pollingInterval: 30000, skipPollingIfUnfocused: true });
  return (
    <Link to="/notifications" className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label={`Notifications, ${unread} unread`}>
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="num absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
