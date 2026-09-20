import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Droplets, ListOrdered, CalendarPlus, LayoutDashboard } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useBranding } from "../hooks/useBranding";
import { ApiError, api } from "../lib/api";

/** Compact staff mobile entry at /m — login + quick ops shortcuts. */
export default function MobileEntryPage() {
  const { user, loading, setupRequired, login } = useAuth();
  const { appName, logoUrl, accent } = useBranding();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    api<any>("/api/v1/bookings?page_size=8")
      .then((d) => setJobs((d.items || []).slice(0, 6)))
      .catch(() => undefined);
  }, [user]);

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>;
  if (setupRequired) return <Navigate to="/setup" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      navigate("/queue");
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
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="text-center text-xs text-slate-500">
            <Link to="/login" className="underline">Full login</Link>
          </p>
        </form>
      </div>
    );
  }

  const tiles = [
    { to: "/queue", label: "Queue", icon: ListOrdered },
    { to: "/wash-bays", label: "Bays", icon: Droplets },
    { to: "/quick-book", label: "Quick Book", icon: CalendarPlus },
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
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
        <Link to="/" className="btn-secondary ml-auto !min-h-[36px] !px-3 text-xs">Full app</Link>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="card p-4 flex flex-col items-center gap-2 active:scale-[0.98] transition">
            <t.icon size={22} className="text-sky-600" />
            <span className="text-sm font-semibold">{t.label}</span>
          </Link>
        ))}
      </div>
      <div className="card p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Today&apos;s jobs</div>
        {jobs.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No recent bookings</p>}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {jobs.map((j) => (
            <li key={j.id} className="py-2.5 flex justify-between gap-2 text-sm">
              <span className="font-medium truncate">{j.booking_number || j.id}</span>
              <span className="text-xs text-slate-500 shrink-0">{j.wash_stage || j.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
