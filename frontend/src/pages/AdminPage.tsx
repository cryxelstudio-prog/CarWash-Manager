import { FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import { api, ApiError } from "../lib/api";
import { useEasyMode } from "../hooks/useEasyMode";
import { useAuth } from "../contexts/AuthContext";

type Role = { id: number; name: string; display_name: string };
type UserRow = {
  id: number;
  username: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role_id: number;
  role_name?: string | null;
  role_code?: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  last_login_at?: string | null;
};

const emptyForm = {
  id: null as number | null,
  username: "",
  password: "",
  full_name: "",
  email: "",
  phone: "",
  role_id: "",
  is_active: true,
};

export default function AdminPage() {
  const { canManageUsers, easyMode } = useEasyMode();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState({ ...emptyForm });
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const [u, r] = await Promise.all([
      api<{ items: UserRow[] }>("/api/v1/users"),
      api<{ items: Role[] }>("/api/v1/roles"),
    ]);
    setUsers(u.items || []);
    setRoles(r.items || []);
  };

  useEffect(() => {
    if (!canManageUsers) return;
    load().catch((e) => setError(e instanceof ApiError ? e.detail : e.message));
  }, [canManageUsers]);

  if (!canManageUsers) {
    return <Navigate to="/" replace />;
  }

  const openNew = () => {
    const defaultRole = roles.find((x) => x.name === "operator") || roles[0];
    setEdit({ ...emptyForm, role_id: defaultRole ? String(defaultRole.id) : "" });
    setShowForm(true);
    setMsg("");
    setError("");
  };

  const openEdit = (u: UserRow) => {
    setEdit({
      id: u.id,
      username: u.username,
      password: "",
      full_name: u.full_name || "",
      email: u.email || "",
      phone: u.phone || "",
      role_id: String(u.role_id),
      is_active: !!u.is_active,
    });
    setShowForm(true);
    setMsg("");
    setError("");
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      if (edit.id) {
        const body: any = {
          full_name: edit.full_name,
          email: edit.email || null,
          phone: edit.phone || null,
          role_id: Number(edit.role_id),
          is_active: edit.is_active,
        };
        if (edit.password.trim()) body.password = edit.password;
        await api(`/api/v1/users/${edit.id}`, { method: "PUT", body: JSON.stringify(body) });
        setMsg("User updated");
      } else {
        await api("/api/v1/users", {
          method: "POST",
          body: JSON.stringify({
            username: edit.username,
            password: edit.password,
            full_name: edit.full_name,
            email: edit.email || null,
            phone: edit.phone || null,
            role_id: Number(edit.role_id),
            is_active: edit.is_active,
          }),
        });
        setMsg("User created");
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Save failed");
    }
  };

  const toggleActive = async (u: UserRow) => {
    if (u.id === me?.id) {
      setError("You cannot deactivate your own account");
      return;
    }
    try {
      await api(`/api/v1/users/${u.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      await load();
      setMsg(u.is_active ? "User deactivated" : "User activated");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Update failed");
    }
  };

  return (
    <div>
      <PageHeader
        title={easyMode ? "Users" : "User management"}
        subtitle="Create staff accounts and assign roles — Admin, Manager & Senior Tech only"
        actions={
          <button className="btn-primary" type="button" onClick={openNew}>
            Add user
          </button>
        }
      />
      {msg && <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}
      {error && <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="card p-4 mb-4 text-sm text-slate-600 dark:text-slate-300 space-y-1">
        <p><strong>Roles:</strong> Super Admin / Admin · Manager · Senior Tech / Supervisor · Reception · Operator · Detailer · Cashier</p>
        <p>Wash staff (Operator / Reception / Detailer) only see Queue, Bays, Book — not Settings or Launch.</p>
      </div>

      {showForm && (
        <form className="card p-4 mb-4 grid gap-3 md:grid-cols-2" onSubmit={save}>
          <div className="md:col-span-2 font-bold text-lg">{edit.id ? "Edit user" : "New user"}</div>
          {!edit.id && (
            <div>
              <label className="label">Username</label>
              <input className="input" required value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} autoComplete="off" />
            </div>
          )}
          <div>
            <label className="label">{edit.id ? "New password (optional)" : "Password"}</label>
            <input
              className="input"
              type="password"
              required={!edit.id}
              minLength={6}
              value={edit.password}
              onChange={(e) => setEdit({ ...edit, password: e.target.value })}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label">Full name</label>
            <input className="input" required value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" required value={edit.role_id} onChange={(e) => setEdit({ ...edit, role_id: e.target.value })}>
              <option value="">Select…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.display_name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />
            Active (can sign in)
          </label>
          <div className="md:col-span-2 flex gap-2">
            <button className="btn-primary" type="submit">Save</button>
            <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Role</th>
              <th>Active</th>
              <th>Last login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                <td className="font-medium">{u.username}</td>
                <td>{u.full_name}</td>
                <td>{u.role_name || u.role_code || "—"}</td>
                <td>{u.is_active ? "Yes" : "No"}</td>
                <td className="text-xs text-slate-500">{u.last_login_at || "—"}</td>
                <td className="text-right space-x-1 whitespace-nowrap">
                  <button type="button" className="btn-secondary !min-h-[36px] !px-3" onClick={() => openEdit(u)}>Edit</button>
                  <button
                    type="button"
                    className={`btn-secondary !min-h-[36px] !px-3 ${u.is_active ? "!text-rose-700" : "!text-emerald-700"}`}
                    onClick={() => toggleActive(u)}
                    disabled={u.id === me?.id}
                  >
                    {u.is_active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={6} className="text-center text-slate-500 py-8">No users yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
