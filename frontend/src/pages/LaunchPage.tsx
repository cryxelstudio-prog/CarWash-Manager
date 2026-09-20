import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Monitor, Wifi, AppWindow, Share2, Globe, Copy, Check, ExternalLink, Smartphone,
  CalendarDays, Bell, Mail,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { api, ApiError } from "../lib/api";

type PlatformKey =
  | "local"
  | "lan"
  | "outlook_calendar"
  | "owner_alerts"
  | "power_apps"
  | "sharepoint"
  | "custom";

const CARDS: { key: PlatformKey; title: string; blurb: string; icon: typeof Monitor; highlight?: boolean }[] = [
  { key: "local", title: "Local / This PC", blurb: "Run on the laptop — open browser + staff QR", icon: Monitor },
  { key: "lan", title: "LAN / Company Wi‑Fi", blurb: "Phones on the same network scan a QR to log in", icon: Wifi },
  {
    key: "outlook_calendar",
    title: "Outlook Calendar",
    blurb: "Optional — email you when a car is ready, or sync bookings to Outlook",
    icon: CalendarDays,
    highlight: true,
  },
  {
    key: "owner_alerts",
    title: "Owner alerts",
    blurb: "Who gets notified (name + email) and which events matter",
    icon: Bell,
  },
  { key: "power_apps", title: "Power Apps", blurb: "Custom connector via OpenAPI — optional", icon: AppWindow },
  { key: "sharepoint", title: "SharePoint", blurb: "Optional site / library for invoices & photos", icon: Share2 },
  { key: "custom", title: "Self-hosted / Custom URL", blurb: "Public or reverse-proxy base URL for QR & links", icon: Globe },
];

function statusBadge(status?: string) {
  const s = (status || "NOT_CONFIGURED").toUpperCase();
  const ok = s === "CONFIGURED" || s === "CONNECTED";
  const fail = s === "FAILED";
  const label = s === "CONNECTED" ? "Connected" : s === "FAILED" ? "Failed" : s === "CONFIGURED" ? "Configured" : "Not configured";
  const cls = fail
    ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
    : ok
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  return <span className={`badge ${cls}`}>{label}</span>;
}

function boolVal(v: any) {
  return String(v ?? "false").toLowerCase() === "true" || v === true;
}

