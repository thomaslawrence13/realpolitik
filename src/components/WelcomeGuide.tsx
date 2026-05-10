import { useEffect, useRef } from 'react';
import { SvgIcon } from './ui';

type Props = {
  open: boolean;
  onClose: () => void;
  onFocusSearch: () => void;
  onOpenScenarioLab: () => void;
  onOpenShortcuts: () => void;
};

export function WelcomeGuide({
  open,
  onClose,
  onFocusSearch,
  onOpenScenarioLab,
  onOpenShortcuts,
}: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Welcome to Realpolitik" onClick={onClose}>
      <div className="modal-card welcome-card" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header welcome-header">
          <div>
            <h2>Welcome to Realpolitik</h2>
            <p>Explore countries, run scenarios, and compare outcomes without setup friction.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close welcome guide"
          >
            <SvgIcon.X />
          </button>
        </header>

        <div className="modal-body">
          <section className="welcome-grid">
            <article className="welcome-tip">
              <strong>Find countries faster</strong>
              <p>Use search and filters in the left rail to narrow risk hotspots quickly.</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onFocusSearch}>
                Focus country search
              </button>
            </article>
            <article className="welcome-tip">
              <strong>Stress-test assumptions</strong>
              <p>Open the Scenario Lab to apply events, tune shocks, and save alternatives.</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenScenarioLab}>
                Open Scenario Lab
              </button>
            </article>
            <article className="welcome-tip">
              <strong>Learn keyboard flow</strong>
              <p>Use shortcuts to navigate panels and iterate quickly without context switching.</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenShortcuts}>
                Open shortcuts
              </button>
            </article>
          </section>
        </div>

        <footer className="welcome-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Start exploring
          </button>
        </footer>
      </div>
    </div>
  );
}
