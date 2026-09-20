import { useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { api } from "../lib/api";

export default function ActivityPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api<any>("/api/v1/activity").then((d) => setItems(d.items || [])); }, []);
  return (
    <div>
      <PageHeader title="Activity timeline" subtitle="Recent operational activity" />
      <div className="space-y-2">
        {items.map((a) => (
          <div key={a.id} className="card p-3">
            <div className="text-sm font-medium">{a.summary}</div>
            <div className="text-xs text-slate-500">{a.actor_name} · {a.created_at}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
