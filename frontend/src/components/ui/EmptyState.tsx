export default function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-10 text-center text-slate-500">
      <div className="font-medium text-slate-700 dark:text-slate-200">{title}</div>
      {hint && <p className="mt-1 text-sm">{hint}</p>}
    </div>
  );
}
