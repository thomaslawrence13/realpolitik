import { useMemo, useState } from 'react';
import type { EventCategory, EventTemplate } from '../../types';
import { SvgIcon } from '../ui';
import type { EventFeedItem } from './types';

const INPUT_LABELS: Record<string, string> = {
  sanctionShock: 'Sanctions',
  treatyShift: 'Treaty',
  electionVolatility: 'Election',
  invasionPressure: 'Invasion',
  coupRisk: 'Coup',
};

export function EventsPanel({
  events,
  activeEventIds,
  onApply,
  onRemove,
  onApplyMany,
  onClearAll,
  scenarioFeed,
}: {
  events: EventTemplate[];
  activeEventIds: string[];
  onApply: (id: string) => void;
  onRemove: (id: string) => void;
  onApplyMany: (ids: string[]) => void;
  onClearAll: () => void;
  scenarioFeed: EventFeedItem[];
}) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | EventCategory>('all');
  const [search, setSearch] = useState('');

  // O(1) active-event lookup for the potentially large event grid.
  const activeSet = useMemo(() => new Set(activeEventIds), [activeEventIds]);

  const categories: Array<{ value: 'all' | EventCategory; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'military', label: 'Military' },
    { value: 'economic', label: 'Economic' },
    { value: 'political', label: 'Political' },
    { value: 'compound', label: 'Compound' },
  ];

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      if (categoryFilter !== 'all' && event.category !== categoryFilter) return false;
      if (query.length === 0) return true;
      return (
        event.name.toLowerCase().includes(query) ||
        event.summary.toLowerCase().includes(query) ||
        event.regionTags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [categoryFilter, events, search]);

  const formatDelta = (key: string, value: number) => {
    const signed = value > 0 ? `+${value}` : `${value}`;
    return `${INPUT_LABELS[key] ?? key} ${signed}`;
  };

  const visibleInactiveIds = useMemo(
    () => visible.filter((event) => !activeSet.has(event.id)).map((event) => event.id),
    [activeSet, visible],
  );

  return (
    <div className="events-panel">
      <div className="events-filter-bar">
        {categories.map((cat) => (
          <button
            key={cat.value}
            type="button"
            className={`event-cat-chip ${categoryFilter === cat.value ? 'event-cat-chip-active' : ''}`}
            onClick={() => setCategoryFilter(cat.value)}
          >
            {cat.label}
          </button>
        ))}
        {activeEventIds.length > 0 && (
          <span className="events-active-badge">{activeEventIds.length} active</span>
        )}
      </div>

      <div className="events-bulk-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onApplyMany(visibleInactiveIds)}
          disabled={visibleInactiveIds.length === 0}
          title="Apply all currently visible events that are not active"
        >
          Apply visible ({visibleInactiveIds.length})
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onClearAll}
          disabled={activeEventIds.length === 0}
          title="Clear all currently active events"
        >
          Clear active ({activeEventIds.length})
        </button>
      </div>

      <label className="events-search">
        <span className="sr-only">Search events</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, region, or keyword…"
          spellCheck={false}
        />
        {search.length > 0 && (
          <button type="button" className="events-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
            <SvgIcon.X />
          </button>
        )}
      </label>

      {visible.length === 0 ? (
        <p className="movers-empty">No events match — try adjusting your search or category filter.</p>
      ) : (
        <div className="events-grid">
          {visible.map((event) => {
            const isActive = activeSet.has(event.id);
            const deltaItems = (Object.entries(event.inputs) as Array<[string, number]>).filter(
              ([, v]) => v !== 0,
            );
            return (
              <article key={event.id} className={`event-card ${isActive ? 'event-card-active' : ''}`}>
                <header className="event-card-header">
                  <span className={`event-category-tag event-category-${event.category}`}>
                    {event.category}
                  </span>
                  <button
                    type="button"
                    className={`btn ${isActive ? 'btn-ghost event-btn-remove' : 'btn-primary'} btn-sm`}
                    onClick={() => (isActive ? onRemove(event.id) : onApply(event.id))}
                  >
                    {isActive ? 'Remove' : 'Apply'}
                  </button>
                </header>
                <strong className="event-card-name">{event.name}</strong>
                <p className="event-card-summary">{event.summary}</p>
                <div className="event-deltas">
                  {deltaItems.map(([key, value]) => (
                    <span key={key} className={`event-delta ${value > 0 ? 'event-delta-up' : 'event-delta-down'}`}>
                      {formatDelta(key, value)}
                    </span>
                  ))}
                </div>
                {event.regionTags.length > 0 && (
                  <div className="event-regions">
                    {event.regionTags.map((tag) => (
                      <span key={tag} className="event-region-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {scenarioFeed.length > 0 && (
        <div className="events-impact-section">
          <h3 className="events-impact-title">Analysis impact — top pressures</h3>
          <div className="feed">
            {scenarioFeed.map((item) => (
              <article key={item.title} className={`feed-item feed-item-${item.tone}`}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
