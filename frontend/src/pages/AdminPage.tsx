import { FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Copy, Check, Link2 } from "lucide-react";
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
type InviteRow = {
  id: number;
  role_name?: string | null;
  role_code?: string | null;
  branch_name?: string | null;
  status: string;
  expires_at?: string | null;
  used_at?: string | null;
  created_by_name?: string | null;
  note?: string | null;
  invite_url?: string;
  token?: string;
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
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState({ ...emptyForm });
  const [showForm, setShowForm] = useState(false);
  const [inviteRole, setInviteRole] = useState("");
  const [inviteDays, setInviteDays] = useState("7");
  const [inviteNote, setInviteNote] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const [u, r, inv] = await Promise.all([
      api<{ items: UserRow[] }>("/api/v1/users"),
      api<{ items: Role[] }>("/api/v1/roles"),
      api<{ items: InviteRow[] }>("/api/v1/invites"),
    ]);
    setUsers(u.items || []);
    setRoles(r.items || []);
    setInvites(inv.items || []);
    if (!inviteRole) {
      const def = (r.items || []).find((x) => x.name === "operator") || (r.items || [])[0];
      if (def) setInviteRole(String(def.id));
    }
  };

  useEffect(() => {
    if (!canManageUsers) return;
    load().catch((e) => setError(e instanceof ApiError ? e.detail : e.message));
  }, [canManageUsers]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!canManageUsers) {
    return <Navigate to="/" replace />;
  }

  const inviteableRoles = roles.filter((r) => {
    if (r.name === "customer" || r.name === "custom") return false;
    if (r.name === "super_admin" && !(me?.is_super_admin || (me?.role_name || "").toLowerCase().includes("owner"))) {
      return false;
    }
    return true;
  });

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

  const createInvite = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      const res = await api<InviteRow>("/api/v1/invites", {
        method: "POST",
        body: JSON.stringify({
          role_id: Number(inviteRole),
          expires_days: Number(inviteDays) || 7,
          note: inviteNote || null,
        }),
      });
      setLastInviteUrl(res.invite_url || "");
      setMsg("Invite link created — copy and send to the new staff member");
      setInviteNote("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Invite failed");
    }
  };

  const revokeInvite = async (id: number) => {
    try {
      await api(`/api/v1/invites/${id}/revoke`, { method: "POST", body: "{}" });
      setMsg("Invite revoked");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Revoke failed");
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <PageHeader
        title={easyMode ? "Users" : "User management"}
        subtitle="Invite staff safely — no open public staff signup"
        actions={
          <button className="btn-primary" type="button" onClick={openNew}>
            Add user
          </button>
        }
      />
      {msg && <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}
      {error && <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="card p-4 mb-4 space-y-3">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Link2 size={18} /> Invite staff
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Create a one-time link. The person chooses their username and password. Staff cannot sign up without an invite.
        </p>
        <form className="grid gap-3 md:grid-cols-4 items-end" onSubmit={createInvite}>
          <div>
            <label className="label">Role</label>
            <select className="input" required value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              {inviteableRoles.map((r) => (
                <option key={r.id} value={r.id}>{r.display_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Expires in</label>
            <select className="input" value={inviteDays} onChange={(e) => setInviteDays(e.target.value)}>
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input className="input" value={inviteNote} onChange={(e) => setInviteNote(e.target.value)} placeholder="e.g. Thabo — weekends" />
          </div>
          <button className="btn-primary" type="submit">Generate invite link</button>
        </form>
        {lastInviteUrl && (
          <div className="flex gap-2 items-center">
            <input className="input font-mono text-xs" readOnly value={lastInviteUrl} />
            <button type="button" className="btn-secondary shrink-0" onClick={() => copyUrl(lastInviteUrl)}>
              {copied ? <Check size={16} /> : <Copy size={16} />} Copy
            </button>
          </div>
        )}
        <div className="overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Created by</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invites.slice(0, 20).map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.role_name || "—"}{inv.note ? <span className="block text-xs text-slate-400">{inv.note}</span> : null}</td>
                  <td className="capitalize">{inv.status}</td>
                  <td className="text-xs text-slate-500">{inv.expires_at ? new Date(inv.expires_at).toLocaleString("en-ZA") : "—"}</td>
                  <td className="text-sm">{inv.created_by_name || "—"}</td>
                  <td className="text-right">
                    {inv.status === "pending" && (
                      <button type="button" className="btn-secondary !min-h-[36px] !px-3 !text-rose-700" onClick={() => revokeInvite(inv.id)}>
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {invites.length === 0 && (
                <tr><td colSpan={5} className="text-center text-slate-500 py-6">No invites yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4 mb-4 text-sm text-slate-600 dark:text-slate-300 space-y-1">
        <p><strong>Roles:</strong> Super Admin / Admin · Manager · Senior Tech / Supervisor · Reception · Operator · Detailer · Cashier</p>
        <p>Wash staff only see Queue, Bays, Book — not Settings or Launch. Customers use <code>/portal</code>, not this page.</p>
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
              {inviteableRoles.map((r) => (
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
