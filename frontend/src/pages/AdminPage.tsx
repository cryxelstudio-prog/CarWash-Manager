import { useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { api } from "../lib/api";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => { api<any>("/api/v1/users").then((d) => setUsers(d.items || [])); }, []);
  return (
    <div>
      <PageHeader title="Admin" subtitle="Users and platform administration" />
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>Username</th><th>Name</th><th>Email</th><th>Active</th><th>Super</th><th>Last login</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.full_name}</td>
                <td>{u.email}</td>
                <td>{u.is_active ? "Yes" : "No"}</td>
                <td>{u.is_super_admin ? "Yes" : "No"}</td>
                <td>{u.last_login_at || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
