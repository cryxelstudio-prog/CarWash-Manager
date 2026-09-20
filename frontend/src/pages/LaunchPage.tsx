import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Monitor, Wifi, AppWindow, Share2, Globe, Copy, Check, ExternalLink, Smartphone,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { api, ApiError } from "../lib/api";

type PlatformKey = "local" | "lan" | "power_apps" | "sharepoint" | "custom";

const CARDS: { key: PlatformKey; title: string; blurb: string; icon: typeof Monitor }[] = [
  { key: "local", title: "Local / This PC", blurb: "Run on the laptop — open browser + staff QR", icon: Monitor },
  { key: "lan", title: "LAN / Company Wi‑Fi", blurb: "Phones on the same network scan a QR to log in", icon: Wifi },
  { key: "power_apps", title: "Power Apps", blurb: "Custom connector via OpenAPI — optional", icon: AppWindow },
  { key: "sharepoint", title: "SharePoint", blurb: "Optional site / library for invoices & photos", icon: Share2 },
  { key: "custom", title: "Self-hosted / Custom URL", blurb: "Public or reverse-proxy base URL for QR & links", icon: Globe },
];

function statusBadge(status?: string) {
  const ok = status === "CONFIGURED";
  return (
    <span className={`badge ${ok ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"}`}>
      {ok ? "Configured" : "Not configured"}
    </span>
  );
}

export default function LaunchPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [active, setActive] = useState<PlatformKey | null>("lan");
  const [form, setForm] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState("");

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
    const plat = data.platforms?.[active];
    const fields = { ...(plat?.fields || {}) };
    if (active === "local" || active === "lan") {
      fields["launch.port"] = String(data.access?.port || data.settings?.["launch.port"] || "8787");
      fields["launch.bind_host"] = data.settings?.["launch.bind_host"] || "0.0.0.0";
    }
    if (active === "custom") {
      fields["launch.public_base_url"] = data.settings?.["launch.public_base_url"] || "";
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

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!active) return;
    setError("");
    setMsg("");
    try {
      const updated = await api<any>(`/api/v1/launch/${active}`, {
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

  const field = (key: string, label: string, hint?: string, placeholder?: string) => (
    <div key={key}>
      <label className="label">{label}</label>
      <input
        className="input"
        value={form[key] || ""}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );

  const wizard = useMemo(() => {
    if (!active) return null;
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
          {field("powerapps.api_base_url", "API base URL", "Usually https://<host>/api/v1", access.api_base_url)}
          {field(
            "powerapps.cors_origins",
            "CORS origin(s)",
            "Comma-separated. Also set CARWASH_CORS_ORIGINS_EXTRA and restart for process-level CORS.",
            "https://apps.powerapps.com,https://make.powerapps.com"
          )}
          <div className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-3">
            Connector notes: use session cookie + <code>X-CSRF-Token</code> after <code>/api/v1/auth/login</code>.
            See <code>docs/POWER_APPS_INTEGRATION.txt</code> and <code>docs/LAUNCH_GUIDE.txt</code>.
          </div>
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
  }, [active, form, access, copied]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader
        title="Launch"
        subtitle="Staff phone QR, LAN access, Power Apps & SharePoint hosting options"
      />
      {error && <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40">{error}</div>}
      {msg && <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}

      {/* Staff access strip */}
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
          const plat = data?.platforms?.[c.key];
          const Icon = c.icon;
          const selected = active === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActive(c.key)}
              className={`card p-4 text-left transition hover:shadow-md ${selected ? "ring-2 ring-[var(--brand-accent)] border-transparent" : ""}`}
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
          <h3 className="font-bold mb-3">{CARDS.find((c) => c.key === active)?.title}</h3>
          {wizard}
        </div>
      )}
    </div>
  );
}
