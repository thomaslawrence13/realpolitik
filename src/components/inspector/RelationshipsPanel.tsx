import { useEffect, useMemo, useState } from 'react';
import type { RelationshipDimensionKey, SimulatedCountry } from '../../types';
import { formatTitle } from '../inspectorUtils';
import {
  EmptyState,
  SmallBar,
  getDominantRelationshipDimension,
  isRelationshipStale,
  relationshipDimensionMeta,
  relationshipTagBorderAlpha,
  relationshipTagBackgroundAlpha,
} from './shared';

export function RelationshipsPanel({
  selected,
  onSelectRelated,
}: {
  selected: SimulatedCountry;
  onSelectRelated: (mapName: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'tensionDesc' | 'updatedDesc' | 'nameAsc'>('tensionDesc');
  const [focus, setFocus] = useState<'all' | 'stale' | RelationshipDimensionKey>('all');

  const relationshipEntries = useMemo(
    () =>
      selected.profile.relationships.map((relationship) => ({
        relationship,
        dominantDimension: getDominantRelationshipDimension(relationship),
        stale: isRelationshipStale(relationship),
        updatedAtMs: Date.parse(relationship.dataQuality?.computedLastUpdated ?? relationship.lastUpdated),
      })),
    [selected.profile.relationships],
  );

  const staleCount = useMemo(
    () => relationshipEntries.filter((entry) => entry.stale).length,
    [relationshipEntries],
  );
  const strongestRelationship = useMemo(
    () =>
      relationshipEntries.reduce<(typeof relationshipEntries)[number] | null>(
        (strongest, entry) =>
          !strongest || entry.relationship.tension > strongest.relationship.tension ? entry : strongest,
        null,
      ),
    [relationshipEntries],
  );

  const visibleRelationships = useMemo(() => {
    const query = search.trim().toLowerCase();
    const compareEntries = (
      left: (typeof relationshipEntries)[number],
      right: (typeof relationshipEntries)[number],
    ) => {
      if (sortMode === 'updatedDesc') {
        return right.updatedAtMs - left.updatedAtMs;
      }
      if (sortMode === 'nameAsc') {
        return left.relationship.displayName.localeCompare(right.relationship.displayName);
      }
      const tensionDelta = right.relationship.tension - left.relationship.tension;
      if (tensionDelta !== 0) return tensionDelta;
      const hostilityDelta = right.relationship.hostility - left.relationship.hostility;
      if (hostilityDelta !== 0) return hostilityDelta;
      return left.relationship.displayName.localeCompare(right.relationship.displayName);
    };

    return relationshipEntries
      .filter(({ relationship, dominantDimension, stale }) => {
        const matchesQuery =
          query.length === 0 ||
          relationship.displayName.toLowerCase().includes(query) ||
          relationship.notes.toLowerCase().includes(query);
        if (!matchesQuery) return false;
        if (focus === 'all') return true;
        if (focus === 'stale') return stale;
        return dominantDimension.key === focus;
      })
      .slice()
      .sort(compareEntries);
  }, [focus, relationshipEntries, search, sortMode]);

  useEffect(() => {
    setSearch('');
    setSortMode('tensionDesc');
    setFocus('all');
  }, [selected.profile.id]);

  if (selected.profile.relationships.length === 0) {
    return <EmptyState title="No relationships logged" body="This country has no parameterized edges yet." />;
  }

  return (
    <div className="panel-stack">
      <div className="relationship-summary-grid">
        <div className="relationship-summary-card">
          <span>Logged edges</span>
          <strong>{selected.profile.relationships.length}</strong>
        </div>
        <div className="relationship-summary-card">
          <span>Stale edges</span>
          <strong>{staleCount}</strong>
        </div>
        <div className="relationship-summary-card">
          <span>Highest tension</span>
          <strong>{strongestRelationship?.relationship.displayName ?? '—'}</strong>
        </div>
      </div>

      <div className="relationship-toolbar">
        <label className="relationship-search">
          <span className="sr-only">Search relationships</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search partner or note…"
            spellCheck={false}
          />
        </label>
        <label className="relationship-sort">
          <span>Sort</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
            <option value="tensionDesc">Highest tension</option>
            <option value="updatedDesc">Most recent</option>
            <option value="nameAsc">Name</option>
          </select>
        </label>
      </div>

      <div className="relationship-filter-bar">
        <button
          type="button"
          className={`relationship-filter-chip ${focus === 'all' ? 'relationship-filter-chip-active' : ''}`}
          onClick={() => setFocus('all')}
        >
          All
        </button>
        {relationshipDimensionMeta.map((dimension) => (
          <button
            key={dimension.key}
            type="button"
            className={`relationship-filter-chip ${focus === dimension.key ? 'relationship-filter-chip-active' : ''}`}
            onClick={() => setFocus(dimension.key)}
          >
            {dimension.label}
          </button>
        ))}
        <button
          type="button"
          className={`relationship-filter-chip ${focus === 'stale' ? 'relationship-filter-chip-active' : ''}`}
          onClick={() => setFocus('stale')}
        >
          Stale
        </button>
        <span className="relationship-visible-count">
          {visibleRelationships.length} shown
        </span>
      </div>

      {visibleRelationships.length === 0 ? (
        <EmptyState title="No matching relationships" body="Try clearing the search or switching the active relationship filter." />
      ) : (
        <div className="relationship-list">
          {visibleRelationships.map(({ relationship, dominantDimension, stale }) => {
            return (
              <article key={relationship.countryId} className="relationship-card">
                <header>
                  <div className="relationship-header-main">
                    <button
                      type="button"
                      className="relationship-name"
                      onClick={() => onSelectRelated(relationship.mapName)}
                    >
                      {relationship.displayName}
                    </button>
                    <div className="relationship-tags">
                      <span
                        className="relationship-dominant-tag"
                        style={{
                          color: dominantDimension.color,
                          borderColor: `${dominantDimension.color}${relationshipTagBorderAlpha}`,
                          background: `${dominantDimension.color}${relationshipTagBackgroundAlpha}`,
                        }}
                      >
                        {dominantDimension.label}
                      </span>
                      {stale && <span className="relationship-stale-tag">Stale</span>}
                    </div>
                  </div>
                  <span className="relationship-date">
                    {relationship.dataQuality?.computedLastUpdated ?? relationship.lastUpdated}
                  </span>
                </header>
                <div className="relationship-bars">
                  {relationshipDimensionMeta.map((dimension) => (
                    <SmallBar
                      key={dimension.key}
                      label={dimension.shortLabel}
                      value={relationship[dimension.key]}
                      color={dimension.color}
                      emphasized={focus === dimension.key || dominantDimension.key === dimension.key}
                    />
                  ))}
                </div>
                <p className="relationship-notes">{relationship.notes}</p>
                {relationship.dataQuality && relationship.dataQuality.dimensions.length > 0 && (
                  <ul className="kv-list kv-list-sm">
                    {relationship.dataQuality.dimensions.map((dim) => (
                      <li key={dim.dimension}>
                        <span className="rel-dim-label">{formatTitle(dim.dimension)} · {dim.sourceId} · {dim.method}</span>
                        <strong>
                          {dim.observedAt} · {Math.round(dim.confidence * 100)}%
                          {dim.stale ? ' · stale' : ''}
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
