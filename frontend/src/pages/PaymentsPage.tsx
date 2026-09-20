import { FormEvent, useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import { api, ApiError, formatMoney } from "../lib/api";

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = now;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export default function PaymentsPage() {
  const range = useMemo(() => monthRange(), []);
  const [items, setItems] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [salary, setSalary] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ method: "CASH", amount: 0 });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [payrollFrom, setPayrollFrom] = useState(range.from);
  const [payrollTo, setPayrollTo] = useState(range.to);
  const [includeExported, setIncludeExported] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  const load = async () => {
    const [p, b, s] = await Promise.all([
      api<any>("/api/v1/payments"),
      api<any>("/api/v1/bookings"),
      api<any>("/api/v1/payments/salary-ledger?pending_only=true"),
    ]);
    setItems(p.items || []);
    setBookings((b.items || []).filter((x: any) => x.payment_status !== "PAID"));
    setSalary(s.items || []);
    setSelected([]);
  };
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/v1/payments", {
        method: "POST",
        body: JSON.stringify({
          booking_id: form.booking_id ? Number(form.booking_id) : null,
          amount: Number(form.amount),
          method: form.method,
          reference: form.reference || null,
          notes: form.notes || null,
          employee_number: form.employee_number || null,
        }),
      });
      setOpen(false);
      setMsg("Payment recorded");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed");
    }
  };

  const receipt = (id: number) => {
    window.open(`/api/v1/payments/${id}/receipt.pdf`, "_blank");
  };

  const exportPayroll = (mark = false) => {
    const qs = new URLSearchParams({
      date_from: payrollFrom,
      date_to: payrollTo,
      include_exported: includeExported ? "true" : "false",
      mark_exported: mark ? "true" : "false",
    });
    window.open(`/api/v1/payments/payroll-export.csv?${qs.toString()}`, "_blank");
  };

  const markPaid = async () => {
    setError("");
    setMsg("");
    try {
      const body =
        selected.length > 0
          ? { payment_ids: selected }
          : { date_from: payrollFrom, date_to: payrollTo };
      const r = await api<any>("/api/v1/payments/salary/mark-paid", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMsg(`Marked ${r.updated} salary deduction(s) as paid / deducted`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Mark paid failed");
    }
  };

  const toggle = (id: number) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Cash, card, EFT, account, voucher — plus salary deduction ledger"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}>Record payment</button>}
      />
      {error && <div className="mb-3 text-sm text-rose-600">{error}</div>}
      {msg && <div className="mb-3 text-sm text-emerald-700">{msg}</div>}

      <div className="card p-4 mb-4 space-y-3">
        <h3 className="font-bold">Payroll export</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Export pending <strong>salary deduction</strong> rows for the date range (default: this month). Anyone can book with salary deduction if they enter an employee number.
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">From</label>
            <input className="input" type="date" value={payrollFrom} onChange={(e) => setPayrollFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input className="input" type="date" value={payrollTo} onChange={(e) => setPayrollTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
              <input type="checkbox" checked={includeExported} onChange={(e) => setIncludeExported(e.target.checked)} />
              Re-include already exported
            </label>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <button type="button" className="btn-secondary" onClick={() => exportPayroll(false)}>Download CSV</button>
            <button type="button" className="btn-secondary" onClick={() => exportPayroll(true)}>Download &amp; mark exported</button>
          </div>
        </div>
      </div>

      <div className="card p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">Salary deduction ledger (pending)</h3>
          <button type="button" className="btn-primary" onClick={markPaid} disabled={salary.length === 0}>
            {selected.length ? `Mark ${selected.length} selected paid` : "Mark batch deducted / paid"}
          </button>
        </div>
        {salary.length === 0 ? (
          <p className="text-sm text-slate-500">No pending salary deductions.</p>
        ) : (
          <div className="overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th></th>
                  <th>No.</th>
                  <th>Employee #</th>
                  <th>Amount</th>
                  <th>Booking</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {salary.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                    </td>
                    <td>{p.payment_number}</td>
                    <td>{p.employee_number || "—"}</td>
                    <td>{formatMoney(p.amount)}</td>
                    <td>{p.booking_id || "—"}</td>
                    <td>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>No.</th><th>Amount</th><th>Method</th><th>Status</th><th>Emp #</th><th>Booking</th><th>Paid at</th><th></th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>{p.payment_number}</td>
                <td>{formatMoney(p.amount)}</td>
                <td>{p.method}</td>
                <td>{p.status}</td>
                <td>{p.employee_number || "—"}</td>
                <td>{p.booking_id || "—"}</td>
                <td>{p.paid_at}</td>
                <td className="text-right"><button className="btn-secondary !py-1" onClick={() => receipt(p.id)}>Receipt PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={open} title="Record payment" onClose={() => setOpen(false)}>
        <form className="space-y-3" onSubmit={save}>
          <div>
            <label className="label">Booking</label>
            <select className="input" value={form.booking_id || ""} onChange={(e) => {
              const b = bookings.find((x) => String(x.id) === e.target.value);
              setForm({
                ...form,
                booking_id: e.target.value,
                amount: b ? b.total_amount : form.amount,
                employee_number: b?.employee_number || form.employee_number,
              });
            }}>
              <option value="">Optional…</option>
              {bookings.map((b) => <option key={b.id} value={b.id}>{b.booking_number} — {b.customer_name} ({formatMoney(b.total_amount)})</option>)}
            </select>
          </div>
          <div><label className="label">Amount</label><input className="input" type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div>
            <label className="label">Method</label>
            <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {["CASH","CARD","EFT","ACCOUNT","VOUCHER","SALARY_DEDUCTION","OTHER"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {form.method === "SALARY_DEDUCTION" && (
            <div>
              <label className="label">Employee number</label>
              <input className="input" required value={form.employee_number || ""} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} />
            </div>
          )}
          <div><label className="label">Reference</label><input className="input" value={form.reference || ""} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary">Save</button></div>
        </form>
      </Modal>
    </div>
  );
}
