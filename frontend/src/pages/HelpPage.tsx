import PageHeader from "../components/ui/PageHeader";
import { useEasyMode } from "../hooks/useEasyMode";

export default function HelpPage() {
  const { easyMode, setEasyMode, highContrast, setHighContrast, canAccessSettings, canManageUsers } = useEasyMode();
  const isManager = canAccessSettings || canManageUsers;

  return (
    <div>
      <PageHeader
        title="Help"
        subtitle={easyMode ? "Simple tips for daily work" : "Quick guidance for local-first operation"}
      />

      {isManager && (
        <div className="card p-5 mb-4 max-w-2xl space-y-2 border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/30">
          <h2 className="text-lg font-bold text-sky-900 dark:text-sky-100">For managers</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Full plain-English guide: <strong>docs/MANAGER_README.txt</strong> in the app folder
            (where the software is installed). Covers local vs LAN vs domain, customer portal,
            staff invites, Outlook, backups, and FAQ.
          </p>
          <ul className="text-sm list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
            <li>Staff phones: <strong>Launch</strong> → scan QR → <code>/m</code></li>
            <li>Invite staff: <strong>Admin → Users → Invite staff</strong> (no open signup)</li>
            <li>Customers: <code>/portal/register</code> — they never see Settings</li>
            <li>Live bays on Home refresh automatically (green / amber / blue)</li>
          </ul>
        </div>
      )}

      {easyMode ? (
        <div className="space-y-4 max-w-2xl">
          <div className="card p-5 space-y-3 text-base">
            <h2 className="text-xl font-bold">Simple mode tips</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>Book a wash</strong> — tap Book, fill the form, then tap <em>Yes, book it</em>.</li>
              <li><strong>Queue</strong> — see cars waiting and move them along. Tap <em>Done</em> when finished.</li>
              <li><strong>Bays</strong> — green means <em>Bay free</em>, orange means <em>Bay busy</em>, blue means <em>Ready</em>.</li>
              <li><strong>Switch modes</strong> — use the big <em>Full mode</em> / <em>Simple mode</em> button in the header anytime.</li>
            </ol>
            <p className="text-slate-600 dark:text-slate-300">
              Managers: in Simple mode you still get large buttons for <strong>Prices</strong>, <strong>Today&apos;s money</strong>, <strong>Staff</strong>, and <strong>Settings</strong>.
            </p>
          </div>
          <div className="card p-5 space-y-3">
            <h3 className="font-bold text-lg">Display</h3>
            <button type="button" className="mode-toggle w-full border-2 border-slate-300" onClick={() => setEasyMode(false)}>
              Switch to Full mode
            </button>
            <label className="flex items-center gap-3 text-base cursor-pointer">
              <input type="checkbox" className="h-5 w-5" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} />
              High contrast (stronger colours)
            </label>
          </div>
        </div>
      ) : (
        <div className="card p-5 prose dark:prose-invert max-w-none space-y-3 text-sm">
          <p>This platform runs fully offline after install. Microsoft 365, SharePoint, Power Apps, email/SMS and card gateways are optional adapters and start as <strong>Not configured</strong>.</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Complete first-run setup (admin, company, branch).</li>
            <li>Find cars by <strong>ticket</strong> (T-0042), customer name/phone, or description (White Polo) — plates are optional.</li>
            <li>Invite staff via Admin (controlled links). Customers sign up at <code>/portal</code>.</li>
            <li>Create a booking, check in, move wash stages on the Live Queue. Watch <strong>Live bays</strong> on Home.</li>
            <li>Record payment and print/download the receipt PDF.</li>
            <li>Review Dashboard KPIs and Reports, then create a Backup.</li>
          </ol>
          <p>
            <strong>Simple mode</strong> (Easy Mode) enlarges text and buttons for accessibility. Available to <em>every</em> role, including Owner and Manager.
            Toggle from the header or login screen (&quot;Simple mode (larger text)&quot;). Preference is saved per user.
          </p>
          <p>Default URL: <code>http://localhost:8787</code>. Data folder: <code>./data</code> in portable mode. Manager guide: <code>docs/MANAGER_README.txt</code>.</p>
          <button type="button" className="mode-toggle border-2 border-emerald-600 bg-emerald-50 text-emerald-900" onClick={() => setEasyMode(true)}>
            Turn on Simple mode
          </button>
        </div>
      )}
    </div>
  );
}
