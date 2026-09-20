import PageHeader from "../components/ui/PageHeader";
import { useEasyMode } from "../hooks/useEasyMode";

export default function HelpPage() {
  const { easyMode, setEasyMode, highContrast, setHighContrast } = useEasyMode();

  return (
    <div>
      <PageHeader
        title="Help"
        subtitle={easyMode ? "Simple tips for daily work" : "Quick guidance for local-first operation"}
      />

      {easyMode ? (
        <div className="space-y-4 max-w-2xl">
          <div className="card p-5 space-y-3 text-base">
            <h2 className="text-xl font-bold">Simple mode tips</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>Book a wash</strong> — tap Book, fill the form, then tap <em>Yes, book it</em>.</li>
              <li><strong>Queue</strong> — see cars waiting and move them along.</li>
              <li><strong>Bays</strong> — green means <em>Bay free</em>, orange means <em>Bay busy</em>.</li>
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
            <li>Add customers and vehicles.</li>
            <li>Create a booking, check in, move wash stages on the Live Queue.</li>
            <li>Record payment and print/download the receipt PDF.</li>
            <li>Review Dashboard KPIs and Reports, then create a Backup.</li>
          </ol>
          <p>
            <strong>Simple mode</strong> (Easy Mode) enlarges text and buttons for accessibility. Available to <em>every</em> role, including Owner and Manager.
            Toggle from the header or login screen (&quot;Simple mode (larger text)&quot;). Preference is saved per user.
          </p>
          <p>Default URL: <code>http://localhost:8787</code>. Data folder: <code>./data</code> in portable mode.</p>
          <button type="button" className="mode-toggle border-2 border-emerald-600 bg-emerald-50 text-emerald-900" onClick={() => setEasyMode(true)}>
            Turn on Simple mode
          </button>
        </div>
      )}
    </div>
  );
}
