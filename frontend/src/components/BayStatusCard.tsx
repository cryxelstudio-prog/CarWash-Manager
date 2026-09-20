import { Car, Clock3, Ticket, UserRound, CheckCircle2 } from "lucide-react";
import { STAGE_LABELS } from "../lib/api";
import { useEasyMode } from "../hooks/useEasyMode";
import { useBranding } from "../hooks/useBranding";
import { isShowRegistration, vehicleDescription } from "../lib/vehicles";

export type BayBoardItem = {
  id: number;
  name: string;
  bay_number: number;
  status: string;
  status_locked?: boolean;
  assigned_staff?: string | null;
  branch_name?: string | null;
  current_vehicle?: {
    booking_id?: number;
    registration?: string | null;
    ticket_number?: string | null;
    booking_number?: string;
    description?: string | null;
    colour?: string | null;
    make?: string | null;
    model?: string | null;
    customer?: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
    service?: string | null;
    stage?: string;
    eta?: string | null;
    staff?: string | null;
    payment_method_intent?: string | null;
    pay_badge?: string | null;
  } | null;
};

const STATUS_STYLES: Record<string, { bg: string; ring: string; label: string; easyLabel: string; pulse?: boolean }> = {
  AVAILABLE: { bg: "from-emerald-500 to-green-600", ring: "ring-emerald-400/50", label: "Available", easyLabel: "Bay free" },
  OPEN: { bg: "from-emerald-500 to-teal-600", ring: "ring-emerald-400/40", label: "Open", easyLabel: "Bay free" },
  BUSY: { bg: "from-amber-500 to-orange-600", ring: "ring-orange-400/60", label: "Busy", easyLabel: "Bay busy", pulse: true },
  READY: { bg: "from-sky-500 to-blue-600", ring: "ring-sky-400/50", label: "Ready for collection", easyLabel: "Ready" },
  OFFLINE: { bg: "from-slate-400 to-slate-600", ring: "ring-slate-400/30", label: "Offline", easyLabel: "Bay offline" },
  CLOSED: { bg: "from-slate-500 to-slate-700", ring: "ring-slate-500/30", label: "Closed", easyLabel: "Bay closed" },
};

