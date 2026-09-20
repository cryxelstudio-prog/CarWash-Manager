import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useBranding } from "../../hooks/useBranding";
import { ApiError } from "../../lib/api";
import { usePortal } from "../../contexts/PortalContext";

export default function PortalRegisterPage() {
  const { register, user, loading } = usePortal();
  const { appName, logoUrl, accent } = useBranding();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/portal" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register({ name, phone, email, password });
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
            <h1 className="text-2xl font-bold">Customer sign up</h1>
            <p className="text-sm text-slate-500">{appName}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600">Create an account to book washes and see your history on your phone.</p>
        {error && <div className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>}
        <div>
          <label className="label">Your name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" required value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <button className="btn-primary w-full !min-h-[52px] text-base" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-sm text-slate-500">
          Already have an account? <Link to="/portal/login" className="text-sky-600 underline font-medium">Sign in</Link>
        </p>
        <p className="text-center text-xs text-slate-400">
          Staff? <Link to="/login" className="underline">Staff login</Link>
        </p>
      </form>
    </div>
  );
}
