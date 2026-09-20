import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import { api, STAGE_LABELS, fmtDate } from "../lib/api";
import { bookingPrimaryLabel, vehicleDescription } from "../lib/vehicles";
import { useEasyMode } from "../hooks/useEasyMode";

const STATUS_COLOURS: Record<string, string> = {
  BOOKED: "bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100",
  ARRIVED: "bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-950/40 dark:border-sky-700 dark:text-sky-100",
  CHECK_IN: "bg-sky-100 border-sky-400 text-sky-900 dark:bg-sky-950/50 dark:border-sky-600",
  WAITING: "bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-700",
  PRE_WASH: "bg-indigo-50 border-indigo-300 text-indigo-900 dark:bg-indigo-950/40",
  WASHING: "bg-blue-100 border-blue-400 text-blue-950 dark:bg-blue-950/50",
  INTERIOR: "bg-violet-50 border-violet-300 dark:bg-violet-950/40",
  DETAILING: "bg-purple-50 border-purple-300 dark:bg-purple-950/40",
  QUALITY_CHECK: "bg-cyan-50 border-cyan-300 dark:bg-cyan-950/40",
  READY: "bg-emerald-100 border-emerald-400 text-emerald-950 dark:bg-emerald-950/50 dark:border-emerald-600",
  COLLECTED: "bg-emerald-50 border-emerald-200 text-emerald-800 opacity-80 dark:bg-emerald-950/30",
  CANCELLED: "bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/40",
  NO_SHOW: "bg-rose-100 border-rose-400 text-rose-950 dark:bg-rose-950/50",
};

const BAY_ACCENTS = [
  "ring-sky-400",
  "ring-violet-400",
  "ring-amber-400",
  "ring-emerald-400",
  "ring-rose-400",
];

export default function CalendarPage() {
  const { easyMode } = useEasyMode();
  const [view, setView] = useState<"day" | "week" | "month" | "agenda">("week");
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [anchor, setAnchor] = useState(new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    api<any>("/api/v1/branches").then((d) => setBranches(d.items || [])).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    const start = new Date(anchor);
    const from = new Date(start); from.setDate(from.getDate() - 7);
    const to = new Date(start); to.setDate(to.getDate() + 21);
    const qs = new URLSearchParams({
      date_from: from.toISOString().slice(0, 10),
      date_to: to.toISOString().slice(0, 10),
      page_size: "200",
    });
    if (branchId) qs.set("branch_id", branchId);
    api<any>(`/api/v1/bookings?${qs}`)
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]));
  }, [anchor, branchId]);

  const filtered = useMemo(() => {
    const d = new Date(anchor);
    if (view === "day") return items.filter((b) => b.scheduled_date === anchor);
    if (view === "week") {
      const day = d.getDay();
      const monday = new Date(d); monday.setDate(d.getDate() - ((day + 6) % 7));
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      return items.filter((b) => b.scheduled_date >= monday.toISOString().slice(0, 10) && b.scheduled_date <= sunday.toISOString().slice(0, 10));
    }
    if (view === "month") {
      const prefix = anchor.slice(0, 7);
      return items.filter((b) => String(b.scheduled_date).startsWith(prefix));
    }
    return items;
  }, [items, view, anchor]);

  const bayAccent = (b: any) => {
    if (!b.wash_bay_id) return "";
    return BAY_ACCENTS[Number(b.wash_bay_id) % BAY_ACCENTS.length];
  };

  const downloadIcs = (b: any) => {
    window.open(`/api/v1/bookings/${b.id}/ics`, "_blank");
  };

  return (
    <div>
      <PageHeader
        title={easyMode ? "Calendar" : "Calendar"}
        subtitle={easyMode ? "See today’s washes by ticket and car" : "Local calendar is primary — Day / Week / Month / Agenda"}
        actions={
          <>
            <input className="input !w-auto" type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
            {branches.length > 1 && (
              <select className="input !w-auto" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">All branches</option>
                {branches.map((br) => (
                  <option key={br.id} value={br.id}>{br.name}</option>
                ))}
              </select>
            )}
            {(["day", "week", "month", "agenda"] as const).map((v) => (
              <button key={v} className={view === v ? "btn-primary" : "btn-secondary"} onClick={() => setView(v)}>
                {easyMode ? v.charAt(0).toUpperCase() + v.slice(1) : v}
              </button>
            ))}
          </>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((b) => {
          const colour = STATUS_COLOURS[b.wash_stage] || STATUS_COLOURS.BOOKED;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelected(b)}
              className={`card p-4 text-left border-2 ring-2 ring-offset-1 ${colour} ${bayAccent(b)} hover:shadow-md transition`}
            >
              <div className={`font-extrabold tracking-tight ${easyMode ? "text-2xl" : "text-xl"}`}>
                {bookingPrimaryLabel(b)}
              </div>
              <div className={`font-semibold mt-1 ${easyMode ? "text-base" : "text-sm"}`}>
                {vehicleDescription(b)}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                {fmtDate(b.scheduled_date)} · {b.scheduled_time || "—"}
              </div>
              <div className="text-xs mt-1 flex flex-wrap gap-2 items-center">
                <span className="badge bg-white/70 dark:bg-black/30">{STAGE_LABELS[b.wash_stage] || b.wash_stage}</span>
                {(b.bay_name || b.wash_bay_id) && (
                  <span className="badge bg-white/70 dark:bg-black/30">{b.bay_name || `Bay #${b.wash_bay_id}`}</span>
                )}
                {b.branch_name && branches.length > 1 && (
                  <span className="text-slate-500">{b.branch_name}</span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1 truncate">{b.customer_name}</div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="card p-8 text-center text-slate-500 sm:col-span-2 xl:col-span-3">
            No bookings in this view — book a wash or change the date.
          </div>
        )}
      </div>

      <Modal open={!!selected} title={selected ? bookingPrimaryLabel(selected) : ""} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-2 text-sm">
            <div><span className="text-slate-500">Vehicle:</span> <strong>{vehicleDescription(selected)}</strong></div>
            <div><span className="text-slate-500">Customer:</span> {selected.customer_name}</div>
            <div><span className="text-slate-500">Phone:</span> {selected.customer_phone || "—"}</div>
            <div><span className="text-slate-500">When:</span> {fmtDate(selected.scheduled_date)} {selected.scheduled_time || ""}</div>
            <div><span className="text-slate-500">Stage:</span> {STAGE_LABELS[selected.wash_stage] || selected.wash_stage}</div>
            <div><span className="text-slate-500">Bay:</span> {selected.bay_name || (selected.wash_bay_id ? `#${selected.wash_bay_id}` : "—")}</div>
            <div><span className="text-slate-500">Branch:</span> {selected.branch_name || "—"}</div>
            <div><span className="text-slate-500">Service:</span> {selected.service_name || selected.package_name || "—"}</div>
            <div className="flex flex-wrap gap-2 pt-3">
              <button type="button" className="btn-primary" onClick={() => downloadIcs(selected)}>
                Add to calendar (.ics)
              </button>
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <p className="text-xs text-slate-500 pt-1">
              Download opens in Outlook / Google Calendar on your PC. App calendar stays the source of truth.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
