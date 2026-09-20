import { useCallback, useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import BayStatusCard, { BayBoardItem } from "../components/BayStatusCard";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export default function WashBaysPage() {
  const { has } = useAuth();
  const [items, setItems] = useState<BayBoardItem[]>([]);
  const [error, setError] = useState("");
  const canManage = has("queue.manage") || has("branches.manage");

  const load = useCallback(async () => {
    const data = await api<any>("/api/v1/wash-bays/board");
    setItems(data.items || []);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
    const t = setInterval(() => load().catch(() => undefined), 10000);
    return () => clearInterval(t);
  }, [load]);

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

  return (
    <div>
      <PageHeader
        title="Bay Board"
        subtitle="Live status for Bay 1 and Bay 2 — tap a status to override"
        actions={<button className="btn-secondary" onClick={() => load()}>Refresh</button>}
      />
      {error && <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40">{error}</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((bay) => (
          <BayStatusCard
            key={bay.id}
            bay={bay}
            onSetStatus={canManage ? (s) => setStatus(bay.id, s) : undefined}
          />
        ))}
      </div>
      {items.length === 0 && !error && (
        <div className="card p-8 text-center text-slate-500">Loading bay board…</div>
      )}
      <p className="mt-4 text-xs text-slate-500">
        Busy is set automatically when a wash is assigned to a bay. Managers can force Offline / Closed.
      </p>
    </div>
  );
}
