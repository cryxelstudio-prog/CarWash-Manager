import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarPlus, ListOrdered, Droplets } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import BayStatusCard, { BayBoardItem } from "../components/BayStatusCard";
import EmptyState from "../components/ui/EmptyState";
import { api, formatMoney } from "../lib/api";
import type { Dashboard } from "../types";

function Kpi({ label, value, hint, to }: { label: string; value: string | number; hint?: string; to?: string }) {
  const body = (
    <div className="kpi hover:border-sky-300/60 transition">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="mt-1.5 text-2xl md:text-3xl font-extrabold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/api/v1/dashboard")
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load dashboard"));
    const t = setInterval(() => {
      api<Dashboard>("/api/v1/dashboard").then(setData).catch(() => undefined);
    }, 20000);
    return () => clearInterval(t);
  }, []);

  if (error) return <div className="card p-4 text-rose-600">{error}</div>;
  if (!data) return <div className="card p-8 text-center text-slate-500">Loading dashboard…</div>;

  const bays = (data.bays || []) as BayBoardItem[];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Today’s ops at a glance"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="btn-primary" to="/quick-book"><CalendarPlus size={16} /> Quick Book</Link>
            <Link className="btn-secondary" to="/queue"><ListOrdered size={16} /> Queue</Link>
            <Link className="btn-secondary" to="/wash-bays"><Droplets size={16} /> Bays</Link>
          </div>
        }
      />

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4 mb-5">
        <Kpi label="Today’s bookings" value={data.today_bookings} to="/bookings" />
        <Kpi label="Queue" value={data.queue_length ?? data.waiting} hint="Waiting / booked" to="/queue" />
        <Kpi label="Washing now" value={data.washing} to="/queue" />
        <Kpi label="Revenue today" value={formatMoney(data.revenue_today)} to="/payments" />
      </div>

      <div className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Bay board</h2>
          <Link to="/wash-bays" className="text-sm font-medium text-sky-600">Open board →</Link>
        </div>
        {bays.length === 0 ? (
          <EmptyState title="No wash bays yet" hint="Bay 1 and Bay 2 are created automatically on setup." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {bays.slice(0, 2).map((bay) => (
              <BayStatusCard key={bay.id} bay={bay} compact />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-5">
        <div className="card p-4 lg:col-span-2">
          <h3 className="font-semibold mb-3">Revenue (7 days)</h3>
          <div className="h-52">
            {(data.revenue_by_day || []).every((d) => !d.amount) ? (
              <div className="h-full grid place-items-center text-sm text-slate-400">No payments recorded yet this week</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.revenue_by_day || []}>
                  <XAxis dataKey="date" hide />
                  <YAxis width={40} />
                  <Tooltip />
                  <Area type="monotone" dataKey="amount" stroke="#0284c7" fill="#bae6fd" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold mb-3">At a glance</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Ready</span><span className="font-semibold">{data.ready_for_collection}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Completed</span><span className="font-semibold">{data.completed}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Cash today</span><span className="font-semibold">{formatMoney(data.cash_today)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Card today</span><span className="font-semibold">{formatMoney(data.card_today)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Staff on floor</span><span className="font-semibold">{data.employees_working}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Low stock</span><span className="font-semibold">{data.low_stock_count}</span></div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Upcoming</h3>
          {(data.upcoming_bookings || []).length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No upcoming bookings — <Link className="text-sky-600 font-medium" to="/quick-book">book one</Link></p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(data.upcoming_bookings || []).map((b: any) => (
                <li key={b.id} className="flex justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="truncate font-medium">{b.customer} · {b.booking_number}</span>
                  <span className="text-slate-500 whitespace-nowrap">{b.date} {b.time}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Recent activity</h3>
          {(data.recent_activity || []).length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Activity will show here as you operate</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(data.recent_activity || []).map((a: any) => (
                <li key={a.id} className="border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div>{a.summary}</div>
                  <div className="text-xs text-slate-500">{a.created_at}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
