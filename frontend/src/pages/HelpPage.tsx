import PageHeader from "../components/ui/PageHeader";

export default function HelpPage() {
  return (
    <div>
      <PageHeader title="Help" subtitle="Quick guidance for local-first operation" />
      <div className="card p-5 prose dark:prose-invert max-w-none space-y-3 text-sm">
        <p>This platform runs fully offline after install. Microsoft 365, SharePoint, Power Apps, email/SMS and card gateways are optional adapters and start as <strong>Not configured</strong>.</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Complete first-run setup (admin, company, branch).</li>
          <li>Add customers and vehicles.</li>
          <li>Create a booking, check in, move wash stages on the Live Queue.</li>
          <li>Record payment and print/download the receipt PDF.</li>
          <li>Review Dashboard KPIs and Reports, then create a Backup.</li>
        </ol>
        <p>Default URL: <code>http://localhost:8787</code>. Data folder: <code>./data</code> in portable mode.</p>
      </div>
    </div>
  );
}
