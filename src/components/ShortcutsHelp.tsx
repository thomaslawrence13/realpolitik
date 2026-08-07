import { useEffect, useRef } from 'react';
import { SvgIcon } from './ui';

type Shortcut = {
  keys: string[];
  description: string;
};

const SHORTCUTS: ReadonlyArray<{ group: string; entries: Shortcut[] }> = [
  {
    group: 'Panels',
    entries: [
      { keys: ['['], description: 'Toggle countries rail' },
      { keys: [']'], description: 'Toggle inspector' },
      { keys: ['\\'], description: 'Toggle analysis drawer' },
    ],
  },
  {
    group: 'Navigation',
    entries: [
      { keys: ['/'], description: 'Focus country search' },
      { keys: ['↑', '↓'], description: 'Move selection in country rail' },
    ],
  },
  {
    group: 'Drawer',
    entries: [
      { keys: ['↑', '↓'], description: 'Resize drawer (when handle focused)' },
      { keys: ['Home', 'End'], description: 'Snap drawer to min / max height' },
    ],
  },
  {
    group: 'Help',
    entries: [
      { keys: ['?'], description: 'Show / hide this help' },
      { keys: ['Esc'], description: 'Close this help' },
    ],
  },
];

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>Keyboard shortcuts</h2>
            <p>Speed up the workflow without leaving the keyboard.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close shortcuts"
          >
            <SvgIcon.X />
          </button>
        </header>
        <div className="modal-body">
          {SHORTCUTS.map((group) => (
            <section key={group.group} className="shortcuts-group">
              <h3>{group.group}</h3>
              <ul>
                {group.entries.map((entry) => (
                  <li key={entry.description}>
                    <span className="shortcut-keys">
                      {entry.keys.map((key, index) => (
                        <span key={`${key}-${index}`} className="shortcut-key">
                          {key}
                        </span>
                      ))}
                    </span>
                    <span className="shortcut-desc">{entry.description}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
