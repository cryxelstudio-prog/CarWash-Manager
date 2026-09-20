import { FormEvent, useCallback, useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import BayStatusCard, { BayBoardItem } from "../components/BayStatusCard";
import DoneCompleteModal from "../components/DoneCompleteModal";
import EmptyState from "../components/ui/EmptyState";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useEasyMode } from "../hooks/useEasyMode";
import { GripVertical, Plus, Pencil, Trash2 } from "lucide-react";

export default function WashBaysPage() {
  const { has } = useAuth();
  const { easyMode } = useEasyMode();
  const [doneTarget, setDoneTarget] = useState<{ id: number; ticket?: string | null; vehicle?: string | null } | null>(null);
  const [toast, setToast] = useState("");
  const [items, setItems] = useState<BayBoardItem[]>([]);
  const [manage, setManage] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [showManage, setShowManage] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const canManage = has("queue.manage") || has("branches.manage");
  const canConfig = has("branches.manage");

  const load = useCallback(async () => {
    const data = await api<any>("/api/v1/wash-bays/board");
    setItems(data.items || []);
  }, []);

  const loadManage = useCallback(async () => {
    const [bays, br] = await Promise.all([
      api<any>("/api/v1/wash-bays"),
      api<any>("/api/v1/branches"),
    ]);
    setManage(bays.items || []);
    setBranches(br.items || []);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
    const t = setInterval(() => load().catch(() => undefined), 10000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (showManage && canConfig) loadManage().catch((e) => setError(e.message));
  }, [showManage, canConfig, loadManage]);

  const setStatus = async (bayId: number, status: string) => {
    try {
      await api(`/api/v1/wash-bays/${bayId}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Failed to update status");
    }
  };

  const saveBay = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setError("");
    setMsg("");
    try {
      const payload = {
        branch_id: Number(edit.branch_id),
        name: edit.name,
        bay_number: Number(edit.bay_number) || 0,
        bay_type: edit.bay_type || "STANDARD",
        status: edit.status || "AVAILABLE",
        is_active: !!edit.is_active,
        notes: edit.notes || null,
      };
      if (edit.id) {
        await api(`/api/v1/wash-bays/${edit.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api(`/api/v1/wash-bays`, { method: "POST", body: JSON.stringify(payload) });
      }
      setEdit(null);
      setMsg("Bay saved");
      await loadManage();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Save failed");
    }
  };

  const removeBay = async (id: number) => {
    if (!confirm("Remove this bay? Existing bookings keep their history.")) return;
    try {
      await api(`/api/v1/wash-bays/${id}`, { method: "DELETE" });
      await loadManage();
      await load();
      setMsg("Bay removed");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Delete failed");
    }
  };

  const move = async (id: number, dir: -1 | 1) => {
    const sorted = [...manage].sort((a, b) => a.bay_number - b.bay_number);
    const idx = sorted.findIndex((b) => b.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swap];
    try {
      await api("/api/v1/wash-bays/reorder", {
        method: "POST",
        body: JSON.stringify({
          items: [
            { id: a.id, bay_number: b.bay_number },
            { id: b.id, bay_number: a.bay_number },
          ],
        }),
      });
      await loadManage();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Reorder failed");
    }
  };

  return (
    <div>
      <PageHeader
        title={easyMode ? "Bays" : "Bay Board"}
        subtitle={easyMode ? "Green = free · Orange = busy · Blue = ready" : "Live status — colours show free / busy / ready"}
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => load()}>Refresh</button>
            {canConfig && (
              <button className="btn-primary" onClick={() => { setShowManage((v) => !v); setMsg(""); }}>
                {showManage ? "Hide setup" : "Customise bays"}
              </button>
            )}
          </div>
        }
      />
      {error && <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40">{error}</div>}
      {msg && <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}
      {toast && <div className="mb-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 font-medium">{toast}</div>}

      {showManage && canConfig && (
        <div className="card p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold">Wash bay setup</h3>
            <button
              className="btn-secondary !min-h-[36px]"
              onClick={() =>
                setEdit({
                  id: null,
                  branch_id: branches[0]?.id || "",
                  name: `Bay ${(manage.length || 0) + 1}`,
                  bay_number: (manage.reduce((m, b) => Math.max(m, b.bay_number || 0), 0) || 0) + 1,
                  bay_type: "STANDARD",
                  status: "AVAILABLE",
                  is_active: true,
                })
              }
            >
              <Plus size={16} /> Add bay
            </button>
          </div>
          <p className="text-xs text-slate-500">New installs start with Bay 1 &amp; Bay 2. Add, rename, reorder or disable freely.</p>
          <div className="overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th></th>
                  <th>#</th>
                  <th>Name</th>
                  <th>Branch</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...manage].sort((a, b) => a.bay_number - b.bay_number).map((b) => (
                  <tr key={b.id} className={!b.is_active ? "opacity-50" : ""}>
                    <td className="w-16">
                      <div className="flex gap-1">
                        <button type="button" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => move(b.id, -1)} title="Move up">
                          <GripVertical size={14} />↑
                        </button>
                        <button type="button" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => move(b.id, 1)} title="Move down">
                          ↓
                        </button>
                      </div>
                    </td>
                    <td>{b.bay_number}</td>
                    <td className="font-medium">{b.name}</td>
                    <td>{branches.find((x) => x.id === b.branch_id)?.name || b.branch_id}</td>
                    <td>{b.is_active ? "Yes" : "No"}</td>
                    <td className="text-right space-x-1">
                      <button className="btn-secondary !min-h-[32px] !px-2" onClick={() => setEdit({ ...b })}><Pencil size={14} /></button>
                      <button className="btn-danger !min-h-[32px] !px-2" onClick={() => removeBay(b.id)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {edit && (
            <form className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 grid md:grid-cols-2 gap-3" onSubmit={saveBay}>
              <div className="md:col-span-2 font-semibold">{edit.id ? "Edit bay" : "New bay"}</div>
              <div>
                <label className="label">Name</label>
                <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Number / order</label>
                <input className="input" type="number" value={edit.bay_number} onChange={(e) => setEdit({ ...edit, bay_number: e.target.value })} />
              </div>
              <div>
                <label className="label">Branch</label>
                <select className="input" value={edit.branch_id} onChange={(e) => setEdit({ ...edit, branch_id: e.target.value })} required>
                  {branches.map((br) => (
                    <option key={br.id} value={br.id}>{br.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Type</label>
                <input className="input" value={edit.bay_type || "STANDARD"} onChange={(e) => setEdit({ ...edit, bay_type: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" checked={!!edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />
                Active (shown on Bay Board &amp; Quick Book)
              </label>
              <div className="md:col-span-2 flex gap-2">
                <button className="btn-primary">Save</button>
                <button type="button" className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className={`grid gap-4 ${items.length > 2 ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2"}`}>
        {items.map((bay) => (
          <BayStatusCard
            key={bay.id}
            bay={bay}
            onSetStatus={canManage ? (s) => setStatus(bay.id, s) : undefined}
            onDone={(bookingId, ticket, vehicle) => setDoneTarget({ id: bookingId, ticket, vehicle })}
          />
        ))}
      </div>
      {items.length === 0 && !error && (
        <EmptyState
          title="No bays set up yet"
          hint={canConfig ? "Open Customise bays to add Bay 1, Bay 2, or more." : "Ask a manager to configure wash bays."}
        />
      )}
      <DoneCompleteModal
        open={!!doneTarget}
        ticket={doneTarget?.ticket}
        vehicle={doneTarget?.vehicle}
        onClose={() => setDoneTarget(null)}
        onConfirm={async (message) => {
          if (!doneTarget) return;
          const res = await api<any>(`/api/v1/bookings/${doneTarget.id}/stage`, {
            method: "POST",
            body: JSON.stringify({ to_stage: "READY", customer_message: message || null, notify_customer: true }),
          });
          setToast(res?.customer_notify?.message || "Saved — marked ready");
          setTimeout(() => setToast(""), 5000);
          await load();
        }}
      />
      <p className="mt-4 text-xs text-slate-500">
        Busy is set automatically when a wash is assigned to a bay. Managers can force Offline / Closed.
      </p>
    </div>
  );
}
