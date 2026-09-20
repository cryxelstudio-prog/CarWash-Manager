import { useState } from "react";
import Modal from "./ui/Modal";
import { useEasyMode } from "../hooks/useEasyMode";

type Props = {
  open: boolean;
  ticket?: string | null;
  vehicle?: string | null;
  onClose: () => void;
  onConfirm: (message: string) => Promise<void> | void;
};

/** Done / Mark complete flow — optional message to car owner, then confirm. */
export default function DoneCompleteModal({ open, ticket, vehicle, onClose, onConfirm }: Props) {
  const { easyMode } = useEasyMode();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm(message.trim());
      setMessage("");
      onClose();
    } catch (e: any) {
      setError(e?.message || e?.detail || "Could not mark complete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={easyMode ? "Car ready?" : "Mark wash complete"} onClose={() => !busy && onClose()}>
      <div className="space-y-4">
        <p className={`text-slate-600 dark:text-slate-300 ${easyMode ? "text-base" : "text-sm"}`}>
          {ticket ? (
            <>
              Ticket <strong className="text-slate-900 dark:text-white">{ticket}</strong>
              {vehicle ? <> · {vehicle}</> : null}
            </>
          ) : (
            "Mark this wash as done — ready for collection."
          )}
        </p>
        <div>
          <label className="label">{easyMode ? "Message to car owner (optional)" : "Message to car owner (optional)"}</label>
          <textarea
            className="input min-h-[96px]"
            rows={3}
            placeholder="e.g. Waiting at Bay 2 — ask for ticket at reception"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={busy}
          />
          <p className="mt-1 text-xs text-slate-500">
            If an email is on file, we&apos;ll send “Your car is ready” with this note.
          </p>
        </div>
        {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        <div className={`flex flex-col gap-2 ${easyMode ? "" : "sm:flex-row-reverse"}`}>
          <button
            type="button"
            className="btn-primary w-full sm:w-auto !bg-emerald-600 hover:!bg-emerald-700"
            disabled={busy}
            onClick={confirm}
          >
            {busy ? "Saving…" : easyMode ? "Yes, car is ready" : "Yes, car is ready"}
          </button>
          <button type="button" className="btn-secondary w-full sm:w-auto" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
