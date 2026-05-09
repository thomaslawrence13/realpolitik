import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Alignment, Filters, RegimeType, SimulatedCountry, Tier } from '../types';
import { Segmented, SvgIcon } from './ui';

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
  alliances: readonly string[];
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
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

type SortMode = 'riskDesc' | 'confidenceDesc' | 'nameAsc';
type GroupMode = 'none' | 'region' | 'alignment' | 'risk';

const sortOptions: ReadonlyArray<{ value: SortMode; label: string }> = [
  { value: 'riskDesc', label: 'Risk' },
  { value: 'confidenceDesc', label: 'Confidence' },
  { value: 'nameAsc', label: 'Name' },
];

const groupOptions: ReadonlyArray<{ value: GroupMode; label: string }> = [
  { value: 'region', label: 'Region' },
  { value: 'alignment', label: 'Alignment' },
  { value: 'risk', label: 'Risk tier' },
  { value: 'none', label: 'None' },
];

const defaultFilters: Filters = {
  allianceNetwork: 'all',
  tradeExposure: 'all',
  militaryTreatyLevel: 'all',
  conflictPressure: 'all',
  sanctionsExposure: 'all',
  regimeType: 'all',
  riskLevel: 'all',
};

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
  alliances,
  alignmentColor,
  alignmentLabel,
}: Props) {
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('riskDesc');
  const [groupMode, setGroupMode] = useState<GroupMode>('region');
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);

  const sorted = useMemo(() => {
    const next = [...countries];
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
      if (label === 'High') return 0;
      if (label === 'Medium') return 1;
      return 2;
    };

    return [...groups.entries()]
      .sort(([left], [right]) => {
        const rankDelta = rank(left) - rank(right);
        return rankDelta !== 0 ? rankDelta : left.localeCompare(right);
      })
      .map(([label, items]) => ({ key: label, label, items }));
  }, [alignmentLabel, groupMode, sorted]);

  const activeFilterCount = useMemo(() => {
    return (Object.keys(filters) as Array<keyof Filters>).filter(
      (key) => filters[key] !== 'all',
    ).length;
  }, [filters]);

  // Flat ordered list — used for keyboard navigation across groups.
  const allItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const idx = allItems.findIndex((c) => c.profile.mapName === selectedName);
    if (idx === -1) return;
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
        <div className="rail-header">
          <div>
            <h2 className="rail-title">Countries</h2>
            <p className="rail-meta">
              {countries.length} of {totalCount} shown
            </p>
          </div>
        </div>

        <div className="rail-search">
          <span className="rail-search-icon" aria-hidden>
            <SvgIcon.Search />
          </span>
          <input
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
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              <SvgIcon.X />
            </button>
          )}
        </div>

        <div className="rail-organize">
          <label className="rail-organize-field">
            <span>Sort</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="rail-organize-field">
            <span>Group</span>
            <select value={groupMode} onChange={(event) => setGroupMode(event.target.value as GroupMode)}>
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
            <span>Filters</span>
            <span className="rail-filters-count">
              {activeFilterCount > 0 && <em>{activeFilterCount}</em>}
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
                onClick={() => onFiltersChange(defaultFilters)}
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
                    <span
                      className="country-dot"
                      style={{ background: alignmentColor[country.alignment] }}
                      aria-hidden
                    />
                    <span className="country-text">
                      <strong className="country-name">{country.profile.displayName}</strong>
                      <span className="country-sub">
                        {formatTitle(country.profile.region)} · {alignmentLabel[country.alignment]}
                      </span>
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

function getRiskTier(value: number): Tier {
  if (value >= 65) return 'high';
  if (value >= 40) return 'medium';
  return 'low';
}
