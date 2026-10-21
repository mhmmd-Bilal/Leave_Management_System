import {
  BarChart3, Bell, Building2, CalendarDays, ClipboardList, FileText, Layers, LayoutDashboard, LogOut, Menu, Send, Settings, ShieldCheck, User, UserCheck, Users, Wallet, X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import NotificationBell from "../components/NotificationBell.jsx";
import { useLogoutMutation } from "../features/auth/authApi.js";
import { useAuth } from "../hooks/useAuth.js";

const COMMON = {
  heading: "Account",
  items: [
    { to: "/calendar", label: "Calendar", icon: CalendarDays },
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/profile", label: "Profile", icon: User },
  ],
};
const HR_TOOLS = {
  heading: "Human resources",
  items: [
    { to: "/hr/registrations", label: "Registrations", icon: UserCheck },
    { to: "/hr/leaves", label: "Leave requests", icon: ClipboardList },
    { to: "/hr/balances", label: "Leave balances", icon: Wallet },
    { to: "/hr/reports", label: "Reports", icon: BarChart3 },
  ],
};
const NAV = {
  employee: [
    { heading: "Workspace", items: [
      { to: "/employee", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/employee/apply", label: "Apply for leave", icon: Send },
      { to: "/employee/leaves", label: "My leaves", icon: FileText },
      { to: "/employee/balances", label: "Leave balances", icon: Wallet },
    ] },
    COMMON,
  ],
  hr: [
    { heading: "Overview", items: [{ to: "/hr", label: "Dashboard", icon: LayoutDashboard, end: true }] },
    HR_TOOLS,
    COMMON,
  ],
  admin: [
    { heading: "Overview", items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true }] },
    { heading: "Administration", items: [
      { to: "/admin/employees", label: "Employees", icon: Users },
      { to: "/admin/hr", label: "HR staff", icon: Building2 },
      { to: "/admin/leave-types", label: "Leave types", icon: Layers },
      { to: "/admin/allocations", label: "Allocations", icon: Wallet },
      { to: "/admin/settings", label: "System settings", icon: Settings },
      { to: "/admin/audit-logs", label: "Audit logs", icon: ShieldCheck },
    ] },
    HR_TOOLS,
    COMMON,
  ],
};

function NavItems({ groups, onNavigate }) {
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Main navigation">
      {groups.map((g) => (
        <div key={g.heading}>
          <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">{g.heading}</p>
          <div className="space-y-0.5">
            {g.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} onClick={onNavigate}
                className={({ isActive }) => `flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors ${isActive ? "border-gold-400 bg-white/10 text-white" : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"}`}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> {label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

export default function AppLayout() {
  const { user, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [logout, { isLoading }] = useLogoutMutation();
  const navigate = useNavigate();
  const groups = NAV[role] || [];

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const brand = (
    <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-gold-400"><ClipboardList className="h-4 w-4" aria-hidden="true" /></span>
      <span className="font-serif text-lg font-semibold tracking-tight text-white">LeaveDesk</span>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-brand-900 lg:sticky lg:top-0 lg:flex lg:h-screen">
        {brand}
        <NavItems groups={groups} />
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white" aria-hidden="true">{initials(user?.name)}</span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <p className="truncate text-xs capitalize text-slate-400">{user?.role} - {user?.department}</p>
            </div>
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-brand-900 shadow-pop">
            <div className="flex items-center justify-between pr-3">{brand}<button type="button" className="rounded p-1 text-slate-300 hover:bg-white/10" aria-label="Close menu" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
            <NavItems groups={groups} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button type="button" className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <p className="hidden text-sm text-slate-500 lg:block">Leave Management System</p>
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-medium text-slate-800">{user?.name}</p>
              <p className="text-xs capitalize text-slate-500">{role}</p>
            </div>
            <button type="button" onClick={onLogout} disabled={isLoading} aria-label="Log out" title="Log out" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><LogOut className="h-5 w-5" /></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6"><Outlet /></main>
      </div>
    </div>
  );
}
