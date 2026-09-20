import { useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { api, formatMoney } from "../lib/api";

export default function ReportsPage() {
  const [sales, setSales] = useState<any>(null);
  const [ops, setOps] = useState<any>(null);
  const [expenses, setExpenses] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      api<any>("/api/v1/reports/sales"),
      api<any>("/api/v1/reports/operations"),
      api<any>("/api/v1/reports/expenses"),
    ]).then(([s, o, e]) => { setSales(s); setOps(o); setExpenses(e); });
  }, []);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Sales, operations and expenses" actions={
        <>
          <a className="btn-secondary" href="/api/v1/reports/export.csv?report=sales">Export sales CSV</a>
          <a className="btn-secondary" href="/api/v1/reports/export.xlsx?report=sales">Export sales Excel</a>
        </>
      } />
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <div className="kpi"><div className="text-xs text-slate-500">Sales total</div><div className="text-2xl font-bold">{formatMoney(sales?.total || 0)}</div><div className="text-xs">{sales?.count || 0} payments</div></div>
        <div className="kpi"><div className="text-xs text-slate-500">Bookings</div><div className="text-2xl font-bold">{ops?.total_bookings || 0}</div><div className="text-xs">{ops?.completed || 0} completed</div></div>
        <div className="kpi"><div className="text-xs text-slate-500">Expenses</div><div className="text-2xl font-bold">{formatMoney(expenses?.total || 0)}</div></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Sales by method</h3>
          <ul className="text-sm space-y-1">
            {Object.entries(sales?.by_method || {}).map(([k, v]: any) => (
              <li key={k} className="flex justify-between"><span>{k}</span><span>{formatMoney(v)}</span></li>
            ))}
          </ul>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Operations by stage</h3>
          <ul className="text-sm space-y-1">
            {Object.entries(ops?.by_stage || {}).map(([k, v]: any) => (
              <li key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
