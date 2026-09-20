import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { api, STAGE_LABELS } from "../lib/api";
import { bookingPrimaryLabel, vehicleDescription } from "../lib/vehicles";

export default function CalendarPage() {
  const [view, setView] = useState<"day" | "week" | "month" | "agenda">("week");
  const [items, setItems] = useState<any[]>([]);
  const [anchor, setAnchor] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const start = new Date(anchor);
    const from = new Date(start); from.setDate(from.getDate() - 7);
    const to = new Date(start); to.setDate(to.getDate() + 21);
    api<any>(`/api/v1/bookings?date_from=${from.toISOString().slice(0,10)}&date_to=${to.toISOString().slice(0,10)}`)
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]));
  }, [anchor]);

  const filtered = useMemo(() => {
    const d = new Date(anchor);
    if (view === "day") return items.filter((b) => b.scheduled_date === anchor);
    if (view === "week") {
      const day = d.getDay();
      const monday = new Date(d); monday.setDate(d.getDate() - ((day + 6) % 7));
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      return items.filter((b) => b.scheduled_date >= monday.toISOString().slice(0,10) && b.scheduled_date <= sunday.toISOString().slice(0,10));
    }
    if (view === "month") {
      const prefix = anchor.slice(0, 7);
      return items.filter((b) => String(b.scheduled_date).startsWith(prefix));
    }
    return items;
  }, [items, view, anchor]);

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Day / week / month / agenda views" actions={
        <>
          <input className="input !w-auto" type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
          {(["day","week","month","agenda"] as const).map((v) => (
            <button key={v} className={view===v?"btn-primary":"btn-secondary"} onClick={() => setView(v)}>{v}</button>
          ))}
        </>
      } />
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Time</th><th>Ticket</th><th>Customer</th><th>Vehicle</th><th>Stage</th></tr></thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id}>
                <td>{b.scheduled_date}</td>
                <td>{b.scheduled_time || "—"}</td>
                <td className="font-bold">{bookingPrimaryLabel(b)}</td>
                <td>{b.customer_name}</td>
                <td>{vehicleDescription(b)}</td>
                <td>{STAGE_LABELS[b.wash_stage] || b.wash_stage}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="text-slate-500">No bookings in this view</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
