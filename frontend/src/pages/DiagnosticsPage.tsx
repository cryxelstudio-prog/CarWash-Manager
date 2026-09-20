import { useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { api } from "../lib/api";

export default function DiagnosticsPage() {
  const [data, setData] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  useEffect(() => {
    api<any>("/api/v1/diagnostics").then(setData);
    fetch("/health").then((r) => r.json()).then(setHealth);
  }, []);
  return (
    <div>
      <PageHeader title="Diagnostics" subtitle="Health, paths and runtime status" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4 text-sm space-y-2">
          <h3 className="font-semibold">Health endpoint</h3>
          <pre className="text-xs overflow-auto">{JSON.stringify(health, null, 2)}</pre>
        </div>
        <div className="card p-4 text-sm space-y-2">
          <h3 className="font-semibold">Diagnostics</h3>
          <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
