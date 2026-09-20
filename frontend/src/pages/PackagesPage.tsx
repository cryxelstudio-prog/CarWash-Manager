import { FormEvent, useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import { api, ApiError, formatMoney } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export default function PackagesPage() {
  const { has } = useAuth();
  const canEdit = has("services.manage");
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ duration_minutes: 60, price: 0, is_active: true, service_ids: [] });
  const [error, setError] = useState("");

  const load = async () => {
    const d = await api<any>("/api/v1/packages");
    setItems(d.items || []);
  };
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name: "", duration_minutes: 60, price: 0, is_active: true, service_ids: [], description: "" });
    setOpen(true);
  };
  const openEdit = (row: any) => { setEditing(row); setForm({ ...row, service_ids: row.service_ids || [] }); setOpen(true); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const payload = { ...form, price: Number(form.price), duration_minutes: Number(form.duration_minutes || 60), is_active: !!form.is_active, service_ids: form.service_ids || [] };
      if (editing) await api(`/api/v1/packages/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/api/v1/packages", { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Save failed");
    }
  };

  const toggleActive = async (row: any) => {
    if (!canEdit) return;
    await api(`/api/v1/packages/${row.id}`, { method: "PUT", body: JSON.stringify({ ...row, is_active: !row.is_active }) });
    await load();
  };

  return (
    <div>
      <PageHeader title="Packages" subtitle="Bundled pricing for managers" actions={canEdit ? <button className="btn-primary" onClick={openCreate}>Add package</button> : undefined} />
      {error && <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {items.length === 0 ? (
        <EmptyState title="No packages yet" hint="Create Premium / Deluxe bundles with clear ZAR prices." action={canEdit ? <button className="btn-primary" onClick={openCreate}>Add package</button> : undefined} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <div key={p.id} className={`card p-4 ${!p.is_active ? "opacity-60" : ""}`}>
              <div className="flex justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{p.code}</div>
                  <div className="text-lg font-bold">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.duration_minutes} min</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold text-sky-600">{formatMoney(p.price)}</div>
                  <span className={`badge mt-1 ${p.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>{p.is_active ? "Active" : "Off"}</span>
                </div>
              </div>
              {canEdit && (
                <div className="mt-4 flex gap-2">
                  <button className="btn-secondary flex-1 !py-2" onClick={() => openEdit(p)}>Edit price</button>
                  <button className="btn-secondary !py-2" onClick={() => toggleActive(p)}>{p.is_active ? "Disable" : "Enable"}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Modal open={open} title={editing ? "Edit package" : "New package"} onClose={() => setOpen(false)}>
        <form className="space-y-3" onSubmit={save}>
          <div><label className="label">Code</label><input className="input" required value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div><label className="label">Name</label><input className="input" required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Price (R)</label><input className="input" type="number" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <div><label className="label">Duration (min)</label><input className="input" type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
          </label>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary">Save</button></div>
        </form>
      </Modal>
    </div>
  );
}
