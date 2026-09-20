import { Car, Clock3, UserRound } from "lucide-react";
import { STAGE_LABELS } from "../lib/api";

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
    customer?: string | null;
    service?: string | null;
    stage?: string;
    eta?: string | null;
    staff?: string | null;
    booking_number?: string;
  } | null;
};

const STATUS_STYLES: Record<string, { bg: string; ring: string; label: string; pulse?: boolean }> = {
  AVAILABLE: { bg: "from-emerald-500 to-teal-600", ring: "ring-emerald-400/40", label: "Available" },
  OPEN: { bg: "from-sky-500 to-cyan-600", ring: "ring-sky-400/40", label: "Open" },
  BUSY: { bg: "from-orange-500 to-amber-600", ring: "ring-orange-400/50", label: "Busy", pulse: true },
  OFFLINE: { bg: "from-slate-500 to-slate-700", ring: "ring-slate-400/30", label: "Offline" },
  CLOSED: { bg: "from-rose-600 to-red-800", ring: "ring-rose-400/30", label: "Closed" },
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
  const style = STATUS_STYLES[bay.status] || STATUS_STYLES.AVAILABLE;
  const v = bay.current_vehicle;

  return (
    <div className={`card overflow-hidden ${style.pulse ? "bay-pulse" : ""} ring-1 ${style.ring}`}>
      <div className={`bg-gradient-to-br ${style.bg} px-4 py-4 text-white`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider opacity-80">{bay.branch_name || "Wash bay"}</div>
            <div className={`${compact ? "text-2xl" : "text-3xl"} font-extrabold tracking-tight`}>{bay.name}</div>
          </div>
          <div className="rounded-full bg-white/20 backdrop-blur px-3 py-1 text-sm font-bold uppercase tracking-wide">
            {style.label}
          </div>
        </div>
      </div>
      <div className={`p-4 space-y-3 ${compact ? "text-sm" : ""}`}>
        {v ? (
          <>
            <div className="flex items-center gap-2 font-semibold text-lg">
              <Car size={18} className="text-slate-400" />
              {v.registration || "—"}
            </div>
            <div className="text-slate-500">{v.customer}</div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">{v.service || "Service"}</span>
              <span className="badge bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                {STAGE_LABELS[v.stage || ""] || v.stage}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span className="inline-flex items-center gap-1"><Clock3 size={14} /> {v.eta || "—"}</span>
              <span className="inline-flex items-center gap-1"><UserRound size={14} /> {v.staff || bay.assigned_staff || "Unassigned"}</span>
            </div>
          </>
        ) : (
          <div className="py-4 text-center text-slate-400">
            <Car className="mx-auto mb-2 opacity-40" size={28} />
            <div className="text-sm">No vehicle in bay</div>
            {bay.assigned_staff && <div className="mt-1 text-xs">Staff: {bay.assigned_staff}</div>}
          </div>
        )}
        {onSetStatus && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {["AVAILABLE", "BUSY", "OFFLINE", "CLOSED"].map((s) => (
              <button
                key={s}
                type="button"
                className={`btn-secondary !py-2 !text-xs !min-h-0 ${bay.status === s ? "!border-sky-500 !bg-sky-50 dark:!bg-sky-950" : ""}`}
                onClick={() => onSetStatus(s)}
              >
                {(STATUS_STYLES[s] || { label: s }).label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
