import { CalendarCheck, ClipboardList, ShieldCheck } from "lucide-react";

const POINTS = [
  { icon: CalendarCheck, text: "Apply for leave in minutes and follow every decision." },
  { icon: ShieldCheck, text: "Balances change only after HR approval - fully audited." },
];

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-5">
      <aside className="hidden flex-col justify-between bg-brand-900 p-12 text-white lg:col-span-2 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-gold-400"><ClipboardList className="h-5 w-5" aria-hidden="true" /></span>
          <span className="font-serif text-xl font-semibold">LeaveDesk</span>
        </div>
        <div>
          <h2 className="font-serif text-3xl font-semibold leading-snug">Leave management,<br />handled with care.</h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-slate-300"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden="true" />{text}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500">Leave Management System</p>
      </aside>
      <div className="flex min-h-screen items-center justify-center px-4 py-10 lg:col-span-3 lg:min-h-0">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center lg:text-left">
            <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-brand-900 text-gold-400 lg:hidden"><ClipboardList className="h-5 w-5" aria-hidden="true" /></span>
            <h1 className="font-serif text-3xl font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-card">{children}</div>
          {footer && <p className="mt-4 text-center text-sm text-slate-500 lg:text-left">{footer}</p>}
        </div>
      </div>
    </div>
  );
}
