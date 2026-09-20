import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useBranding } from "../../hooks/useBranding";
import { ApiError, api, formatMoney, fmtDate, STAGE_LABELS } from "../../lib/api";
import { usePortal } from "../../contexts/PortalContext";

const VEHICLE_TYPES = [
  { value: "SEDAN", label: "Sedan" },
  { value: "HATCHBACK", label: "Hatchback" },
  { value: "SUV", label: "SUV" },
  { value: "BAKKIE", label: "Bakkie" },
  { value: "VAN", label: "Van" },
  { value: "SMALL", label: "Small" },
];

const SLOTS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00",
];

export default function PortalHomePage() {
  const { loading, user, vehicles, bookings, refresh, logout } = usePortal();
  const { appName, logoUrl, accent } = useBranding();
  const today = new Date().toISOString().slice(0, 10);
  const [catalog, setCatalog] = useState<any>({ branches: [], services: [], packages: [] });
  const [tab, setTab] = useState<"book" | "history">("book");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({
    branch_id: "",
    service_id: "",
    package_id: "",
    scheduled_date: today,
    scheduled_time: "09:00",
    vehicle_type: "SEDAN",
    vehicle_id: "",
    colour: "",
    make: "",
    model: "",
    payment_method_intent: "cash",
  });

  useEffect(() => {
    api<any>("/api/v1/portal/catalog")
      .then((c) => {
        setCatalog(c);
        if ((c.branches || []).length === 1) {
          setForm((f: any) => ({ ...f, branch_id: String(c.branches[0].id) }));
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (form.vehicle_id) {
      const v = vehicles.find((x) => String(x.id) === String(form.vehicle_id));
      if (v) {
        setForm((f: any) => ({
          ...f,
          colour: v.colour || f.colour,
          make: v.make || f.make,
          model: v.model || f.model,
          vehicle_type: v.size || f.vehicle_type,
        }));
      }
    }
  }, [form.vehicle_id, vehicles]);

  const estimate = useMemo(() => {
    const svc = (catalog.services || []).find((s: any) => String(s.id) === String(form.service_id));
    const pkg = (catalog.packages || []).find((p: any) => String(p.id) === String(form.package_id));
    return pkg?.price ?? svc?.base_price;
  }, [catalog, form.service_id, form.package_id]);

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/portal/login" replace />;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const onBook = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      const payload: any = {
        branch_id: Number(form.branch_id),
        scheduled_date: form.scheduled_date,
        scheduled_time: form.scheduled_time ? `${form.scheduled_time}:00` : null,
        vehicle_type: form.vehicle_type,
        colour: form.colour,
        make: form.make,
        model: form.model,
        payment_method_intent: form.payment_method_intent || "cash",
      };
      if (form.service_id) payload.service_id = Number(form.service_id);
      if (form.package_id) payload.package_id = Number(form.package_id);
      if (form.vehicle_id) payload.vehicle_id = Number(form.vehicle_id);
      const b = await api<any>("/api/v1/portal/bookings", { method: "POST", body: JSON.stringify(payload) });
      setOk(`Booked! Ticket ${b.ticket_number || b.booking_number}`);
      setTab("history");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Booking failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-10">
      <header className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-11 w-11 rounded-xl object-cover bg-white shadow" />
          ) : (
            <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold shadow" style={{ background: accent }}>
              CW
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-bold truncate">{appName}</div>
            <div className="text-xs text-slate-500 truncate">Hi {user.full_name}</div>
          </div>
          <button type="button" className="btn-secondary !min-h-[40px] !px-3 text-sm" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`rounded-2xl px-4 py-3 font-bold text-base ${tab === "book" ? "text-white shadow" : "bg-white dark:bg-slate-900 border border-slate-200"}`}
            style={tab === "book" ? { background: accent } : undefined}
            onClick={() => setTab("book")}
          >
            Book a wash
          </button>
          <button
            type="button"
            className={`rounded-2xl px-4 py-3 font-bold text-base ${tab === "history" ? "text-white shadow" : "bg-white dark:bg-slate-900 border border-slate-200"}`}
            style={tab === "history" ? { background: accent } : undefined}
            onClick={() => setTab("history")}
          >
            My bookings
          </button>
        </div>

        {error && <div className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>}
        {ok && <div className="rounded-xl bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">{ok}</div>}

        {tab === "book" && (
          <form className="card p-4 space-y-3" onSubmit={onBook}>
            <h2 className="text-lg font-bold">Quick book</h2>
            <div>
              <label className="label">Branch</label>
              <select className="input" required value={form.branch_id} onChange={(e) => set("branch_id", e.target.value)}>
                <option value="">Select…</option>
                {(catalog.branches || []).map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Service</label>
              <select
                className="input"
                value={form.service_id}
                onChange={(e) => {
                  set("service_id", e.target.value);
                  set("package_id", "");
                }}
              >
                <option value="">Select service…</option>
                {(catalog.services || []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} — {formatMoney(s.base_price)}</option>
                ))}
              </select>
            </div>
            {(catalog.packages || []).length > 0 && (
              <div>
                <label className="label">Or package</label>
                <select
                  className="input"
                  value={form.package_id}
                  onChange={(e) => {
                    set("package_id", e.target.value);
                    set("service_id", "");
                  }}
                >
                  <option value="">None</option>
                  {(catalog.packages || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} — {formatMoney(p.price)}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" required value={form.scheduled_date} onChange={(e) => set("scheduled_date", e.target.value)} />
              </div>
              <div>
                <label className="label">Time</label>
                <select className="input" value={form.scheduled_time} onChange={(e) => set("scheduled_time", e.target.value)}>
                  {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {vehicles.length > 0 && (
              <div>
                <label className="label">Saved vehicle</label>
                <select className="input" value={form.vehicle_id} onChange={(e) => set("vehicle_id", e.target.value)}>
                  <option value="">New vehicle…</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.description || `${v.colour} ${v.make} ${v.model}`}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Colour</label>
                <input className="input" required value={form.colour} onChange={(e) => set("colour", e.target.value)} placeholder="White" />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.vehicle_type} onChange={(e) => set("vehicle_type", e.target.value)}>
                  {VEHICLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Make</label>
                <input className="input" required value={form.make} onChange={(e) => set("make", e.target.value)} placeholder="VW" />
              </div>
              <div>
                <label className="label">Model</label>
                <input className="input" required value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="Polo" />
              </div>
            </div>
            {estimate != null && (
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm font-semibold">
                Estimate: {formatMoney(estimate)}
              </div>
            )}
            <button className="btn-primary w-full !min-h-[52px] text-base" disabled={busy}>
              {busy ? "Booking…" : "Book wash"}
            </button>
          </form>
        )}

        {tab === "history" && (
          <div className="space-y-3">
            {bookings.length === 0 && (
              <div className="card p-6 text-center text-slate-500">No bookings yet — tap Book a wash.</div>
            )}
            {bookings.map((b) => (
              <div key={b.id} className="card p-4 space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-lg">{b.ticket_number || b.booking_number}</span>
                  <span className="badge bg-slate-100 text-slate-700">{STAGE_LABELS[b.wash_stage] || b.wash_stage}</span>
                </div>
                <div className="text-sm text-slate-600">
                  {fmtDate(b.scheduled_date)} {b.scheduled_time?.slice?.(0, 5) || ""}
                </div>
                <div className="text-sm">{b.vehicle_description || b.service_name || b.package_name || "Wash"}</div>
                {b.total_amount != null && <div className="text-sm font-semibold">{formatMoney(b.total_amount)}</div>}
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 pt-4">
          Staff area: <Link to="/login" className="underline">Staff login</Link>
        </p>
      </main>
    </div>
  );
}
