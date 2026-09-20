import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PageHeader from "../components/ui/PageHeader";
import { api, formatMoney } from "../lib/api";
import type { Dashboard } from "../types";

function Kpi({ label, value, to }: { label: string; value: string | number; to?: string }) {
  const body = (
    <div className="kpi">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/api/v1/dashboard")
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load dashboard"));
  }, []);

  if (error) return <div className="card p-4 text-rose-600">{error}</div>;
  if (!data) return <div className="card p-6">Loading dashboard…</div>;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live operations overview for today" actions={<Link className="btn-primary" to="/bookings">New booking</Link>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        <Kpi label="Today's bookings" value={data.today_bookings} to="/bookings" />
        <Kpi label="Waiting" value={data.waiting} to="/queue" />
        <Kpi label="Washing" value={data.washing} to="/queue" />
        <Kpi label="Ready for collection" value={data.ready_for_collection} to="/queue" />
        <Kpi label="Completed" value={data.completed} />
        <Kpi label="Revenue today" value={formatMoney(data.revenue_today)} to="/payments" />
        <Kpi label="Cash today" value={formatMoney(data.cash_today)} />
        <Kpi label="Card today" value={formatMoney(data.card_today)} />
        <Kpi label="Outstanding" value={formatMoney(data.outstanding)} />
        <Kpi label="Vehicles washed" value={data.vehicles_washed} />
        <Kpi label="Customers" value={data.customers_total} to="/customers" />
        <Kpi label="Low stock" value={data.low_stock_count} to="/inventory" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h3 className="font-semibold mb-3">Revenue (7 days)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenue_by_day || []}>
                <XAxis dataKey="date" hide />
                <YAxis width={40} />
                <Tooltip />
                <Area type="monotone" dataKey="amount" stroke="#0ea5e9" fill="#bae6fd" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold mb-3">System</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Health</span><span className="badge bg-emerald-100 text-emerald-800">{data.system_health}</span></div>
            <div className="flex justify-between"><span>Staff working</span><span>{data.employees_working}</span></div>
            <div className="flex justify-between"><span>Avg wash (min)</span><span>{data.avg_wash_minutes ?? "—"}</span></div>
            <div className="flex justify-between"><span>Integrations</span><span>{data.integrations_ok}/{data.integrations_total}</span></div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Upcoming bookings</h3>
          <ul className="space-y-2 text-sm">
            {(data.upcoming_bookings || []).map((b: any) => (
              <li key={b.id} className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span>{b.customer} · {b.booking_number}</span>
                <span className="text-slate-500">{b.date} {b.time}</span>
              </li>
            ))}
            {(data.upcoming_bookings || []).length === 0 && <li className="text-slate-500">No upcoming bookings</li>}
          </ul>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Recent activity</h3>
          <ul className="space-y-2 text-sm">
            {(data.recent_activity || []).map((a: any) => (
              <li key={a.id} className="border-b border-slate-100 dark:border-slate-800 pb-2">
                <div>{a.summary}</div>
                <div className="text-xs text-slate-500">{a.created_at}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
