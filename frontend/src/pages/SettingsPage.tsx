import { FormEvent, useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { api, ApiError } from "../lib/api";
import { applyAccent, useBranding } from "../hooks/useBranding";
import { useEasyMode } from "../hooks/useEasyMode";

export default function SettingsPage() {
  const { refresh } = useBranding();
  const { easyMode, setEasyMode, highContrast, setHighContrast } = useEasyMode();
  const [branding, setBranding] = useState<any>({});
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api<any>("/api/v1/branding").then((b) => {
      setBranding(b);
      applyAccent(b["app.accent_colour"]);
    });
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      await api("/api/v1/branding", {
        method: "PUT",
        body: JSON.stringify({
          "app.name": branding["app.name"] || "",
          "company.name": branding["company.name"] || "",
          "company.phone": branding["company.phone"] || "",
          "company.email": branding["company.email"] || "",
          "company.address": branding["company.address"] || "",
          "app.accent_colour": branding["app.accent_colour"] || "#0ea5e9",
          "app.receipt_footer": branding["app.receipt_footer"] || "",
          "app.login_background_url": branding["app.login_background_url"] || "",
          "app.theme_default": branding["app.theme_default"] || "system",
          "locale.currency": branding["locale.currency"] || "ZAR",
          "locale.currency_symbol": branding["locale.currency_symbol"] || "R",
          "locale.timezone": branding["locale.timezone"] || "Africa/Johannesburg",
          "locale.date_format": branding["locale.date_format"] || "DD/MM/YYYY",
          "locale.tax_rate": branding["locale.tax_rate"] || "15",
          "hosting.cors_origins_extra": branding["hosting.cors_origins_extra"] || "",
          "vehicles.show_registration": branding["vehicles.show_registration"] || "false",
          "vehicles.require_registration": branding["vehicles.require_registration"] || "false",
          "vehicles.hide_registration": branding["vehicles.hide_registration"] || "true",
        }),
      });
      applyAccent(branding["app.accent_colour"]);
      await refresh();
      setMsg("Settings saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Save failed");
    }
  };

  const onLogo = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api<any>("/api/v1/branding/logo", { method: "POST", body: fd });
      setBranding((b: any) => ({ ...b, "app.logo_url": res.url }));
      await refresh();
      setMsg("Logo uploaded");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const field = (key: string, label: string, hint?: string, type = "text") => (
    <div key={key}>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        value={branding[key] || ""}
        onChange={(e) => setBranding({ ...branding, [key]: e.target.value })}
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );

  return (
    <div>
      <PageHeader title="Settings & Branding" subtitle="Company identity, logo, theme accent, locale" />
      {msg && <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}
      {error && <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="card p-4 md:p-5 mb-4">
        <h3 className="font-bold mb-3">Logo</h3>
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-20 w-20 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 overflow-hidden grid place-items-center">
            {branding["app.logo_url"] ? (
              <img src={branding["app.logo_url"]} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-slate-400">No logo</span>
            )}
          </div>
          <div>
            <label className="btn-secondary cursor-pointer inline-flex">
              {uploading ? "Uploading…" : "Upload logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={(e) => onLogo(e.target.files?.[0] || null)}
              />
            </label>
            <p className="mt-1 text-xs text-slate-500">PNG, JPG, WEBP, SVG or GIF · max 5 MB · shown in sidebar & login</p>
          </div>
        </div>
      </div>

      <form className="card p-4 grid md:grid-cols-2 gap-3 mb-4" onSubmit={save}>
        {field("app.name", "App name")}
        {field("company.name", "Company name")}
        {field("company.phone", "Phone")}
        {field("company.email", "Email")}
        <div className="md:col-span-2">{field("company.address", "Address")}</div>
        <div>
          <label className="label">Primary accent colour</label>
          <div className="flex gap-2">
            <input
              type="color"
              className="h-[44px] w-14 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
              value={branding["app.accent_colour"] || "#0ea5e9"}
              onChange={(e) => {
                setBranding({ ...branding, "app.accent_colour": e.target.value });
                applyAccent(e.target.value);
              }}
            />
            <input
              className="input font-mono"
              value={branding["app.accent_colour"] || "#0ea5e9"}
              onChange={(e) => {
                setBranding({ ...branding, "app.accent_colour": e.target.value });
                applyAccent(e.target.value);
              }}
            />
          </div>
        </div>
        <div>
          <label className="label">Default theme</label>
          <select
            className="input"
            value={branding["app.theme_default"] || "system"}
            onChange={(e) => setBranding({ ...branding, "app.theme_default": e.target.value })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">Per-user toggle in the header still overrides for the session.</p>
        </div>
        {field("app.login_background_url", "Login background URL (optional)", "Image URL or /uploads/… path")}
        {field("locale.currency_symbol", "Currency symbol")}
        {field("locale.timezone", "Timezone")}
        {field("locale.date_format", "Date format")}
        {field("locale.tax_rate", "Tax rate %")}
        <div className="md:col-span-2">{field("app.receipt_footer", "Receipt footer")}</div>
        <div className="md:col-span-2">
          {field(
            "hosting.cors_origins_extra",
            "Extra CORS origins",
            "Comma-separated origins for Power Apps / LAN (also set CARWASH_CORS_ORIGINS_EXTRA). See Launch tab + docs/LAUNCH_GUIDE.txt"
          )}
        </div>
        <div className="md:col-span-2"><button className="btn-primary">Save settings</button></div>
      </form>

      <div className="card p-4 md:p-5 space-y-3 mb-4">
        <h3 className="font-bold">Vehicle identification</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Staff use <strong>wash ticket</strong> (e.g. T-0042), <strong>customer name + phone</strong>, and <strong>colour + make + model</strong> (e.g. White Polo).
          Registration plates are optional and hidden by default.
        </p>
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={(branding["vehicles.show_registration"] || "false").toLowerCase() === "true"}
            onChange={(e) => {
              const on = e.target.checked;
              setBranding({
                ...branding,
                "vehicles.show_registration": on ? "true" : "false",
                "vehicles.hide_registration": on ? "false" : "true",
              });
            }}
          />
          Show registration plates
        </label>
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={(branding["vehicles.require_registration"] || "false").toLowerCase() === "true"}
            onChange={(e) => setBranding({ ...branding, "vehicles.require_registration": e.target.checked ? "true" : "false" })}
          />
          Require registration (admin)
        </label>
        <button
          type="button"
          className="btn-primary"
          onClick={async () => {
            setError("");
            setMsg("");
            try {
              await api("/api/v1/branding", {
                method: "PUT",
                body: JSON.stringify({
                  "vehicles.show_registration": branding["vehicles.show_registration"] || "false",
                  "vehicles.require_registration": branding["vehicles.require_registration"] || "false",
                  "vehicles.hide_registration": branding["vehicles.hide_registration"] || "true",
                }),
              });
              await refresh();
              setMsg("Vehicle identification settings saved");
            } catch (err) {
              setError(err instanceof ApiError ? err.detail : "Save failed");
            }
          }}
        >
          Save identification settings
        </button>
      </div>

      <div className="card p-4 md:p-5 space-y-3 mb-4">
        <h3 className="font-bold">Simple / Easy mode</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Larger text and buttons for comfortable daily use. Available to <strong>every role</strong> (including Owner and Manager). Preference is saved on your user account.
        </p>
        <button
          type="button"
          className="mode-toggle border-2 border-slate-300 w-full sm:w-auto"
          onClick={() => setEasyMode(!easyMode)}
        >
          {easyMode ? "Switch to Full mode" : "Switch to Simple mode"}
        </button>
        {easyMode && (
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <input type="checkbox" className="h-4 w-4" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} />
            High contrast
          </label>
        )}
      </div>

      <div className="card p-4 md:p-5 space-y-3 mb-4">
        <h3 className="font-bold">Owner alerts & Outlook</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Configure who gets notified and optional Outlook email on the <strong>Launch</strong> page
          (<em>Outlook Calendar</em> + <em>Owner alerts</em> cards). Local calendar always works without Microsoft 365.
        </p>
        <p className="text-xs text-slate-500">Guide: <code className="text-xs">docs/OUTLOOK_SETUP.txt</code></p>
      </div>

      <div className="card p-4 md:p-5 space-y-2">
        <h3 className="font-bold">Hosting tip</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Use the <strong>Launch</strong> sidebar page for QR staff access, LAN, Outlook, Power Apps and SharePoint wizards.
          Guides: <code className="text-xs">docs/LAUNCH_GUIDE.txt</code>, <code className="text-xs">docs/HOSTING_OPTIONS.txt</code>.
        </p>
        <p className="text-xs text-slate-500">App version 0.6.0 · Default currency ZAR · Africa/Johannesburg</p>
      </div>
    </div>
  );
}
