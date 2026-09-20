import { FormEvent, useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import { api, ApiError, formatMoney } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export default function ServicesPage() {
  const { has } = useAuth();
  const canEdit = has("services.manage");
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ category: "WASH", duration_minutes: 30, base_price: 0, is_active: true, tax_rate: 15 });
  const [error, setError] = useState("");

  const load = async () => {
    const d = await api<any>("/api/v1/services");
    setItems(d.items || []);
  };

  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name: "", category: "WASH", duration_minutes: 30, base_price: 0, is_active: true, tax_rate: 15, description: "" });
    setOpen(true);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    setForm({ ...row });
    setOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const payload = {
        ...form,
        base_price: Number(form.base_price),
        duration_minutes: Number(form.duration_minutes || 30),
        tax_rate: Number(form.tax_rate || 15),
        is_active: !!form.is_active,
      };
      if (editing) await api(`/api/v1/services/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/api/v1/services", { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Save failed");
    }
  };

  const toggleActive = async (row: any) => {
    if (!canEdit) return;
    await api(`/api/v1/services/${row.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...row, is_active: !row.is_active }),
    });
    await load();
  };

  return (
    <div>
      <PageHeader
        title="Services"
        subtitle="Prices in ZAR — managers can edit; operators cannot"
        actions={canEdit ? <button className="btn-primary" onClick={openCreate}>Add service</button> : undefined}
      />
      {error && <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {items.length === 0 ? (
        <EmptyState title="No services yet" hint="Add Exterior, Interior, Full Wash, etc." action={canEdit ? <button className="btn-primary" onClick={openCreate}>Add service</button> : undefined} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((s) => (
            <div key={s.id} className={`card p-4 ${!s.is_active ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{s.code}</div>
                  <div className="text-lg font-bold">{s.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.category} · {s.duration_minutes} min</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold text-sky-600">{formatMoney(s.base_price)}</div>
                  <span className={`badge mt-1 ${s.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                    {s.is_active ? "Active" : "Off"}
                  </span>
                </div>
              </div>
              {canEdit && (
                <div className="mt-4 flex gap-2">
                  <button className="btn-secondary flex-1 !py-2" onClick={() => openEdit(s)}>Edit price</button>
                  <button className="btn-secondary !py-2" onClick={() => toggleActive(s)}>{s.is_active ? "Disable" : "Enable"}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} title={editing ? "Edit service" : "New service"} onClose={() => setOpen(false)}>
        <form className="space-y-3" onSubmit={save}>
          <div><label className="label">Code</label><input className="input" required value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div><label className="label">Name</label><input className="input" required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Base price (R)</label><input className="input" type="number" step="0.01" required value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} /></div>
            <div><label className="label">Duration (min)</label><input className="input" type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
          </div>
          <div><label className="label">Category</label><input className="input" value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active
          </label>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary">Save</button></div>
        </form>
      </Modal>
    </div>
  );
}
