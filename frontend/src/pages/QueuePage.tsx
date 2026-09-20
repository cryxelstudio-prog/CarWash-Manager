import { useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { api, STAGE_LABELS, WASH_STAGES, formatMoney } from "../lib/api";

export default function QueuePage() {
  const [stages, setStages] = useState<Record<string, any[]>>({});
  const [error, setError] = useState("");

  const load = async () => {
    const data = await api<any>("/api/v1/bookings/queue");
    setStages(data.stages || {});
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
    const t = setInterval(() => load().catch(() => undefined), 15000);
    return () => clearInterval(t);
  }, []);

  const move = async (id: number, to_stage: string) => {
    await api(`/api/v1/bookings/${id}/stage`, { method: "POST", body: JSON.stringify({ to_stage }) });
    await load();
  };

  const nextStage = (current: string) => {
    const idx = WASH_STAGES.indexOf(current as any);
    if (idx < 0 || idx >= WASH_STAGES.length - 1) return null;
    return WASH_STAGES[idx + 1];
  };

  return (
    <div>
      <PageHeader title="Live Wash Queue" subtitle="Move vehicles through wash stages" actions={<button className="btn-secondary" onClick={() => load()}>Refresh</button>} />
      {error && <div className="mb-3 text-rose-600 text-sm">{error}</div>}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {WASH_STAGES.map((stage) => (
          <div key={stage} className="min-w-[240px] max-w-[260px] flex-shrink-0">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-sm">{STAGE_LABELS[stage]}</h3>
              <span className="badge bg-slate-200 text-slate-700">{(stages[stage] || []).length}</span>
            </div>
            <div className="space-y-2">
              {(stages[stage] || []).map((b) => {
                const next = nextStage(b.wash_stage);
                return (
                  <div key={b.id} className="card p-3 space-y-2">
                    <div className="font-medium text-sm">{b.vehicle_registration}</div>
                    <div className="text-xs text-slate-500">{b.customer_name}</div>
                    <div className="text-xs">{b.service_name || b.package_name}</div>
                    <div className="text-xs">{formatMoney(b.total_amount)} · {b.payment_status}</div>
                    {next && (
                      <button className="btn-primary w-full !py-1.5 text-xs" onClick={() => move(b.id, next)}>
                        Move to {STAGE_LABELS[next]}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
