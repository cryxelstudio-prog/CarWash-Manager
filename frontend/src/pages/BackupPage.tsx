import { useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { api } from "../lib/api";

export default function BackupPage() {
  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const load = () => api<any>("/api/v1/backups").then((d) => setItems(d.items || []));
  useEffect(() => { load(); }, []);

  const create = async () => {
    const res = await api<any>("/api/v1/backups", { method: "POST" });
    setMsg(`Created ${res.name}`);
    await load();
  };

  const restore = async (name: string) => {
    if (!confirm(`Restore backup ${name}? The app database will be replaced.`)) return;
    await api(`/api/v1/backups/restore?name=${encodeURIComponent(name)}`, { method: "POST" });
    setMsg(`Restored ${name}. Refresh recommended.`);
  };

  return (
    <div>
      <PageHeader title="Backup & Restore" subtitle="Local ZIP backups of database and uploads" actions={<button className="btn-primary" onClick={create}>Create backup</button>} />
      {msg && <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Size</th><th>Modified</th><th></th></tr></thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.name}>
                <td>{b.name}</td>
                <td>{Math.round((b.size || 0) / 1024)} KB</td>
                <td>{b.modified}</td>
                <td className="text-right"><button className="btn-secondary !py-1" onClick={() => restore(b.name)}>Restore</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="text-slate-500">No backups yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
