import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject } from 'react';
import type { Alignment, Filters, RegimeType, SimulatedCountry, Tier } from '../types';
import { Segmented, SvgIcon } from './ui';
import { summarizeCountryTrust, TrustTag } from './provenance';
import { getRiskTier } from '../simulation';

type Props = {
  open: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  countries: SimulatedCountry[];
  totalCount: number;
  selectedName: string;
  onSelect: (name: string) => void;
  filters: Filters;
  onFiltersChange: (next: Filters) => void;
  onClearSearch: () => void;
  onResetFilters: () => void;
  alliances: readonly string[];
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
  searchInputRef?: MutableRefObject<HTMLInputElement | null>;
};

const tierOptions = [
  { value: 'all' as const, label: 'All' },
  { value: 'low' as const, label: 'Low' },
  { value: 'medium' as const, label: 'Med' },
  { value: 'high' as const, label: 'High' },
];

const regimeOptions: ReadonlyArray<{ value: 'all' | RegimeType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'democracy', label: 'Dem' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'authoritarian', label: 'Auth' },
];

type SortMode = 'riskDesc' | 'confidenceDesc' | 'coverageDesc' | 'nameAsc';
type GroupMode = 'none' | 'region' | 'alignment' | 'risk';

const sortOptions: ReadonlyArray<{ value: SortMode; label: string }> = [
  { value: 'coverageDesc', label: 'Coverage' },
  { value: 'riskDesc', label: 'Pressure' },
  { value: 'confidenceDesc', label: 'Confidence' },
  { value: 'nameAsc', label: 'Name' },
];

const groupOptions: ReadonlyArray<{ value: GroupMode; label: string }> = [
  { value: 'region', label: 'Region' },
  { value: 'alignment', label: 'Alignment' },
  { value: 'risk', label: 'Risk tier' },
  { value: 'none', label: 'None' },
];

const RISK_GROUP_RANK = {
  high: 0,
  medium: 1,
  low: 2,
} as const;

const formatTitle = (value: string) =>
  value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);

