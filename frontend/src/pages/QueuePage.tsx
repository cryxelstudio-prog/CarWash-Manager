import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import { api, STAGE_LABELS, WASH_STAGES, formatMoney } from "../lib/api";

export default function QueuePage() {
  const [stages, setStages] = useState<Record<string, any[]>>({});
  const [bays, setBays] = useState<any[]>([]);
  const [error, setError] = useState("");

  const load = async () => {
    const [data, bayData] = await Promise.all([
      api<any>("/api/v1/bookings/queue"),
      api<any>("/api/v1/wash-bays"),
    ]);
    setStages(data.stages || {});
    setBays(bayData.items || []);
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
    const t = setInterval(() => load().catch(() => undefined), 15000);
    return () => clearInterval(t);
  }, []);

  const move = async (id: number, to_stage: string, wash_bay_id?: number | null) => {
    const body: any = { to_stage };
    if (wash_bay_id) body.wash_bay_id = wash_bay_id;
    await api(`/api/v1/bookings/${id}/stage`, { method: "POST", body: JSON.stringify(body) });
    await load();
  };

  const nextStage = (current: string) => {
    const idx = WASH_STAGES.indexOf(current as any);
    if (idx < 0 || idx >= WASH_STAGES.length - 1) return null;
    return WASH_STAGES[idx + 1];
  };

  const needsBay = (stage: string) => ["PRE_WASH", "WASHING", "INTERIOR", "DETAILING"].includes(stage);

  return (
    <div>
      <PageHeader
        title="Live Wash Queue"
        subtitle="Move vehicles through stages — assign Bay 1 or Bay 2 when washing"
        actions={
          <>
            <Link className="btn-primary" to="/quick-book">Quick Book</Link>
            <button className="btn-secondary" onClick={() => load()}>Refresh</button>
          </>
        }
      />
      {error && <div className="mb-3 text-rose-600 text-sm">{error}</div>}
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
        {WASH_STAGES.map((stage) => (
          <div key={stage} className="min-w-[240px] max-w-[280px] flex-shrink-0">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-sm">{STAGE_LABELS[stage]}</h3>
              <span className="badge bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{(stages[stage] || []).length}</span>
            </div>
            <div className="space-y-2">
              {(stages[stage] || []).map((b) => {
                const next = nextStage(b.wash_stage);
                return (
                  <div key={b.id} className="card p-3 space-y-2">
                    <div className="font-semibold text-sm">{b.vehicle_registration}</div>
                    <div className="text-xs text-slate-500">{b.customer_name}</div>
                    <div className="text-xs">{b.service_name || b.package_name}</div>
                    <div className="text-xs">{formatMoney(b.total_amount)} · {b.payment_status}</div>
                    {b.wash_bay_id && (
                      <div className="text-xs font-medium text-sky-600">
                        {bays.find((x) => x.id === b.wash_bay_id)?.name || `Bay #${b.wash_bay_id}`}
                      </div>
                    )}
                    {next && needsBay(next) && !b.wash_bay_id && (
                      <div className="grid grid-cols-2 gap-1">
                        {bays.slice(0, 2).map((bay) => (
                          <button
                            key={bay.id}
                            className="btn-primary !py-2 text-xs"
                            onClick={() => move(b.id, next, bay.id)}
                          >
                            → {bay.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {next && !(needsBay(next) && !b.wash_bay_id) && (
                      <button className="btn-primary w-full !py-2 text-xs" onClick={() => move(b.id, next, b.wash_bay_id)}>
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
