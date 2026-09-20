import { FormEvent, useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { api, formatMoney } from "../lib/api";

export default function CashUpPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ cash_up_date: new Date().toISOString().slice(0,10), opening_float: 0, counted_cash: 0 });

  const load = async () => {
    const [b, c] = await Promise.all([api<any>("/api/v1/branches"), api<any>("/api/v1/cash-ups")]);
    setBranches(b.items || []);
    setItems(c.items || []);
    if (!form.branch_id && (b.items || [])[0]) setForm((f: any) => ({ ...f, branch_id: b.items[0].id }));
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await api("/api/v1/cash-ups", {
      method: "POST",
      body: JSON.stringify({
        branch_id: Number(form.branch_id),
        cash_up_date: form.cash_up_date,
        opening_float: Number(form.opening_float || 0),
        counted_cash: Number(form.counted_cash || 0),
        notes: form.notes || null,
      }),
    });
    await load();
  };

  return (
    <div>
      <PageHeader title="Cash-up" subtitle="Daily cash reconciliation with variance" />
      <form className="card p-4 grid md:grid-cols-2 gap-3 mb-4" onSubmit={submit}>
        <div>
          <label className="label">Branch</label>
          <select className="input" required value={form.branch_id || ""} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div><label className="label">Date</label><input className="input" type="date" required value={form.cash_up_date} onChange={(e) => setForm({ ...form, cash_up_date: e.target.value })} /></div>
        <div><label className="label">Opening float</label><input className="input" type="number" step="0.01" value={form.opening_float} onChange={(e) => setForm({ ...form, opening_float: e.target.value })} /></div>
        <div><label className="label">Counted cash</label><input className="input" type="number" step="0.01" value={form.counted_cash} onChange={(e) => setForm({ ...form, counted_cash: e.target.value })} /></div>
        <div className="md:col-span-2"><label className="label">Notes</label><textarea className="input" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="md:col-span-2"><button className="btn-primary">Close cash-up</button></div>
      </form>
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Card</th><th>EFT</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.cash_up_date}</td>
                <td>{formatMoney(c.expected_cash)}</td>
                <td>{formatMoney(c.counted_cash)}</td>
                <td className={Number(c.variance) === 0 ? "" : "text-rose-600"}>{formatMoney(c.variance)}</td>
                <td>{formatMoney(c.card_total)}</td>
                <td>{formatMoney(c.eft_total)}</td>
                <td>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
