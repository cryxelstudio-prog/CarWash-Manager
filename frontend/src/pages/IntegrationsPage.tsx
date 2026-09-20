import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import { api } from "../lib/api";

export default function IntegrationsPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api<any>("/api/v1/integrations").then((d) => setItems(d.items || [])); }, []);
  return (
    <div>
      <PageHeader
        title="Integrations"
        subtitle="Optional connectors — all start Not Configured. Local mode works fully without these."
      />
      <div className="card p-4 mb-4 text-sm text-slate-600 dark:text-slate-300">
        For <strong>Outlook Calendar</strong> and owner email alerts, use the simple wizard on{" "}
        <Link className="text-sky-600 underline font-medium" to="/launch">Launch → Outlook Calendar</Link>.
        See <code className="text-xs">docs/OUTLOOK_SETUP.txt</code>.
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((i) => (
          <div key={i.id || i.code} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{i.name}</div>
                <div className="text-xs text-slate-500">{i.category}</div>
              </div>
              <span className="badge bg-amber-100 text-amber-800">{i.adapter_status || i.status || "NOT_CONFIGURED"}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{i.description || i.adapter_message || "Not configured"}</p>
            {(i.code === "outlook_notifications" || i.code === "m365_calendar" || i.code === "email") ? (
              <Link className="btn-primary mt-3 w-full inline-flex justify-center" to="/launch">Configure on Launch…</Link>
            ) : (
              <button className="btn-secondary mt-3 w-full" disabled title="Configure later">Configure…</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