export default function BayStatusCard({
  bay,
  onSetStatus,
  onDone,
  compact = false,
}: {
  bay: BayBoardItem;
  onSetStatus?: (status: string) => void;
  onDone?: (bookingId: number, ticket?: string | null, vehicle?: string | null) => void;
  compact?: boolean;
}) {
  const { easyMode } = useEasyMode();
  const { branding } = useBranding();
  const showReg = isShowRegistration(branding);
  const rawStatus = bay.status || "AVAILABLE";
  let effective = rawStatus;
  if (rawStatus === "OFFLINE" || rawStatus === "CLOSED") {
    effective = rawStatus;
  } else if (bay.current_vehicle?.stage === "READY" || rawStatus === "READY") {
    effective = "READY";
  } else if (bay.current_vehicle) {
    effective = "BUSY";
  } else if (rawStatus === "OPEN") {
    effective = "AVAILABLE";
  }
  const style = STATUS_STYLES[effective] || STATUS_STYLES.AVAILABLE;
  const v = bay.current_vehicle;
  const statusLabel = easyMode ? style.easyLabel : style.label;
  const ticket = v?.ticket_number || v?.booking_number;
  const desc = vehicleDescription(v);
  const canDone = !!v?.booking_id && v.stage !== "READY" && v.stage !== "COLLECTED" && onDone;

  return (
    <div
      className={`card overflow-hidden ${style.pulse ? "bay-pulse" : ""} ring-2 ${style.ring} ${
        effective === "BUSY" ? "border-orange-300/80 dark:border-orange-700/50" : ""
      } ${effective === "READY" ? "border-sky-300/80 dark:border-sky-700/50" : ""} ${
        effective === "AVAILABLE" || effective === "OPEN" ? "border-emerald-200/80 dark:border-emerald-800/40" : ""
      }`}
    >
      <div className={`bg-gradient-to-br ${style.bg} px-4 py-4 text-white`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className={`${easyMode ? "text-sm" : "text-xs"} font-medium uppercase tracking-wider opacity-80`}>
              {bay.branch_name || "Wash bay"}
            </div>
            <div className={`${compact ? "text-2xl" : easyMode ? "text-4xl" : "text-3xl"} font-extrabold tracking-tight`}>{bay.name}</div>
          </div>
          <div className={`rounded-full bg-white/25 backdrop-blur px-3 py-1.5 ${easyMode ? "text-base" : "text-sm"} font-bold uppercase tracking-wide shadow-sm`}>
            {statusLabel}
          </div>
        </div>
      </div>
      <div className={`p-4 space-y-3 ${compact && !easyMode ? "text-sm" : easyMode ? "text-base" : ""}`}>
        {v ? (
          <>
            <div className={`flex items-center gap-2 font-extrabold tracking-tight ${easyMode ? "text-3xl" : "text-2xl"}`}>
              <Ticket size={easyMode ? 26 : 22} className="text-slate-400 shrink-0" />
              {ticket || "—"}
            </div>
            <div className={`flex items-center gap-2 font-semibold ${easyMode ? "text-xl" : "text-lg"}`}>
              <Car size={easyMode ? 22 : 18} className="text-slate-400" />
              {desc}
            </div>
            {showReg && v.registration && (
              <div className="text-xs text-slate-400 uppercase tracking-wide">{v.registration}</div>
            )}
            <div className="text-slate-500">{v.customer}{v.customer_phone ? ` · ${v.customer_phone}` : ""}</div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">{v.service || "Service"}</span>
              <span className="badge bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                {STAGE_LABELS[v.stage || ""] || v.stage}
              </span>
              {(v.pay_badge || v.payment_method_intent) && (
                <span className={`badge font-bold ${
                  (v.pay_badge === "SALARY" || v.payment_method_intent === "salary_deduction")
                    ? "bg-violet-100 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100"
                    : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
                }`}>
                  {v.pay_badge || (v.payment_method_intent === "salary_deduction" ? "SALARY" : (v.payment_method_intent || "").toUpperCase())}
                </span>
              )}
            </div>
            <div className={`flex items-center justify-between ${easyMode ? "text-base" : "text-sm"} text-slate-500`}>
              <span className="inline-flex items-center gap-1"><Clock3 size={14} /> {v.eta || "—"}</span>
              <span className="inline-flex items-center gap-1"><UserRound size={14} /> {v.staff || bay.assigned_staff || "Unassigned"}</span>
            </div>
            {canDone && (
              <button
                type="button"
                className={`btn-primary w-full !bg-emerald-600 hover:!bg-emerald-700 ${easyMode ? "!text-lg !py-4" : ""}`}
                onClick={() => onDone!(v.booking_id!, ticket, desc)}
              >
                <CheckCircle2 size={easyMode ? 22 : 18} />
                {easyMode ? "Done — car ready" : "Mark complete"}
              </button>
            )}
            {v.stage === "READY" && (
              <div className="rounded-xl bg-sky-50 dark:bg-sky-950/40 px-3 py-2 text-sky-800 dark:text-sky-200 text-sm font-semibold text-center">
                Ready for collection
              </div>
            )}
          </>
        ) : (
          <div className="py-6 text-center text-slate-400">
            <Car className="mx-auto mb-2 opacity-40" size={easyMode ? 40 : 28} />
            <div className={`font-medium ${easyMode ? "text-base text-slate-500" : "text-sm"}`}>
              {easyMode ? "Bay free — no car here" : "No vehicle in bay"}
            </div>
            {bay.assigned_staff && <div className="mt-1 text-xs">Staff: {bay.assigned_staff}</div>}
          </div>
        )}
        {onSetStatus && (
          <div className={`grid grid-cols-2 ${easyMode ? "sm:grid-cols-2" : "sm:grid-cols-4"} gap-2 pt-1`}>
            {["AVAILABLE", "BUSY", "OFFLINE", "CLOSED"].map((s) => {
              const st = STATUS_STYLES[s] || { label: s, easyLabel: s };
              return (
                <button
                  key={s}
                  type="button"
                  className={`btn-secondary ${easyMode ? "!py-3 !text-base" : "!py-2 !text-xs !min-h-0"} ${bay.status === s ? "!border-sky-500 !bg-sky-50 dark:!bg-sky-950" : ""}`}
                  onClick={() => onSetStatus(s)}
                >
                  {easyMode ? st.easyLabel : st.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
