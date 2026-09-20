import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import { api, ApiError, formatMoney } from "../lib/api";

const VEHICLE_TYPES = [
  { value: "SMALL", label: "Small" },
  { value: "HATCHBACK", label: "Hatchback" },
  { value: "SEDAN", label: "Sedan" },
  { value: "SUV", label: "SUV" },
  { value: "BAKKIE", label: "Bakkie" },
  { value: "VAN", label: "Van" },
  { value: "MINIBUS", label: "Minibus" },
  { value: "COMMERCIAL", label: "Commercial" },
];

const SLOTS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00",
];

export default function QuickBookPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [branches, setBranches] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [bays, setBays] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [form, setForm] = useState<any>({
    branch_id: "",
    vehicle_type: "SEDAN",
    service_id: "",
    package_id: "",
    scheduled_date: today,
    scheduled_time: "09:00",
    customer_name: "",
    customer_phone: "",
    customer_id: "",
    registration: "",
    wash_bay_id: "",
  });

  useEffect(() => {
    Promise.all([
      api<any>("/api/v1/branches"),
      api<any>("/api/v1/services"),
      api<any>("/api/v1/packages"),
      api<any>("/api/v1/wash-bays"),
      api<any>("/api/v1/customers?page_size=200"),
    ]).then(([br, svc, pkg, bay, cust]) => {
      setBranches(br.items || []);
      setServices((svc.items || []).filter((s: any) => s.is_active !== false));
      setPackages((pkg.items || []).filter((p: any) => p.is_active !== false));
      setBays(bay.items || []);
      setCustomers(cust.items || []);
      if ((br.items || []).length === 1) {
        setForm((f: any) => ({ ...f, branch_id: String(br.items[0].id) }));
      }
    }).catch((e) => setError(e.message));
  }, []);

  const branchBays = useMemo(
    () => bays.filter((b) => !form.branch_id || String(b.branch_id) === String(form.branch_id)),
    [bays, form.branch_id]
  );

  const selectedService = services.find((s) => String(s.id) === String(form.service_id));
  const selectedPackage = packages.find((p) => String(p.id) === String(form.package_id));
  const estimate = selectedPackage?.price ?? selectedService?.base_price;

  const set = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      const payload: any = {
        branch_id: Number(form.branch_id),
        vehicle_type: form.vehicle_type,
        service_id: form.service_id ? Number(form.service_id) : null,
        package_id: form.package_id ? Number(form.package_id) : null,
        scheduled_date: form.scheduled_date,
        scheduled_time: form.scheduled_time || null,
        wash_bay_id: form.wash_bay_id ? Number(form.wash_bay_id) : null,
        registration: form.registration || null,
        source: "WALK_IN",
      };
      if (mode === "existing") {
        payload.customer_id = Number(form.customer_id);
      } else {
        payload.customer_name = form.customer_name;
        payload.customer_phone = form.customer_phone;
      }
      const b = await api<any>("/api/v1/bookings/quick", { method: "POST", body: JSON.stringify(payload) });
      setOk(`Booked ${b.booking_number}`);
      setTimeout(() => navigate("/queue"), 600);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Booking failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader
        title="Quick Book"
        subtitle="A few taps — perfect for phone"
        actions={
          <button className="btn-secondary" type="button" onClick={() => navigate("/bookings")}>
            Advanced
          </button>
        }
      />
      {error && <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {ok && <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</div>}

      <form className="card p-4 md:p-5 space-y-4" onSubmit={submit}>
        {branches.length > 1 && (
          <div>
            <label className="label">Branch</label>
            <select className="input" required value={form.branch_id} onChange={(e) => set("branch_id", e.target.value)}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        {branches.length === 1 && <input type="hidden" value={form.branch_id} />}

        <div>
          <label className="label">Vehicle type</label>
          <select className="input" required value={form.vehicle_type} onChange={(e) => set("vehicle_type", e.target.value)}>
            {VEHICLE_TYPES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Service</label>
          <select className="input" value={form.service_id} onChange={(e) => set("service_id", e.target.value)}>
            <option value="">Select service…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {formatMoney(s.base_price)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Package (optional)</label>
          <select className="input" value={form.package_id} onChange={(e) => set("package_id", e.target.value)}>
            <option value="">None</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {formatMoney(p.price)}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" required value={form.scheduled_date} onChange={(e) => set("scheduled_date", e.target.value)} />
          </div>
          <div>
            <label className="label">Time slot</label>
            <select className="input" value={form.scheduled_time} onChange={(e) => set("scheduled_time", e.target.value)}>
              {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button type="button" className={`flex-1 rounded-lg py-2 text-sm font-semibold ${mode === "new" ? "bg-white dark:bg-slate-900 shadow" : ""}`} onClick={() => setMode("new")}>New customer</button>
          <button type="button" className={`flex-1 rounded-lg py-2 text-sm font-semibold ${mode === "existing" ? "bg-white dark:bg-slate-900 shadow" : ""}`} onClick={() => setMode("existing")}>Existing</button>
        </div>

        {mode === "new" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Customer name</label>
              <input className="input" required value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="Thabo Molefe" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Phone</label>
              <input className="input" type="tel" required value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} placeholder="082 000 0000" />
            </div>
          </div>
        ) : (
          <div>
            <label className="label">Customer</label>
            <select className="input" required value={form.customer_id} onChange={(e) => set("customer_id", e.target.value)}>
              <option value="">Select…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name || `${c.first_name} ${c.last_name}`} · {c.phone}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">Registration (optional)</label>
          <input className="input uppercase" value={form.registration} onChange={(e) => set("registration", e.target.value.toUpperCase())} placeholder="CA 123-456" />
        </div>

        <div>
          <label className="label">Bay preference</label>
          <select className="input" value={form.wash_bay_id} onChange={(e) => set("wash_bay_id", e.target.value)}>
            <option value="">Any</option>
            {branchBays.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {estimate != null && (
          <div className="rounded-xl bg-sky-50 dark:bg-sky-950/40 px-4 py-3 flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300">Estimate (ex. extras)</span>
            <span className="font-bold">{formatMoney(estimate)}</span>
          </div>
        )}

        <button className="btn-primary w-full !py-3.5 text-base" disabled={busy || (!form.service_id && !form.package_id)}>
          {busy ? "Booking…" : "Confirm booking"}
        </button>
      </form>
    </div>
  );
}