export function LeftRail({
  open,
  search,
  onSearchChange,
  countries,
  totalCount,
  selectedName,
  onSelect,
  filters,
  onFiltersChange,
  onClearSearch,
  onResetFilters,
  alliances,
  alignmentColor,
  alignmentLabel,
  searchInputRef,
}: Props) {
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('coverageDesc');
  const [groupMode, setGroupMode] = useState<GroupMode>('region');
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);

  const sorted = useMemo(() => {
    const next = [...countries];
    if (sortMode === 'coverageDesc') {
      next.sort((a, b) => {
        const delta = b.profile.sourceCoverage - a.profile.sourceCoverage;
        return delta !== 0 ? delta : a.profile.displayName.localeCompare(b.profile.displayName);
      });
      return next;
    }
    if (sortMode === 'riskDesc') {
      next.sort((a, b) => {
        const riskDelta = b.risk - a.risk;
        return riskDelta !== 0 ? riskDelta : a.profile.displayName.localeCompare(b.profile.displayName);
      });
      return next;
    }
    if (sortMode === 'confidenceDesc') {
      next.sort((a, b) => {
        const confidenceDelta = b.confidence - a.confidence;
        return confidenceDelta !== 0
          ? confidenceDelta
          : a.profile.displayName.localeCompare(b.profile.displayName);
      });
      return next;
    }
    next.sort((a, b) => a.profile.displayName.localeCompare(b.profile.displayName));
    return next;
  }, [countries, sortMode]);

  const grouped = useMemo(() => {
    if (groupMode === 'none') {
      return [{ key: 'all', label: '', items: sorted }];
    }

    const groups = new Map<string, typeof sorted>();
    sorted.forEach((country) => {
      const key =
        groupMode === 'region'
          ? formatTitle(country.profile.region)
          : groupMode === 'alignment'
            ? alignmentLabel[country.alignment]
            : formatTitle(getRiskTier(country.risk));

      const existing = groups.get(key);
      if (existing) {
        existing.push(country);
      } else {
        groups.set(key, [country]);
      }
    });

    const rank = (label: string) => {
      if (groupMode !== 'risk') return 0;
      if (label === 'High') return RISK_GROUP_RANK.high;
      if (label === 'Medium') return RISK_GROUP_RANK.medium;
      return RISK_GROUP_RANK.low;
    };

    return [...groups.entries()]
      .sort(([left], [right]) => {
        const rankDelta = rank(left) - rank(right);
        return rankDelta !== 0 ? rankDelta : left.localeCompare(right);
      })
      .map(([label, items]) => ({ key: label, label, items }));
  }, [alignmentLabel, groupMode, sorted]);

  const activeFilterCount = useMemo(() => {
    // Count non-'all' filter values without allocating a keys array.
    let count = 0;
    if (filters.allianceNetwork !== 'all') count++;
    if (filters.tradeExposure !== 'all') count++;
    if (filters.militaryTreatyLevel !== 'all') count++;
    if (filters.conflictPressure !== 'all') count++;
    if (filters.sanctionsExposure !== 'all') count++;
    if (filters.regimeType !== 'all') count++;
    if (filters.riskLevel !== 'all') count++;
    return count;
  }, [filters]);

  // Flat ordered list — used for keyboard navigation across groups.
  const allItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const idx = allItems.findIndex((c) => c.profile.mapName === selectedName);
    if (idx === -1) {
      if (allItems.length === 0) return;
      onSelect(event.key === 'ArrowDown' ? allItems[0].profile.mapName : allItems[allItems.length - 1].profile.mapName);
      return;
    }
    if (event.key === 'ArrowDown' && idx < allItems.length - 1) {
      onSelect(allItems[idx + 1].profile.mapName);
    } else if (event.key === 'ArrowUp' && idx > 0) {
      onSelect(allItems[idx - 1].profile.mapName);
    }
  };

  const handleTier = <K extends keyof Filters>(key: K, value: 'all' | Tier) => {
    onFiltersChange({ ...filters, [key]: value as Filters[K] });
  };

  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedName]);

  return (
    <aside className="rail" aria-label="Country browser" aria-hidden={!open} {...(!open && { inert: true })}>
      <div className="rail-controls">
        <div className="rail-search">
          <span className="rail-search-icon" aria-hidden>
            <SvgIcon.Search />
          </span>
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            placeholder="Search country or region…"
            onChange={(event) => onSearchChange(event.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          {search.length > 0 && (
            <button
              type="button"
              className="rail-search-clear"
              onClick={onClearSearch}
              aria-label="Clear search"
            >
              <SvgIcon.X />
            </button>
          )}
          <span className="rail-search-count" aria-live="polite">
            {countries.length} / {totalCount}
          </span>
        </div>

        <div className="rail-organize">
          <label className="rail-organize-field rail-organize-inline">
            <span aria-hidden>↕</span>
            <select aria-label="Sort countries" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="rail-organize-field rail-organize-inline">
            <span aria-hidden>⊞</span>
            <select aria-label="Group countries" value={groupMode} onChange={(event) => setGroupMode(event.target.value as GroupMode)}>
              {groupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={`rail-filters ${filtersExpanded ? 'is-open' : 'is-closed'}`}>
          <button
            type="button"
            className="rail-filters-toggle"
            onClick={() => setFiltersExpanded((value) => !value)}
          >
            <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
            <span className="rail-filters-count">
              <SvgIcon.Chevron dir={filtersExpanded ? 'up' : 'down'} />
            </span>
          </button>
          {filtersExpanded && (
            <div className="rail-filters-body">
            <div className="filter-row">
              <label className="filter-row-label" htmlFor="rail-alliance">
                Alliance
              </label>
              <select
                id="rail-alliance"
                className="filter-select"
                value={filters.allianceNetwork}
                onChange={(event) =>
                  onFiltersChange({ ...filters, allianceNetwork: event.target.value })
                }
              >
                <option value="all">All networks</option>
                {alliances.map((alliance) => (
                  <option key={alliance} value={alliance}>
                    {alliance}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-row">
              <label className="filter-row-label">Regime</label>
              <Segmented
                value={filters.regimeType}
                options={regimeOptions}
                onChange={(value) => onFiltersChange({ ...filters, regimeType: value })}
              />
            </div>

            <div className="filter-row">
              <label className="filter-row-label">Risk</label>
              <Segmented
                value={filters.riskLevel}
                options={tierOptions}
                onChange={(value) => handleTier('riskLevel', value)}
              />
            </div>

            <div className="filter-row">
              <label className="filter-row-label">Trade exposure</label>
              <Segmented
                value={filters.tradeExposure}
                options={tierOptions}
                onChange={(value) => handleTier('tradeExposure', value)}
              />
            </div>

            <div className="filter-row">
              <label className="filter-row-label">Treaties</label>
              <Segmented
                value={filters.militaryTreatyLevel}
                options={tierOptions}
                onChange={(value) => handleTier('militaryTreatyLevel', value)}
              />
            </div>

            <div className="filter-row">
              <label className="filter-row-label">Conflict</label>
              <Segmented
                value={filters.conflictPressure}
                options={tierOptions}
                onChange={(value) => handleTier('conflictPressure', value)}
              />
            </div>

            <div className="filter-row">
              <label className="filter-row-label">Sanctions</label>
              <Segmented
                value={filters.sanctionsExposure}
                options={tierOptions}
                onChange={(value) => handleTier('sanctionsExposure', value)}
              />
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                className="filter-reset"
                onClick={onResetFilters}
              >
                <SvgIcon.Reset />
                <span>Reset all filters</span>
              </button>
            )}
            </div>
          )}
        </div>
      </div>

      <div
        className="rail-list"
        role="listbox"
        aria-label="Filtered countries"
        tabIndex={0}
        onKeyDown={handleListKeyDown}
      >
        {allItems.length === 0 ? (
          <div className="rail-empty">
            <strong>No matches</strong>
            <p>Try clearing a filter or searching for a different country.</p>
            {(search.length > 0 || activeFilterCount > 0) && (
              <div className="rail-empty-actions">
                {search.length > 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={onClearSearch}>
                    Clear search
                  </button>
                )}
                {activeFilterCount > 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={onResetFilters}>
                    Reset filters
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          grouped.map((group) => (
            <section key={group.key} className="country-group">
              {groupMode !== 'none' && (
                <header className="country-group-header">
                  <strong>{group.label}</strong>
                  <span>{group.items.length}</span>
                </header>
              )}
              {group.items.map((country) => {
                const isSelected = country.profile.mapName === selectedName;
                const trust = summarizeCountryTrust(country.profile);
                return (
                  <button
                    key={country.profile.id}
                    ref={isSelected ? selectedItemRef : null}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`country-item ${isSelected ? 'country-item-active' : ''}`}
                    onClick={() => onSelect(country.profile.mapName)}
                  >
                    <span className="country-text">
                        <span className="country-name-row">
                          <strong className="country-name">{country.profile.displayName}</strong>
                          <TrustTag summary={trust} />
                        </span>
                      <span className="country-sub">
                        {formatTitle(country.profile.region)} · {alignmentLabel[country.alignment]}
                      </span>
                        <span className="country-trust-detail">{trust.detail}</span>
                    </span>
                    <span className={`country-risk risk-${getRiskTier(country.risk)}`}>
                      {country.risk}%
                    </span>
                  </button>
                );
              })}
            </section>
          ))
        )}
      </div>
    </aside>
  );
}
