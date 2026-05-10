import { useEffect, useState } from 'react';

type Props = {
  message: string;
  durationMs: number;
  onUndo: () => void;
  onDismiss: () => void;
};

export function UndoToast({ message, durationMs, onUndo, onDismiss }: Props) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        rafId = requestAnimationFrame(tick);
      }
    };
    let rafId = requestAnimationFrame(tick);
    const dismissId = window.setTimeout(onDismiss, durationMs);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(dismissId);
    };
  }, [durationMs, onDismiss]);

  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <span className="undo-toast-message">{message}</span>
      <button type="button" className="undo-toast-action" onClick={onUndo}>
        Undo
      </button>
      <span className="undo-toast-progress" style={{ width: `${progress}%` }} aria-hidden />
    </div>
  );
}
