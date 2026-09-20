import { useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { api } from "../lib/api";

export default function AuditPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api<any>("/api/v1/audit-log").then((d) => setItems(d.items || [])); }, []);
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Security-sensitive actions" />
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.created_at}</td>
                <td>{r.username}</td>
                <td>{r.action}</td>
                <td>{r.entity_type} {r.entity_id || ""}</td>
                <td className="max-w-md truncate">{r.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
