import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Droplets, ListOrdered, CalendarPlus, Home, HelpCircle, CheckCircle2, Shield } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useBranding } from "../hooks/useBranding";
import { readLoginEasyPref, useEasyMode, writeLoginEasyPref } from "../hooks/useEasyMode";
import { ApiError, api } from "../lib/api";
import { bookingPrimaryLabel, vehicleDescription } from "../lib/vehicles";
import DoneCompleteModal from "../components/DoneCompleteModal";

/** Compact staff mobile entry at /m — defaults toward Easy Mode for everyone. */
export default function MobileEntryPage() {
  const { user, loading, setupRequired, login } = useAuth();
  const { appName, logoUrl, accent } = useBranding();
  const { easyMode, setEasyMode, isManagerLike, canManageUsers, isFrontlineStaff } = useEasyMode();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [simpleMode, setSimpleMode] = useState(() => readLoginEasyPref(true));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [toast, setToast] = useState("");
  const [doneTarget, setDoneTarget] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.easy_mode !== false && !easyMode) {
      setEasyMode(true).catch(() => undefined);
    }
    api<any>("/api/v1/bookings/queue")
      .then((d) => {
        const stages = d.stages || {};
        const active: any[] = [];
        for (const s of ["WASHING", "PRE_WASH", "INTERIOR", "DETAILING", "QUALITY_CHECK", "WAITING", "CHECK_IN", "ARRIVED", "BOOKED"]) {
          for (const b of stages[s] || []) active.push(b);
        }
        setJobs(active.slice(0, 8));
      })
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
      navigate(simpleMode ? "/queue" : "/queue");
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
        <form onSubmit={onSubmit} className="card w-full max-w-sm mx-auto p-6 space-y-4 shadow-2xl">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover bg-white shadow" />
            ) : (
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg shadow" style={{ background: accent }}>
                CW
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold leading-tight">{appName}</h1>
              <p className="text-sm text-slate-500">Staff phone sign-in</p>
            </div>
          </div>
          {error && <div className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>}
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
          <button className="btn-primary w-full !py-3.5 text-base" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
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
  if (isManagerLike && !isFrontlineStaff) {
    tiles.push({ to: canManageUsers ? "/admin" : "/services", label: canManageUsers ? "Users" : "Manager", icon: Shield });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-3 pb-10">
      <div className="card p-4 mb-4 flex items-center gap-3 shadow-md border-0">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-12 w-12 rounded-2xl object-cover shadow" />
        ) : (
          <div className="h-12 w-12 rounded-2xl text-white font-bold grid place-items-center shadow" style={{ background: accent }}>CW</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-bold text-lg truncate">{appName}</div>
          <div className="text-sm text-slate-500">Hi, {user.full_name.split(" ")[0]}</div>
        </div>
        <Link to="/" className="btn-secondary !min-h-[44px] !px-3 text-sm">Full app</Link>
      </div>

      {toast && <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-medium">{toast}</div>}

      <button
        type="button"
        className="mode-toggle w-full mb-4 border-2 border-emerald-600 bg-emerald-50 text-emerald-900"
        onClick={() => setEasyMode(!easyMode)}
      >
        {easyMode ? "Switch to Full mode" : "Switch to Simple mode"}
      </button>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {tiles.map((t) => (
          <Link
            key={t.to + t.label}
            to={t.to}
            className="card p-5 flex flex-col items-center gap-2.5 active:scale-[0.98] transition min-h-[96px] shadow-sm hover:shadow-md"
          >
            <div className="h-12 w-12 rounded-2xl bg-sky-50 dark:bg-sky-950/50 grid place-items-center">
              <t.icon size={26} className="text-sky-600" />
            </div>
            <span className="text-base font-semibold text-center">{t.label}</span>
          </Link>
        ))}
      </div>

      <div className="card p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-bold text-slate-700 dark:text-slate-200">Cars in progress</div>
          <Link to="/queue" className="text-sm font-semibold text-sky-600">Open queue</Link>
        </div>
        {jobs.length === 0 && (
          <p className="text-base text-slate-500 py-8 text-center">No cars waiting — nice and quiet</p>
        )}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {jobs.map((j) => (
            <li key={j.id} className="py-3.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-lg tracking-tight">{bookingPrimaryLabel(j)}</div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{vehicleDescription(j)}</div>
                <div className="text-xs text-slate-500">{j.wash_stage}</div>
              </div>
              {j.wash_stage !== "READY" && (
                <button
                  type="button"
                  className="btn-primary !bg-emerald-600 !min-h-[48px] !px-3 shrink-0"
                  onClick={() => setDoneTarget(j)}
                >
                  <CheckCircle2 size={18} />
                  Done
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <DoneCompleteModal
        open={!!doneTarget}
        ticket={doneTarget ? (doneTarget.ticket_number || doneTarget.booking_number) : null}
        vehicle={doneTarget ? vehicleDescription(doneTarget) : null}
        onClose={() => setDoneTarget(null)}
        onConfirm={async (message) => {
          if (!doneTarget) return;
          const res = await api<any>(`/api/v1/bookings/${doneTarget.id}/stage`, {
            method: "POST",
            body: JSON.stringify({ to_stage: "READY", customer_message: message || null, notify_customer: true }),
          });
          setToast(res?.customer_notify?.message || "Saved — marked ready");
          setTimeout(() => setToast(""), 5000);
          setJobs((prev) => prev.filter((x) => x.id !== doneTarget.id));
        }}
      />
    </div>
  );
}
