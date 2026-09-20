import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useBranding } from "../hooks/useBranding";
import { readLoginEasyPref, writeLoginEasyPref } from "../hooks/useEasyMode";
import { ApiError } from "../lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const { appName, logoUrl, accent, branding } = useBranding();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [easyMode, setEasyMode] = useState(() => readLoginEasyPref(true));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const bg = branding["app.login_background_url"];

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      writeLoginEasyPref(easyMode);
      await login(username, password, easyMode);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen grid place-items-center p-4 relative overflow-hidden"
      style={{
        background: bg
          ? `linear-gradient(160deg, rgba(15,23,42,0.85), rgba(15,23,42,0.65)), url(${bg}) center/cover`
          : `linear-gradient(160deg, #0f172a 0%, #1e293b 40%, ${accent}66 100%)`,
      }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{ background: `radial-gradient(600px 280px at 80% 10%, ${accent}55, transparent)` }}
      />
      <form onSubmit={onSubmit} className="card w-full max-w-md p-6 md:p-8 space-y-4 shadow-2xl relative backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover bg-white shadow" />
          ) : (
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-lg font-extrabold shadow-lg"
              style={{ background: `linear-gradient(135deg, ${accent}, #0369a1)` }}
            >
              CW
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
            <p className="text-sm text-slate-500">{appName}</p>
          </div>
        </div>
        {error && <div className="rounded-lg bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>}
        <div>
          <label className="label">Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <label className="flex items-start gap-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4 cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-sky-600"
            checked={easyMode}
            onChange={(e) => {
              setEasyMode(e.target.checked);
              writeLoginEasyPref(e.target.checked);
            }}
          />
          <span>
            <span className="block text-base font-bold text-slate-800 dark:text-slate-100">Simple mode (larger text)</span>
            <span className="block text-sm text-slate-500 mt-0.5">
              Bigger buttons and clearer words. Available for every role — including managers. You can switch anytime after sign-in.
            </span>
          </span>
        </label>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="text-center text-sm text-slate-600">
          Customer? <Link to="/portal/register" className="underline text-sky-600 font-semibold">Customer sign up</Link>
          {" · "}
          <Link to="/portal/login" className="underline text-sky-600">Customer sign in</Link>
        </p>
        <p className="text-center text-xs text-slate-500">
          Staff on a phone? <Link to="/m" className="underline text-sky-600">Mobile entry</Link>
        </p>
      </form>
    </div>
  );
}
