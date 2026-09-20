import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useBranding } from "../hooks/useBranding";
import { ApiError, api } from "../lib/api";

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const { appName, logoUrl, accent } = useBranding();
  const navigate = useNavigate();
  const [info, setInfo] = useState<any>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    full_name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (!token) return;
    api<any>(`/api/v1/invites/token/${encodeURIComponent(token)}`)
      .then(setInfo)
      .catch((e) => setError(e instanceof ApiError ? e.detail : "Invite not found"));
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const res = await api<any>("/api/v1/invites/accept", {
        method: "POST",
        body: JSON.stringify({
          token,
          username: form.username,
          password: form.password,
          full_name: form.full_name,
          email: form.email || null,
          phone: form.phone || null,
        }),
      });
      setMsg(res.message || "Account created");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not create account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen grid place-items-center p-4"
      style={{ background: `linear-gradient(160deg, #0f172a 0%, #1e293b 45%, ${accent}55 100%)` }}
    >
      <form onSubmit={onSubmit} className="card w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover bg-white shadow" />
          ) : (
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-extrabold shadow" style={{ background: accent }}>
              CW
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">Join the team</h1>
            <p className="text-sm text-slate-500">{appName} staff invite</p>
          </div>
        </div>

        {info && (
          <div className="rounded-xl bg-sky-50 text-sky-900 px-3 py-2 text-sm space-y-1">
            <div>Role: <strong>{info.role_name || "—"}</strong></div>
            {info.branch_name && <div>Branch: {info.branch_name}</div>}
            <div className="capitalize">Status: {info.status}</div>
            {!info.valid && <div className="text-rose-700 font-medium">This invite can no longer be used.</div>}
          </div>
        )}

        {error && <div className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>}
        {msg && <div className="rounded-xl bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">{msg}</div>}

        {info?.valid && (
          <>
            <div>
              <label className="label">Full name</label>
              <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Username</label>
              <input className="input" required minLength={2} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="username" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
            </div>
            <div>
              <label className="label">Email (optional)</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone (optional)</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <button className="btn-primary w-full !min-h-[52px]" disabled={busy}>
              {busy ? "Creating…" : "Create staff account"}
            </button>
          </>
        )}

        <p className="text-center text-sm text-slate-500">
          Already have an account? <Link to="/login" className="text-sky-600 underline">Staff login</Link>
        </p>
      </form>
    </div>
  );
}
