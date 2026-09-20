import { useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { api } from "../lib/api";

export default function NotificationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const load = () => api<any>("/api/v1/notifications").then((d) => setItems(d.items || []));
  useEffect(() => { load(); }, []);
  const mark = async (id: number) => { await api(`/api/v1/notifications/${id}/read`, { method: "POST" }); await load(); };
  return (
    <div>
      <PageHeader title="Notifications" subtitle="Internal alerts and system messages" />
      <div className="space-y-2">
        {items.map((n) => (
          <div key={n.id} className={`card p-4 ${n.is_read ? "opacity-70" : ""}`}>
            <div className="flex justify-between gap-3">
              <div>
                <div className="font-medium">{n.title}</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">{n.body}</div>
                <div className="text-xs text-slate-500 mt-1">{n.created_at}</div>
              </div>
              {!n.is_read && <button className="btn-secondary !py-1" onClick={() => mark(n.id)}>Mark read</button>}
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="card p-8 text-center text-slate-500">No notifications</div>}
      </div>
    </div>
  );
}
