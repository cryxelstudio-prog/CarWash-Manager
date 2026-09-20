import { Car, Clock3, Ticket, UserRound } from "lucide-react";
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
    registration?: string | null;
    ticket_number?: string | null;
    booking_number?: string;
    description?: string | null;
    colour?: string | null;
    make?: string | null;
    model?: string | null;
    customer?: string | null;
    customer_phone?: string | null;
    service?: string | null;
    stage?: string;
    eta?: string | null;
    staff?: string | null;
  } | null;
};

const STATUS_STYLES: Record<string, { bg: string; ring: string; label: string; easyLabel: string; pulse?: boolean }> = {
  AVAILABLE: { bg: "from-emerald-500 to-teal-600", ring: "ring-emerald-400/40", label: "Available", easyLabel: "Bay free" },
  OPEN: { bg: "from-sky-500 to-cyan-600", ring: "ring-sky-400/40", label: "Open", easyLabel: "Bay free" },
  BUSY: { bg: "from-orange-500 to-amber-600", ring: "ring-orange-400/50", label: "Busy", easyLabel: "Bay busy", pulse: true },
  OFFLINE: { bg: "from-slate-500 to-slate-700", ring: "ring-slate-400/30", label: "Offline", easyLabel: "Bay offline" },
  CLOSED: { bg: "from-rose-600 to-red-800", ring: "ring-rose-400/30", label: "Closed", easyLabel: "Bay closed" },
};

export default function BayStatusCard({
  bay,
  onSetStatus,
  compact = false,
}: {
  bay: BayBoardItem;
  onSetStatus?: (status: string) => void;
  compact?: boolean;
}) {
  const { easyMode } = useEasyMode();
  const { branding } = useBranding();
  const showReg = isShowRegistration(branding);
  const style = STATUS_STYLES[bay.status] || STATUS_STYLES.AVAILABLE;
  const v = bay.current_vehicle;
  const statusLabel = easyMode ? style.easyLabel : style.label;
  const ticket = v?.ticket_number || v?.booking_number;
  const desc = vehicleDescription(v);

  return (
    <div className={`card overflow-hidden ${style.pulse && !easyMode ? "bay-pulse" : ""} ring-1 ${style.ring}`}>
      <div className={`bg-gradient-to-br ${style.bg} px-4 py-4 text-white`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className={`${easyMode ? "text-sm" : "text-xs"} font-medium uppercase tracking-wider opacity-80`}>
              {bay.branch_name || "Wash bay"}
            </div>
            <div className={`${compact ? "text-2xl" : easyMode ? "text-4xl" : "text-3xl"} font-extrabold tracking-tight`}>{bay.name}</div>
          </div>
          <div className={`rounded-full bg-white/20 backdrop-blur px-3 py-1 ${easyMode ? "text-base" : "text-sm"} font-bold uppercase tracking-wide`}>
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
            </div>
            <div className={`flex items-center justify-between ${easyMode ? "text-base" : "text-sm"} text-slate-500`}>
              <span className="inline-flex items-center gap-1"><Clock3 size={14} /> {v.eta || "—"}</span>
              <span className="inline-flex items-center gap-1"><UserRound size={14} /> {v.staff || bay.assigned_staff || "Unassigned"}</span>
            </div>
          </>
        ) : (
          <div className="py-4 text-center text-slate-400">
            <Car className="mx-auto mb-2 opacity-40" size={easyMode ? 36 : 28} />
            <div className={easyMode ? "text-base" : "text-sm"}>{easyMode ? "No car in this bay" : "No vehicle in bay"}</div>
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
