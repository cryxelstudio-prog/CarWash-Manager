import { FormEvent, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { ApiError } from "../lib/api";

export default function SetupWizard() {
  const { completeSetup } = useAuth();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    username: "admin",
    password: "",
    full_name: "",
    email: "",
    company_name: "",
    company_phone: "",
    company_email: "",
    company_address: "",
    branch_name: "Main Branch",
    branch_code: "MAIN",
    branch_phone: "",
    branch_city: "Johannesburg",
    load_demo_data: true,
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await completeSetup({
        admin: {
          username: form.username,
          password: form.password,
          full_name: form.full_name,
          email: form.email || null,
        },
        company: {
          company_name: form.company_name,
          phone: form.company_phone || null,
          email: form.company_email || null,
          address: form.company_address || null,
          currency: "ZAR",
          timezone: "Africa/Johannesburg",
          tax_rate: 15,
        },
        branch: {
          name: form.branch_name,
          code: form.branch_code,
          phone: form.branch_phone || null,
          city: form.branch_city || null,
        },
        services: [],
        load_demo_data: form.load_demo_data,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Setup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-100 dark:bg-slate-950 p-4">
      <form onSubmit={submit} className="card w-full max-w-2xl p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">First-run setup</h1>
          <p className="text-sm text-slate-500">No Microsoft 365 or cloud configuration required.</p>
          <div className="mt-3 flex gap-2 text-xs">
            {["Admin", "Company", "Branch", "Finish"].map((label, i) => (
              <span key={label} className={`badge ${i === step ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-600"}`}>{i + 1}. {label}</span>
            ))}
          </div>
        </div>
        {error && <div className="rounded-lg bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>}

        {step === 0 && (
          <div className="grid md:grid-cols-2 gap-3">
            <div><label className="label">Full name</label><input className="input" required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} /></div>
            <div><label className="label">Username</label><input className="input" required value={form.username} onChange={(e) => set("username", e.target.value)} /></div>
            <div><label className="label">Password (min 8)</label><input className="input" type="password" required minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
          </div>
        )}
        {step === 1 && (
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><label className="label">Company name</label><input className="input" required value={form.company_name} onChange={(e) => set("company_name", e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.company_phone} onChange={(e) => set("company_phone", e.target.value)} /></div>
            <div><label className="label">Email</label><input className="input" value={form.company_email} onChange={(e) => set("company_email", e.target.value)} /></div>
            <div className="md:col-span-2"><label className="label">Address</label><input className="input" value={form.company_address} onChange={(e) => set("company_address", e.target.value)} /></div>
          </div>
        )}
        {step === 2 && (
          <div className="grid md:grid-cols-2 gap-3">
            <div><label className="label">Branch name</label><input className="input" required value={form.branch_name} onChange={(e) => set("branch_name", e.target.value)} /></div>
            <div><label className="label">Branch code</label><input className="input" required value={form.branch_code} onChange={(e) => set("branch_code", e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.branch_phone} onChange={(e) => set("branch_phone", e.target.value)} /></div>
            <div><label className="label">City</label><input className="input" value={form.branch_city} onChange={(e) => set("branch_city", e.target.value)} /></div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">Default wash services will be created. You can edit them later.</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.load_demo_data} onChange={(e) => set("load_demo_data", e.target.checked)} />
              Load demo customers, bookings and inventory
            </label>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <button type="button" className="btn-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
          <button className="btn-primary" disabled={busy}>{step < 3 ? "Continue" : busy ? "Setting up…" : "Finish setup"}</button>
        </div>
      </form>
    </div>
  );
}
