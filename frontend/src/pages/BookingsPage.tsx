import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import { api, ApiError, formatMoney, STAGE_LABELS } from "../lib/api";

export default function BookingsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<any>({ scheduled_date: today, source: "WALK_IN", duration_minutes: 30, discount_amount: 0 });

  const load = async () => {
    const [b, c, s, br] = await Promise.all([
      api<any>("/api/v1/bookings"),
      api<any>("/api/v1/customers"),
      api<any>("/api/v1/services"),
      api<any>("/api/v1/branches"),
    ]);
    setItems(b.items || []);
    setCustomers(c.items || []);
    setServices(s.items || []);
    setBranches(br.items || []);
  };

  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  useEffect(() => {
    if (!form.customer_id) return;
    api<any>(`/api/v1/vehicles?customer_id=${form.customer_id}`).then((d) => setVehicles(d.items || []));
  }, [form.customer_id]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api("/api/v1/bookings", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          customer_id: Number(form.customer_id),
          vehicle_id: Number(form.vehicle_id),
          branch_id: Number(form.branch_id),
          service_id: form.service_id ? Number(form.service_id) : null,
          duration_minutes: Number(form.duration_minutes || 30),
          discount_amount: Number(form.discount_amount || 0),
        }),
      });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed");
    }
  };

  const checkIn = async (id: number) => {
    await api(`/api/v1/bookings/${id}/check-in`, { method: "POST" });
    await load();
  };

  return (
    <div>
      <PageHeader title="Bookings" subtitle="Create and manage wash bookings" actions={<><Link className="btn-primary" to="/quick-book">Quick Book</Link><button className="btn-secondary" onClick={() => setOpen(true)}>Advanced</button></>} />
      {error && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <div className="card overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th>No.</th><th>Customer</th><th>Vehicle</th><th>Service</th><th>Date</th><th>Stage</th><th>Total</th><th>Payment</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id}>
                <td>{b.booking_number}</td>
                <td>{b.customer_name}</td>
                <td>{b.vehicle_registration}</td>
                <td>{b.service_name || b.package_name}</td>
                <td>{b.scheduled_date} {b.scheduled_time || ""}</td>
                <td><span className="badge bg-sky-100 text-sky-800">{STAGE_LABELS[b.wash_stage] || b.wash_stage}</span></td>
                <td>{formatMoney(b.total_amount)}</td>
                <td>{b.payment_status}</td>
                <td className="text-right whitespace-nowrap">
                  <button className="btn-secondary !py-1" onClick={() => checkIn(b.id)}>Check-in</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} title="New booking" onClose={() => setOpen(false)}>
        <form className="space-y-3" onSubmit={save}>
          <div>
            <label className="label">Customer</label>
            <select className="input" required value={form.customer_id || ""} onChange={(e) => setForm({ ...form, customer_id: e.target.value, vehicle_id: "" })}>
              <option value="">Select…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name || `${c.first_name} ${c.last_name}`}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Vehicle</label>
            <select className="input" required value={form.vehicle_id || ""} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
              <option value="">Select…</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registration} — {v.make} {v.model}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Branch</label>
            <select className="input" required value={form.branch_id || ""} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Service</label>
            <select className="input" value={form.service_id || ""} onChange={(e) => setForm({ ...form, service_id: e.target.value })}>
              <option value="">Select…</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({formatMoney(s.base_price)})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Date</label><input className="input" type="date" required value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} /></div>
            <div><label className="label">Time</label><input className="input" type="time" value={form.scheduled_time || ""} onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary">Create</button></div>
        </form>
      </Modal>
    </div>
  );
}
