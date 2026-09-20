import { useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { api } from "../lib/api";
import { useEasyMode } from "../hooks/useEasyMode";

function outboundBadge(status?: string | null) {
  const s = (status || "").toUpperCase();
  if (!s || s === "SKIPPED") return <span className="badge bg-slate-100 text-slate-600">In-app only</span>;
  if (s === "SENT") return <span className="badge bg-emerald-100 text-emerald-800">Email sent</span>;
  if (s === "PENDING") return <span className="badge bg-amber-100 text-amber-800">Email pending</span>;
  if (s === "FAILED") return <span className="badge bg-rose-100 text-rose-800">Email failed</span>;
  return <span className="badge bg-slate-100 text-slate-600">{s}</span>;
}

export default function NotificationsPage() {
  const { easyMode } = useEasyMode();
  const [items, setItems] = useState<any[]>([]);
  const load = () => api<any>("/api/v1/notifications").then((d) => setItems(d.items || []));
  useEffect(() => { load(); }, []);
  const mark = async (id: number) => { await api(`/api/v1/notifications/${id}/read`, { method: "POST" }); await load(); };
  return (
    <div>
      <PageHeader
        title={easyMode ? "Alerts" : "Notifications"}
        subtitle={easyMode ? "Messages about cars and bookings" : "In-app owner alerts — outbound email status when Outlook is configured"}
      />
      <div className="space-y-2">
        {items.map((n) => (
          <div key={n.id} className={`card p-4 ${n.is_read ? "opacity-70" : ""}`}>
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`font-medium ${easyMode ? "text-lg" : ""}`}>{n.title}</div>
                  {outboundBadge(n.outbound_status)}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line mt-1">{n.body}</div>
                {n.outbound_status === "FAILED" && n.outbound_error && (
                  <div className="text-xs text-rose-600 mt-1">Outbound: {n.outbound_error}</div>
                )}
                {n.outbound_status === "PENDING" && (
                  <div className="text-xs text-amber-700 mt-1">Email still pending — booking was saved locally.</div>
                )}
                <div className="text-xs text-slate-500 mt-1">{n.created_at}</div>
              </div>
              {!n.is_read && (
                <button className="btn-secondary !py-1 shrink-0" onClick={() => mark(n.id)}>
                  {easyMode ? "Got it" : "Mark read"}
                </button>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="card p-8 text-center text-slate-500">No notifications yet</div>}
      </div>
    </div>
  );
}
