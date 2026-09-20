import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarPlus, ListOrdered, Droplets } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import BayStatusCard, { BayBoardItem } from "../components/BayStatusCard";
import EmptyState from "../components/ui/EmptyState";
import { api, formatMoney } from "../lib/api";
import type { Dashboard } from "../types";
import { useEasyMode } from "../hooks/useEasyMode";

function Kpi({ label, value, hint, to }: { label: string; value: string | number; hint?: string; to?: string }) {
  const body = (
    <div className="kpi hover:border-sky-300/60 transition">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="mt-1.5 text-2xl md:text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

export default function DashboardPage() {
  const { easyMode } = useEasyMode();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () =>
      api<Dashboard>("/api/v1/dashboard")
        .then(setData)
        .catch((e) => setError(e.message || "Failed to load dashboard"));
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, []);

  if (error) return <div className="card p-4 text-rose-600">{error}</div>;
  if (!data) return <div className="card p-10 text-center text-slate-400">Loading dashboard…</div>;

  const bays = ((data.bays || []) as BayBoardItem[]).filter((b: any) => b.is_active !== false);
  const liveBays = bays.length ? bays : (data.bays || []) as BayBoardItem[];

  return (
    <div className="space-y-5">
      <PageHeader
        title={easyMode ? "Home" : "Dashboard"}
        subtitle={easyMode ? "Live bays · today at a glance" : "Live bay board · today’s ops"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="btn-primary" to="/quick-book"><CalendarPlus size={16} /> {easyMode ? "Book a wash" : "Quick Book"}</Link>
            <Link className="btn-secondary" to="/queue"><ListOrdered size={16} /> Queue</Link>
            <Link className="btn-secondary" to="/wash-bays"><Droplets size={16} /> Bays</Link>
          </div>
        }
      />

      {/* LIVE BAYS — front and centre */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg md:text-xl font-extrabold tracking-tight">Live bays</h2>
            <p className="text-xs text-slate-500">Updates every few seconds · green free · amber busy · blue ready</p>
          </div>
          <Link to="/wash-bays" className="text-sm font-semibold text-sky-600 shrink-0">Full board →</Link>
        </div>
        {liveBays.length === 0 ? (
          <EmptyState title="No wash bays yet" hint="Bay 1 and Bay 2 are created automatically on setup." />
        ) : (
          <div className={`grid gap-4 ${liveBays.length === 1 ? "md:grid-cols-1 max-w-xl" : "md:grid-cols-2"}`}>
            {liveBays.slice(0, 4).map((bay) => (
              <BayStatusCard key={bay.id} bay={bay} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi label="Today’s bookings" value={data.today_bookings} to="/bookings" />
        <Kpi label="Queue" value={data.queue_length ?? data.waiting} hint="Waiting / booked" to="/queue" />
        <Kpi label="Washing now" value={data.washing} to="/queue" />
        <Kpi label="Revenue today" value={formatMoney(data.revenue_today)} to="/payments" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold mb-3 text-slate-700 dark:text-slate-200">Revenue (7 days)</h3>
          <div className="h-48">
            {(data.revenue_by_day || []).every((d) => !d.amount) ? (
              <div className="h-full grid place-items-center text-sm text-slate-400">No payments recorded yet this week</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.revenue_by_day || []}>
                  <XAxis dataKey="date" hide />
                  <YAxis width={40} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="amount" stroke="#0284c7" fill="#e0f2fe" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3 text-slate-700 dark:text-slate-200">At a glance</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Ready</span><span className="font-semibold tabular-nums">{data.ready_for_collection}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Completed</span><span className="font-semibold tabular-nums">{data.completed}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Cash today</span><span className="font-semibold tabular-nums">{formatMoney(data.cash_today)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Staff on floor</span><span className="font-semibold tabular-nums">{data.employees_working}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Low stock</span><span className="font-semibold tabular-nums">{data.low_stock_count}</span></div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Upcoming</h3>
          {(data.upcoming_bookings || []).length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No upcoming bookings — <Link className="text-sky-600 font-medium" to="/quick-book">book one</Link></p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(data.upcoming_bookings || []).slice(0, 6).map((b: any) => (
                <li key={b.id} className="flex justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0">
                  <span className="truncate font-medium">{b.customer} · {b.ticket_number || b.booking_number}</span>
                  <span className="text-slate-500 whitespace-nowrap tabular-nums">{b.date} {b.time}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Recent activity</h3>
          {(data.recent_activity || []).length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">Quiet so far today</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(data.recent_activity || []).slice(0, 6).map((a: any) => (
                <li key={a.id} className="border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0">
                  <div className="font-medium truncate">{a.summary}</div>
                  <div className="text-xs text-slate-400">{a.actor_name}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