export default function LaunchPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [active, setActive] = useState<PlatformKey | null>("outlook_calendar");
  const [form, setForm] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState("");
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    const launch = await api<any>("/api/v1/launch");
    const staff = await api<any>("/api/v1/staff-access");
    setData({ ...launch, staff });
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  useEffect(() => {
    if (!data || !active) return;
    const plat = data.platforms?.[active] || data.platforms?.outlook;
    const fields = { ...(plat?.fields || {}) };
    if (active === "local" || active === "lan") {
      fields["launch.port"] = String(data.access?.port || data.settings?.["launch.port"] || "8787");
      fields["launch.bind_host"] = data.settings?.["launch.bind_host"] || "0.0.0.0";
    }
    if (active === "custom") {
      fields["launch.public_base_url"] = data.settings?.["launch.public_base_url"] || "";
    }
    if (active === "outlook_calendar") {
      // Friendly defaults for the wizard
      if (!fields["outlook.mode"] || fields["outlook.mode"] === "") fields["outlook.mode"] = "disabled";
      if (!fields["outlook.owner_mailbox"]) {
        fields["outlook.owner_mailbox"] = data.settings?.["owner.email"] || "";
      }
      if (!fields["owner.alert.email_when_ready"]) fields["owner.alert.email_when_ready"] = "true";
    }
    if (active === "owner_alerts") {
      if (!fields["owner.email"]) fields["owner.email"] = data.settings?.["outlook.owner_mailbox"] || "";
    }
    setForm(fields);
  }, [active, data]);

  const access = data?.staff || data?.access || {};
  const qrUrl = access.qr_target || access.mobile_link || access.invite_link || "";
  const invite = access.invite_link || "";

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("Clipboard not available");
    }
  };

  const setBool = (key: string, on: boolean) => setForm({ ...form, [key]: on ? "true" : "false" });

  const save = async (e?: FormEvent, platform?: PlatformKey) => {
    if (e) e.preventDefault();
    const target = platform || active;
    if (!target) return;
    setError("");
    setMsg("");
    try {
      const updated = await api<any>(`/api/v1/launch/${target}`, {
        method: "PUT",
        body: JSON.stringify({ fields: form }),
      });
      const staff = await api<any>("/api/v1/staff-access");
      setData({ ...updated, staff });
      setMsg("Saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Save failed");
    }
  };

  const testOutlook = async (sendTest: boolean) => {
    setTesting(true);
    setError("");
    setMsg("");
    try {
      // Save first so test uses current form values
      await api(`/api/v1/launch/outlook_calendar`, {
        method: "PUT",
        body: JSON.stringify({ fields: form }),
      });
      const res = await api<any>("/api/v1/launch/outlook/test", {
        method: "POST",
        body: JSON.stringify({ send_test: sendTest }),
      });
      if (res.launch) {
        const staff = await api<any>("/api/v1/staff-access");
        setData({ ...res.launch, staff });
      }
      const t = res.test || {};
      if (t.ok) setMsg(t.message || "Connected");
      else setError(t.message || "Connection failed");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Test failed");
    } finally {
      setTesting(false);
    }
  };

  const field = (key: string, label: string, hint?: string, placeholder?: string, type = "text") => (
    <div key={key}>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        value={form[key] || ""}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        autoComplete="off"
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );

  const toggle = (key: string, label: string, hint?: string) => (
    <label key={key} className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-pointer">
      <input
        type="checkbox"
        className="mt-1 h-5 w-5"
        checked={boolVal(form[key])}
        onChange={(e) => setBool(key, e.target.checked)}
      />
      <span>
        <span className="font-medium block">{label}</span>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );

  const outlookWizard = (
    <form className="space-y-4" onSubmit={(e) => save(e, "outlook_calendar")}>
      <div className="rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 p-3 text-sm space-y-1">
        <div className="font-semibold flex items-center gap-2"><CalendarDays size={16} /> Your in-app calendar stays primary</div>
        <p className="text-slate-600 dark:text-slate-300">
          Bookings always show on Day / Week / Month / Agenda here. Outlook is optional — for owner email alerts and (if you want) a copy on your Outlook calendar.
        </p>
        <p className="text-xs text-slate-500">
          Need help? See <code className="text-[11px] bg-white/70 dark:bg-slate-900 px-1 rounded">docs/OUTLOOK_SETUP.txt</code> — no Azure expertise required for Simple email.
        </p>
      </div>

      {toggle(
        "outlook.connect_calendar",
        "Connect Outlook calendar",
        "Turn on to set up email alerts and optional Outlook sync"
      )}

      {boolVal(form["outlook.connect_calendar"]) && (
        <>
          {field(
            "outlook.owner_mailbox",
            "Owner Outlook email",
            "Where alerts are sent (e.g. you@company.com)",
            "you@outlook.com"
          )}

          {toggle(
            "outlook.sync_calendar",
            "Also sync bookings to Outlook calendar",
            "Best-effort copy — the app calendar remains the source of truth. Needs Microsoft 365 (Graph)."
          )}

          {toggle(
            "owner.alert.email_when_ready",
            "Email me when a car is ready / complete",
            "Uses the connection below. In-app notifications always work."
          )}

          <div>
            <div className="label mb-2">How should we send email?</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { value: "graph", label: "Microsoft 365 (Graph)", hint: "Uses your company Microsoft account" },
                { value: "smtp", label: "Simple email (SMTP)", hint: "Gmail / Outlook.com app password, or any SMTP" },
              ].map((opt) => {
                const selected = (form["outlook.mode"] || "disabled") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, "outlook.mode": opt.value })}
                    className={`text-left rounded-xl border p-3 transition ${
                      selected
                        ? "ring-2 ring-[var(--brand-accent)] border-transparent bg-sky-50 dark:bg-sky-950/30"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-2"><Mail size={16} /> {opt.label}</div>
                    <div className="text-xs text-slate-500 mt-1">{opt.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {(form["outlook.mode"] || "") === "graph" && (
            <div className="space-y-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Ask your IT person for these three values from Microsoft Entra (Azure). Details in{" "}
                <code className="text-xs">docs/OUTLOOK_SETUP.txt</code>.
              </p>
              {field("outlook.tenant_id", "Tenant ID")}
              {field("outlook.client_id", "Client ID (Application ID)")}
              {field("outlook.client_secret", "Client secret", undefined, undefined, "password")}
            </div>
          )}

          {(form["outlook.mode"] || "") === "smtp" && (
            <div className="space-y-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Use your normal email provider. For Outlook.com / Gmail, create an “app password”.
              </p>
              {field("outlook.smtp_host", "SMTP host", undefined, "smtp.office365.com")}
              {field("outlook.smtp_port", "Port", "Usually 587", "587")}
              {field("outlook.smtp_username", "Username", "Often the same as your email")}
              {field("outlook.smtp_password", "Password / app password", undefined, undefined, "password")}
              {field("outlook.smtp_from", "From address", "Shown as the sender", "you@outlook.com")}
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" className="btn-primary !min-h-[48px] !px-6 text-base">Save</button>
        <button
          type="button"
          className="btn-secondary !min-h-[48px]"
          disabled={testing || !boolVal(form["outlook.connect_calendar"])}
          onClick={() => testOutlook(false)}
        >
          {testing ? "Testing…" : "Test connection"}
        </button>
        <button
          type="button"
          className="btn-secondary !min-h-[48px]"
          disabled={testing || !boolVal(form["outlook.connect_calendar"])}
          onClick={() => testOutlook(true)}
        >
          Send test alert
        </button>
      </div>
      {data?.platforms?.outlook_calendar?.message && (
        <p className="text-sm text-slate-500">Status: {data.platforms.outlook_calendar.message}</p>
      )}
    </form>
  );

  const ownerWizard = (
    <form className="space-y-3" onSubmit={(e) => save(e, "owner_alerts")}>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        In-app alerts always work. Email needs an address here (or on the Outlook Calendar card) plus a connection mode.
      </p>
      {field("owner.name", "Owner name")}
      {field("owner.email", "Owner email", "Required for email alerts", "owner@example.com")}
      <div className="grid gap-2 sm:grid-cols-2">
        {toggle("owner.alert.car_ready", "Car ready for collection")}
        {toggle("owner.alert.car_completed", "Car completed / collected")}
        {toggle("owner.alert.booking_created", "Booking created")}
        {toggle("owner.alert.cancelled", "Cancelled")}
        {toggle("owner.alert.no_show", "No-show")}
      </div>
      <button className="btn-primary !min-h-[48px] !px-6">Save owner alerts</button>
    </form>
  );

  const wizard = useMemo(() => {
    if (!active) return null;
    if (active === "outlook_calendar") return outlookWizard;
    if (active === "owner_alerts") return ownerWizard;
    if (active === "local") {
      return (
        <form className="space-y-3" onSubmit={save}>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Start with <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">Run.cmd</code> (Windows) or{" "}
            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">./scripts/dev_run.sh</code>. Default bind is{" "}
            <strong>0.0.0.0:8787</strong> so LAN phones can connect too.
          </p>
          {field("launch.port", "Port", "Restart the app after changing the listen port in Run scripts / env.")}
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary" href={access.local_url || "http://127.0.0.1:8787"} target="_blank" rel="noreferrer">
              <ExternalLink size={16} /> Open local browser
            </a>
            <button type="button" className="btn-secondary" onClick={() => copy(access.local_url || "", "local")}>
              {copied === "local" ? <Check size={16} /> : <Copy size={16} />} Copy local URL
            </button>
          </div>
          <button className="btn-secondary">Save port tip</button>
        </form>
      );
    }
    if (active === "lan") {
      return (
        <form className="space-y-3" onSubmit={save}>
          <div className="rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 p-3 text-sm space-y-1">
            <div><span className="text-slate-500">Hostname:</span> <strong>{access.hostname}</strong></div>
            <div><span className="text-slate-500">Suggested:</span>{" "}
              <code className="text-xs">http://{access.hostname}:{access.port || 8787}</code>
            </div>
            <div className="text-xs text-slate-500">
              Firewall: allow inbound TCP {access.port || 8787} on this PC. Phones must be on the same Wi‑Fi.
            </div>
          </div>
          {field("launch.bind_host", "Bind host tip", "Use 0.0.0.0 so LAN devices can reach the app.")}
          <div>
            <div className="label">Phone URLs</div>
            <ul className="space-y-1 text-sm">
              {(access.lan_urls || []).map((u: string) => (
                <li key={u} className="flex items-center gap-2">
                  <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex-1 truncate">{u}/m</code>
                  <button type="button" className="btn-secondary !min-h-[36px] !px-2" onClick={() => copy(`${u}/m`, u)}>
                    {copied === u ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </li>
              ))}
              {!(access.lan_urls || []).length && <li className="text-slate-500 text-xs">No LAN IP detected yet — check Wi‑Fi.</li>}
            </ul>
          </div>
          <button className="btn-secondary">Save LAN tips</button>
        </form>
      );
    }
    if (active === "power_apps") {
      return (
        <form className="space-y-3" onSubmit={save}>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Optional companion UI. Core car wash ops work fully offline without Power Apps. OpenAPI:{" "}
            <a className="text-sky-600 underline" href="/api/docs" target="_blank" rel="noreferrer">/api/docs</a>
          </p>
          {field("powerapps.environment_url", "Environment URL", undefined, "https://org.crm.dynamics.com")}
          {field("powerapps.app_id", "App ID (optional)")}
          {field("powerapps.api_base_url", "API base URL", "Usually your LAN or public URL + /api/v1", access.api_base_url)}
          {field(
            "powerapps.cors_origins",
            "CORS origin(s)",
            "Comma-separated. Also set CARWASH_CORS_ORIGINS_EXTRA and restart for process-level CORS.",
            "https://apps.powerapps.com,https://make.powerapps.com"
          )}
          <button className="btn-primary">Save Power Apps config</button>
        </form>
      );
    }
    if (active === "sharepoint") {
      return (
        <form className="space-y-3" onSubmit={save}>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Never required for the core app. Store a site URL and optional list/library names for future sync.
          </p>
          {field("sharepoint.site_url", "Site URL", undefined, "https://tenant.sharepoint.com/sites/CarWash")}
          {field("sharepoint.list_name", "List name (optional)")}
          {field("sharepoint.library_name", "Library name (optional)")}
          {field("sharepoint.doc_library", "Document library for invoices / photos")}
          <button className="btn-primary">Save SharePoint config</button>
        </form>
      );
    }
    return (
      <form className="space-y-3" onSubmit={save}>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Set the public base URL (IIS / nginx / tunnel). QR codes and invite links will use this instead of LAN IP.
        </p>
        {field("launch.public_base_url", "Public base URL", undefined, "https://carwash.example.com")}
        <button className="btn-primary">Save custom URL</button>
      </form>
    );
  }, [active, form, access, copied, testing, data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader
        title="Launch"
        subtitle="Staff phone QR, Outlook calendar (optional), owner alerts, Power Apps & SharePoint"
      />
      {error && <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40">{error}</div>}
      {msg && <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}

      <div className="card p-4 md:p-5 mb-4 grid md:grid-cols-[200px_1fr] gap-4 items-center">
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-2xl bg-white p-3 shadow-inner border border-slate-100">
            {qrUrl ? (
              <QRCodeSVG value={qrUrl} size={160} level="M" includeMargin />
            ) : (
              <div className="h-40 w-40 grid place-items-center text-xs text-slate-400">No URL</div>
            )}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1"><Smartphone size={12} /> Scan to open mobile</div>
        </div>
        <div className="space-y-3 min-w-0">
          <h3 className="font-bold text-lg">Staff phone access</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Staff open their phone camera, scan this QR (or tap the invite link), then sign in. Works on localhost or LAN.
          </p>
          <div>
            <label className="label">Invite link</label>
            <div className="flex gap-2">
              <input className="input font-mono text-xs" readOnly value={invite} />
              <button type="button" className="btn-secondary shrink-0" onClick={() => copy(invite, "invite")}>
                {copied === "invite" ? <Check size={16} /> : <Copy size={16} />} Copy
              </button>
            </div>
          </div>
          <div>
            <label className="label">Mobile entry</label>
            <div className="flex gap-2">
              <input className="input font-mono text-xs" readOnly value={access.mobile_link || ""} />
              <a className="btn-secondary shrink-0" href={access.mobile_link || "/m"} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> Open
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 mb-4">
        {CARDS.map((c) => {
          const plat = data?.platforms?.[c.key] || (c.key === "outlook_calendar" ? data?.platforms?.outlook : null);
          const Icon = c.icon;
          const selected = active === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActive(c.key)}
              className={`card p-4 text-left transition hover:shadow-md ${
                selected ? "ring-2 ring-[var(--brand-accent)] border-transparent" : ""
              } ${c.highlight ? "bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/40 dark:to-slate-900" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sky-600">
                  <Icon size={20} />
                </div>
                {statusBadge(plat?.status)}
              </div>
              <div className="mt-3 font-semibold">{c.title}</div>
              <p className="mt-1 text-sm text-slate-500">{c.blurb}</p>
              {plat?.message && <p className="mt-2 text-xs text-slate-400">{plat.message}</p>}
            </button>
          );
        })}
      </div>

      {active && (
        <div className="card p-4 md:p-5">
          <h3 className="font-bold mb-3 text-lg">{CARDS.find((c) => c.key === active)?.title}</h3>
          {wizard}
        </div>
      )}
    </div>
  );
}
