import { FormEvent, useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { api } from "../lib/api";

export default function SettingsPage() {
  const [branding, setBranding] = useState<any>({});
  const [msg, setMsg] = useState("");

  useEffect(() => { api<any>("/api/v1/branding").then(setBranding); }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const pairs: [string, string][] = [
      ["app.name", branding["app.name"] || ""],
      ["company.name", branding["company.name"] || ""],
      ["company.phone", branding["company.phone"] || ""],
      ["company.email", branding["company.email"] || ""],
      ["company.address", branding["company.address"] || ""],
      ["app.accent_colour", branding["app.accent_colour"] || "#0ea5e9"],
      ["app.receipt_footer", branding["app.receipt_footer"] || ""],
      ["locale.currency", branding["locale.currency"] || "ZAR"],
      ["locale.currency_symbol", branding["locale.currency_symbol"] || "R"],
      ["locale.timezone", branding["locale.timezone"] || "Africa/Johannesburg"],
      ["locale.date_format", branding["locale.date_format"] || "DD/MM/YYYY"],
      ["locale.tax_rate", branding["locale.tax_rate"] || "15"],
    ];
    for (const [key, value] of pairs) {
      await api(`/api/v1/settings/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify({ key, value, category: key.split(".")[0] }),
      });
    }
    setMsg("Settings saved");
  };

  const field = (key: string, label: string) => (
    <div key={key}>
      <label className="label">{label}</label>
      <input className="input" value={branding[key] || ""} onChange={(e) => setBranding({ ...branding, [key]: e.target.value })} />
    </div>
  );

  return (
    <div>
      <PageHeader title="Settings & Branding" subtitle="Company identity, locale and receipt footer" />
      {msg && <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}
      <form className="card p-4 grid md:grid-cols-2 gap-3" onSubmit={save}>
        {field("app.name", "App name")}
        {field("company.name", "Company name")}
        {field("company.phone", "Phone")}
        {field("company.email", "Email")}
        <div className="md:col-span-2">{field("company.address", "Address")}</div>
        {field("app.accent_colour", "Accent colour")}
        {field("locale.currency_symbol", "Currency symbol")}
        {field("locale.timezone", "Timezone")}
        {field("locale.date_format", "Date format")}
        {field("locale.tax_rate", "Tax rate %")}
        <div className="md:col-span-2">{field("app.receipt_footer", "Receipt footer")}</div>
        <div className="md:col-span-2"><button className="btn-primary">Save settings</button></div>
      </form>
    </div>
  );
}
