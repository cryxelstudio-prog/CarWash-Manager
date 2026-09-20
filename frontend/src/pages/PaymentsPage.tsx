import { FormEvent, useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import { api, ApiError, formatMoney } from "../lib/api";

export default function PaymentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ method: "CASH", amount: 0 });
  const [error, setError] = useState("");

  const load = async () => {
    const [p, b] = await Promise.all([api<any>("/api/v1/payments"), api<any>("/api/v1/bookings")]);
    setItems(p.items || []);
    setBookings((b.items || []).filter((x: any) => x.payment_status !== "PAID"));
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
        }),
      });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed");
    }
  };

  const receipt = (id: number) => {
    window.open(`/api/v1/payments/${id}/receipt.pdf`, "_blank");
  };

  return (
    <div>
      <PageHeader title="Payments" subtitle="Record cash, card and EFT payments" actions={<button className="btn-primary" onClick={() => setOpen(true)}>Record payment</button>} />
      {error && <div className="mb-3 text-sm text-rose-600">{error}</div>}
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>No.</th><th>Amount</th><th>Method</th><th>Status</th><th>Booking</th><th>Paid at</th><th></th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>{p.payment_number}</td>
                <td>{formatMoney(p.amount)}</td>
                <td>{p.method}</td>
                <td>{p.status}</td>
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
              setForm({ ...form, booking_id: e.target.value, amount: b ? b.total_amount : form.amount });
            }}>
              <option value="">Optional…</option>
              {bookings.map((b) => <option key={b.id} value={b.id}>{b.booking_number} — {b.customer_name} ({formatMoney(b.total_amount)})</option>)}
            </select>
          </div>
          <div><label className="label">Amount</label><input className="input" type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div>
            <label className="label">Method</label>
            <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {["CASH","CARD","EFT","ACCOUNT","VOUCHER","OTHER"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><label className="label">Reference</label><input className="input" value={form.reference || ""} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary">Save</button></div>
        </form>
      </Modal>
    </div>
  );
}
