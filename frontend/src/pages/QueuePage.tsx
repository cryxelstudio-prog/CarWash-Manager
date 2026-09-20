import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import DoneCompleteModal from "../components/DoneCompleteModal";
import { api, STAGE_LABELS, WASH_STAGES, formatMoney, ApiError } from "../lib/api";
import { useEasyMode } from "../hooks/useEasyMode";
import { useBranding } from "../hooks/useBranding";
import { bookingPrimaryLabel, isShowRegistration, vehicleDescription } from "../lib/vehicles";
import { CheckCircle2 } from "lucide-react";

export default function QueuePage() {
  const { easyMode } = useEasyMode();
  const { branding } = useBranding();
  const showReg = isShowRegistration(branding);
  const [stages, setStages] = useState<Record<string, any[]>>({});
  const [bays, setBays] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [doneTarget, setDoneTarget] = useState<any | null>(null);

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

  const move = async (id: number, to_stage: string, wash_bay_id?: number | null, customer_message?: string) => {
    const body: any = { to_stage };
    if (wash_bay_id) body.wash_bay_id = wash_bay_id;
    if (customer_message) body.customer_message = customer_message;
    if (to_stage === "READY") body.notify_customer = true;
    const res = await api<any>(`/api/v1/bookings/${id}/stage`, { method: "POST", body: JSON.stringify(body) });
    if (to_stage === "READY") {
      const msg = res?.customer_notify?.message || "Saved — marked ready";
      setToast(msg);
      setTimeout(() => setToast(""), 5000);
    }
    await load();
  };

  const nextStage = (current: string) => {
    const idx = WASH_STAGES.indexOf(current as any);
    if (idx < 0 || idx >= WASH_STAGES.length - 1) return null;
    return WASH_STAGES[idx + 1];
  };

  const needsBay = (stage: string) => ["PRE_WASH", "WASHING", "INTERIOR", "DETAILING"].includes(stage);
  const canMarkDone = (stage: string) => !["READY", "COLLECTED", "CANCELLED", "NO_SHOW"].includes(stage);

  const totalWaiting = Object.entries(stages)
    .filter(([s]) => !["READY", "COLLECTED", "CANCELLED", "NO_SHOW"].includes(s))
    .reduce((n, [, items]) => n + (items?.length || 0), 0);

  return (
    <div>
      <PageHeader
        title={easyMode ? "Wash queue" : "Live Wash Queue"}
        subtitle={easyMode ? "Move cars by ticket — tap Done when finished" : "Ticket + car description — Done notifies the car owner"}
        actions={
          <>
            <Link className="btn-primary" to="/quick-book">{easyMode ? "Book a wash" : "Quick Book"}</Link>
            <button className="btn-secondary" onClick={() => load()}>Refresh</button>
          </>
        }
      />
      {error && <div className="mb-3 text-rose-600 text-sm">{error}</div>}
      {toast && <div className="mb-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-100 font-medium">{toast}</div>}

      {totalWaiting === 0 && (
        <div className="mb-4">
          <EmptyState title="No cars waiting — nice and quiet" hint={easyMode ? "When a booking arrives, it will show up here." : "New bookings appear in Booked / Arrived columns."} action={<Link className="btn-primary" to="/quick-book">{easyMode ? "Book a wash" : "Quick Book"}</Link>} />
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
        {WASH_STAGES.map((stage) => (
          <div key={stage} className="min-w-[260px] max-w-[300px] flex-shrink-0">
            <div className="mb-2 flex items-center justify-between px-0.5">
              <h3 className={`font-semibold ${easyMode ? "text-base" : "text-sm"}`}>{STAGE_LABELS[stage]}</h3>
              <span className="badge bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{(stages[stage] || []).length}</span>
            </div>
            <div className="space-y-3">
              {(stages[stage] || []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 px-3 py-6 text-center text-sm text-slate-400">
                  {stage === "READY" ? "None ready yet" : "Empty"}
                </div>
              )}
              {(stages[stage] || []).map((b) => {
                const next = nextStage(b.wash_stage);
                return (
                  <div key={b.id} className="card p-4 space-y-2.5 shadow-sm">
                    <div className={`font-extrabold tracking-tight ${easyMode ? "text-2xl" : "text-xl"}`}>
                      {bookingPrimaryLabel(b)}
                    </div>
                    <div className={`font-semibold text-slate-800 dark:text-slate-100 ${easyMode ? "text-base" : "text-sm"}`}>
                      {vehicleDescription(b)}
                    </div>
                    {showReg && b.vehicle_registration && (
                      <div className="text-[11px] uppercase text-slate-400">{b.vehicle_registration}</div>
                    )}
                    <div className="text-xs text-slate-500">
                      {b.customer_name}{b.customer_phone ? ` · ${b.customer_phone}` : ""}
                    </div>
                    <div className="text-xs">{b.service_name || b.package_name}</div>
                    <div className="text-xs flex flex-wrap items-center gap-2">
                      <span>{formatMoney(b.total_amount)} · {b.payment_status}</span>
                      {(b.pay_badge || (b.payment_method_intent === "salary_deduction" ? "SALARY" : b.payment_method_intent === "cash" ? "CASH" : null)) && (
                        <span className={`badge text-[10px] font-bold ${
                          (b.pay_badge || "").includes("SALARY") || b.payment_method_intent === "salary_deduction"
                            ? "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                        }`}>
                          {b.pay_badge || (b.payment_method_intent === "salary_deduction" ? "SALARY" : "CASH")}
                        </span>
                      )}
                    </div>
                    {b.wash_bay_id && (
                      <div className="text-xs font-medium text-sky-600">
                        {bays.find((x) => x.id === b.wash_bay_id)?.name || `Bay #${b.wash_bay_id}`}
                      </div>
                    )}
                    {canMarkDone(b.wash_stage) && (
                      <button
                        className={`btn-primary w-full !bg-emerald-600 hover:!bg-emerald-700 shadow-md ${
                          b.wash_bay_id || ["WASHING", "PRE_WASH", "INTERIOR", "DETAILING", "QUALITY_CHECK"].includes(b.wash_stage)
                            ? (easyMode ? "!text-lg !py-4 ring-2 ring-emerald-300" : "!text-base !py-3.5 ring-2 ring-emerald-200")
                            : (easyMode ? "!text-base !py-3.5" : "!py-2.5 text-sm")
                        }`}
                        onClick={() => setDoneTarget(b)}
                      >
                        <CheckCircle2 size={easyMode || b.wash_bay_id ? 22 : 18} />
                        {easyMode ? "Done — car ready" : "Mark complete"}
                      </button>
                    )}
                    {next && needsBay(next) && !b.wash_bay_id && (
                      <div className="grid grid-cols-2 gap-1">
                        {bays.slice(0, 2).map((bay) => (
                          <button
                            key={bay.id}
                            className="btn-secondary !py-2 text-xs"
                            onClick={() => move(b.id, next, bay.id).catch((e) => setError(e instanceof ApiError ? e.detail : e.message))}
                          >
                            → {bay.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {next && next !== "READY" && !(needsBay(next) && !b.wash_bay_id) && (
                      <button
                        className="btn-secondary w-full !py-2 text-xs"
                        onClick={() => move(b.id, next, b.wash_bay_id).catch((e) => setError(e instanceof ApiError ? e.detail : e.message))}
                      >
                        {easyMode ? `Next: ${STAGE_LABELS[next]}` : `Move to ${STAGE_LABELS[next]}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <DoneCompleteModal
        open={!!doneTarget}
        ticket={doneTarget ? (doneTarget.ticket_number || doneTarget.booking_number) : null}
        vehicle={doneTarget ? vehicleDescription(doneTarget) : null}
        onClose={() => setDoneTarget(null)}
        onConfirm={async (message) => {
          if (!doneTarget) return;
          try {
            await move(doneTarget.id, "READY", doneTarget.wash_bay_id, message);
          } catch (e: any) {
            throw new Error(e instanceof ApiError ? e.detail : e.message || "Failed");
          }
        }}
      />
    </div>
  );
}
