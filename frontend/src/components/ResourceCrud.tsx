import { FormEvent, useEffect, useState } from "react";
import PageHeader from "./ui/PageHeader";
import Modal from "./ui/Modal";
import EmptyState from "./ui/EmptyState";
import { api, ApiError } from "../lib/api";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "tel" | "date" | "time" | "select" | "textarea" | "checkbox";
  required?: boolean;
  options?: { value: string | number; label: string }[];
  placeholder?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  endpoint: string;
  fields: Field[];
  columns: { key: string; label: string; render?: (row: any) => any }[];
  idKey?: string;
  transformIn?: (form: any) => any;
  newDefaults?: Record<string, any>;
  canCreate?: boolean;
};

export default function ResourceCrud({
  title, subtitle, endpoint, fields, columns, idKey = "id",
  transformIn, newDefaults = {}, canCreate = true,
}: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({ ...newDefaults });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    const data = await api<any>(`${endpoint}${qs}`);
    setItems(data.items || data || []);
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const openCreate = () => { setEditing(null); setForm({ ...newDefaults }); setOpen(true); };
  const openEdit = (row: any) => {
    setEditing(row);
    const next: any = { ...newDefaults };
    fields.forEach((f) => { next[f.name] = row[f.name] ?? ""; });
    setForm(next);
    setOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const payload = transformIn ? transformIn(form) : form;
      if (editing) await api(`${endpoint}/${editing[idKey]}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Save failed");
    } finally { setBusy(false); }
  };

  const remove = async (row: any) => {
    if (!confirm("Archive / delete this record?")) return;
    await api(`${endpoint}/${row[idKey]}`, { method: "DELETE" });
    await load();
  };

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={
        <>
          <input className="input !w-52" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <button className="btn-secondary" onClick={() => load()}>Refresh</button>
          {canCreate && <button className="btn-primary" onClick={openCreate}>Add</button>}
        </>
      } />
      {error && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {items.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()} yet`} hint="Use Add to create the first record." />
      ) : (
        <div className="card overflow-auto">
          <table className="table">
            <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th></th></tr></thead>
            <tbody>
              {items.map((row) => (
                <tr key={row[idKey]}>
                  {columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : (row[c.key] ?? "—")}</td>)}
                  <td className="whitespace-nowrap text-right">
                    <button className="btn-secondary !py-1" onClick={() => openEdit(row)}>Edit</button>{" "}
                    <button className="btn-secondary !py-1" onClick={() => remove(row)}>Archive</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={open} title={editing ? `Edit ${title}` : `New ${title}`} onClose={() => setOpen(false)}>
        <form className="space-y-3" onSubmit={save}>
          {fields.map((f) => (
            <div key={f.name}>
              <label className="label">{f.label}</label>
              {f.type === "textarea" ? (
                <textarea className="input" required={f.required} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
              ) : f.type === "select" ? (
                <select className="input" required={f.required} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                  <option value="">Select…</option>
                  {(f.options || []).map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === "checkbox" ? (
                <input type="checkbox" checked={!!form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })} />
              ) : (
                <input className="input" type={f.type || "text"} required={f.required} placeholder={f.placeholder}
                  value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: f.type === "number" ? Number(e.target.value) : e.target.value })} />
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
