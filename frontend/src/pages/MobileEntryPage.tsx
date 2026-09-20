import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Droplets, ListOrdered, CalendarPlus, Home, HelpCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useBranding } from "../hooks/useBranding";
import { readLoginEasyPref, useEasyMode, writeLoginEasyPref } from "../hooks/useEasyMode";
import { ApiError, api } from "../lib/api";

/** Compact staff mobile entry at /m — defaults toward Easy Mode for everyone. */
export default function MobileEntryPage() {
  const { user, loading, setupRequired, login } = useAuth();
  const { appName, logoUrl, accent } = useBranding();
  const { easyMode, setEasyMode } = useEasyMode();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [simpleMode, setSimpleMode] = useState(() => readLoginEasyPref(true));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    // Mobile entry leans Easy for all roles unless user explicitly chose Full
    if (user.easy_mode !== false && !easyMode) {
      setEasyMode(true).catch(() => undefined);
    }
    api<any>("/api/v1/bookings?page_size=8")
      .then((d) => setJobs((d.items || []).slice(0, 6)))
      .catch(() => undefined);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>;
  if (setupRequired) return <Navigate to="/setup" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      writeLoginEasyPref(simpleMode);
      await login(username, password, simpleMode);
      navigate(simpleMode ? "/quick-book" : "/queue");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div
        className="min-h-screen flex flex-col justify-center p-4"
        style={{
          background: `linear-gradient(160deg, #0f172a 0%, #1e293b 45%, ${accent}55 100%)`,
        }}
      >
        <form onSubmit={onSubmit} className="card w-full max-w-sm mx-auto p-5 space-y-3 shadow-2xl">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-12 w-12 rounded-2xl object-cover bg-white" />
            ) : (
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-white font-extrabold" style={{ background: accent }}>
                CW
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold leading-tight">{appName}</h1>
              <p className="text-xs text-slate-500">Staff mobile sign-in</p>
            </div>
          </div>
          {error && <div className="rounded-lg bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>}
          <div>
            <label className="label">Username</label>
            <input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <label className="flex items-start gap-3 rounded-2xl border-2 border-slate-200 p-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-sky-600"
              checked={simpleMode}
              onChange={(e) => {
                setSimpleMode(e.target.checked);
                writeLoginEasyPref(e.target.checked);
              }}
            />
            <span>
              <span className="block font-bold">Simple mode (larger text)</span>
              <span className="block text-sm text-slate-500">Recommended on phones — for every role</span>
            </span>
          </label>
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="text-center text-xs text-slate-500">
            <Link to="/login" className="underline">Full login</Link>
          </p>
        </form>
      </div>
    );
  }

  const tiles = [
    { to: "/quick-book", label: "Book a wash", icon: CalendarPlus },
    { to: "/queue", label: "Queue", icon: ListOrdered },
    { to: "/wash-bays", label: "Bays", icon: Droplets },
    { to: "/", label: "Home", icon: Home },
    { to: "/help", label: "Help", icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-3 pb-8">
      <div className="flex items-center gap-3 mb-4">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
        ) : (
          <div className="h-10 w-10 rounded-xl text-white font-bold grid place-items-center" style={{ background: accent }}>CW</div>
        )}
        <div className="min-w-0">
          <div className="font-semibold truncate">{appName}</div>
          <div className="text-xs text-slate-500">Hi, {user.full_name}</div>
        </div>
        <Link to="/" className="btn-secondary ml-auto !min-h-[44px] !px-3 text-sm">Full app</Link>
      </div>
      <button
        type="button"
        className="mode-toggle w-full mb-4 border-2 border-emerald-600 bg-emerald-50 text-emerald-900"
        onClick={() => setEasyMode(!easyMode)}
      >
        {easyMode ? "Switch to Full mode" : "Switch to Simple mode"}
      </button>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="card p-5 flex flex-col items-center gap-2 active:scale-[0.98] transition min-h-[88px]">
            <t.icon size={28} className="text-sky-600" />
            <span className="text-base font-semibold text-center">{t.label}</span>
          </Link>
        ))}
      </div>
      <div className="card p-3">
        <div className="text-sm font-semibold text-slate-600 mb-2">Today&apos;s jobs</div>
        {jobs.length === 0 && <p className="text-base text-slate-500 py-4 text-center">No recent bookings</p>}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {jobs.map((j) => (
            <li key={j.id} className="py-3 flex justify-between gap-2 text-base">
              <span className="font-medium truncate">{j.booking_number || j.id}</span>
              <span className="text-sm text-slate-500 shrink-0">{j.wash_stage || j.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
