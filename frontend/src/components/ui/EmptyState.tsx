import { Inbox } from "lucide-react";

export default function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="card p-10 md:p-14 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
        <Inbox size={22} />
      </div>
      <div className="font-semibold text-slate-800 dark:text-slate-100">{title}</div>
      {hint && <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
