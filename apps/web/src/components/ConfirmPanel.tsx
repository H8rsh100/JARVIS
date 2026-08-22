"use client";

type Props = {
  title: string;
  detail?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Stark-style in-HUD confirm (replaces window.confirm). */
export function ConfirmPanel({
  title,
  detail,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
      <div className="panel-glass relative w-full max-w-md overflow-hidden rounded-2xl border border-signal/35 px-5 py-5 text-left shadow-glow">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-copper">
          Stark protocol · confirm
        </p>
        <h2 className="mt-2 text-lg font-semibold tracking-wide text-white">
          {title}
        </h2>
        {detail ? (
          <p className="mt-2 text-sm leading-relaxed text-mist/90">{detail}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-mist hover:border-white/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-copper px-4 py-2 text-sm font-medium text-ink"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
