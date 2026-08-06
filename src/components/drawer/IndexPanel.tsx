import { useEffect, useMemo, useState } from 'react';
import type { RegimeType, SimulatedCountry, Tier } from '../../types';
import { summarizeCountryTrust, TrustTag } from '../provenance';
import { getRiskTier } from '../../simulation';
import { SvgIcon } from '../ui';

type IndexMetric = 'coverage' | 'confidence' | 'risk';
const maxComparisonCountries = 4;

const CSV_COLUMNS = ['Country', 'Region', 'Regime', 'Coverage%', 'Confidence%', 'Risk%', 'Relationships', 'Trust'] as const;

const exportIndexCsv = (rows: SimulatedCountry[]) => {
  // Prevent CSV formula injection by prefixing dangerous characters with a single quote
  const escape = (value: string) => {
    // If value starts with formula-inducing characters (=, +, -, @), prefix with single quote
    if (/^[=+\-@]/.test(value)) {
      value = `'${value}`;
    }
    return `"${value.replace(/"/g, '""')}"`;
  };
  const header = CSV_COLUMNS.join(',');
  const body = rows.map((country) => {
    const trust = summarizeCountryTrust(country.profile);
    return [
      escape(country.profile.displayName),
      escape(country.profile.region),
      escape(country.profile.regimeType),
      String(country.profile.sourceCoverage),
      String(country.confidence),
      String(country.risk),
      String(country.profile.relationships.length),
      escape(trust.label),
    ].join(',');
  });
  const csv = [header, ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `realpolitik-index-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export function IndexPanel({
  countries,
  onSelectCountry,
}: {
  countries: SimulatedCountry[];
  onSelectCountry: (mapName: string) => void;
}) {
  const [metric, setMetric] = useState<IndexMetric>('coverage');
  // Use a Set for O(1) selection checks; expose ordered array for rendering.
  const [selectedIdSet, setSelectedIdSet] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<'all' | string>('all');
  const [trustFilter, setTrustFilter] = useState<'all' | 'good' | 'warning' | 'bad'>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | Tier>('all');
  const [regimeFilter, setRegimeFilter] = useState<'all' | RegimeType>('all');

  const availableRegions = useMemo(
    () => [...new Set(countries.map((country) => country.profile.region))].sort((left, right) => left.localeCompare(right)),
    [countries],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return countries.filter((country) => {
      const trust = summarizeCountryTrust(country.profile);
      const matchesQuery =
        query.length === 0 ||
        country.profile.displayName.toLowerCase().includes(query) ||
        country.profile.region.toLowerCase().includes(query);
      if (!matchesQuery) return false;
      if (regionFilter !== 'all' && country.profile.region !== regionFilter) return false;
      if (trustFilter !== 'all' && trust.tone !== trustFilter) return false;
      if (riskFilter !== 'all' && getRiskTier(country.risk) !== riskFilter) return false;
      if (regimeFilter !== 'all' && country.profile.regimeType !== regimeFilter) return false;
      return true;
    });
  }, [countries, regionFilter, regimeFilter, riskFilter, search, trustFilter]);

  const ranked = useMemo(() => {
    const next = filtered.slice();
    next.sort((left, right) => {
      if (metric === 'coverage') {
        return right.profile.sourceCoverage - left.profile.sourceCoverage || left.profile.displayName.localeCompare(right.profile.displayName);
      }
      if (metric === 'confidence') {
        return right.confidence - left.confidence || left.profile.displayName.localeCompare(right.profile.displayName);
      }
      return right.risk - left.risk || left.profile.displayName.localeCompare(right.profile.displayName);
    });
    return next;
  }, [filtered, metric]);

  // Build Set of valid IDs from current ranked list.
  const rankedIdSet = useMemo(() => new Set(ranked.map((c) => c.profile.id)), [ranked]);

  const compared = useMemo(
    () =>
      [...selectedIdSet]
        .filter((id) => rankedIdSet.has(id))
        .map((countryId) => ranked.find((country) => country.profile.id === countryId))
        .filter((country): country is SimulatedCountry => Boolean(country)),
    [ranked, rankedIdSet, selectedIdSet],
  );

  const activeFilterCount = [regionFilter, trustFilter, riskFilter, regimeFilter].filter((value) => value !== 'all').length;

  useEffect(() => {
    // Prune selection when the ranked list changes.
    setSelectedIdSet((current) => {
      const pruned = new Set([...current].filter((id) => rankedIdSet.has(id)));
      return pruned.size === current.size ? current : pruned;
    });
  }, [rankedIdSet]);

  const toggleCountry = (countryId: string) => {
    setSelectedIdSet((current) => {
      const next = new Set(current);
      if (next.has(countryId)) {
        next.delete(countryId);
      } else {
        // FIFO eviction: JavaScript Sets maintain insertion order, so
        // `values().next().value` always returns the oldest (first inserted) entry.
        while (next.size >= maxComparisonCountries) {
          const oldest = next.values().next().value;
          // Defensive guard; should never occur because loop condition implies non-empty Set.
          if (oldest === undefined) break;
          next.delete(oldest);
        }
        next.add(countryId);
      }
      return next;
    });
  };

  const resetFilters = () => {
    setSearch('');
    setRegionFilter('all');
    setTrustFilter('all');
    setRiskFilter('all');
    setRegimeFilter('all');
  };

  const matrixRows = [
    { label: 'Coverage', value: (country: SimulatedCountry) => `${country.profile.sourceCoverage}%` },
    { label: 'Confidence', value: (country: SimulatedCountry) => `${country.confidence}%` },
    { label: 'Risk', value: (country: SimulatedCountry) => `${country.risk}%` },
    { label: 'Relationships', value: (country: SimulatedCountry) => String(country.profile.relationships.length) },
    { label: 'Trust', value: (country: SimulatedCountry) => summarizeCountryTrust(country.profile).label },
  ];

  return (
    <div className="index-panel">
      <div className="index-toolbar">
        <div>
          <strong>Factual index</strong>
          <p className="movers-empty">Search, filter, and compare a small cohort before jumping into the inspector.</p>
        </div>
        <div className="index-toolbar-actions">
          <label className="index-toolbar-field">
            <span>Rank by</span>
            <select value={metric} onChange={(event) => setMetric(event.target.value as IndexMetric)}>
              <option value="coverage">Coverage</option>
              <option value="confidence">Confidence</option>
              <option value="risk">Risk</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => exportIndexCsv(ranked)}
            title="Export visible countries as CSV"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="index-summary-grid">
        <article className="index-summary-card">
          <span>Visible countries</span>
          <strong>{ranked.length}</strong>
        </article>
        <article className="index-summary-card">
          <span>Compared</span>
          <strong>{compared.length} / {maxComparisonCountries}</strong>
        </article>
        <article className="index-summary-card">
          <span>Filters</span>
          <strong>{search.length > 0 ? activeFilterCount + 1 : activeFilterCount}</strong>
        </article>
      </div>

      <div className="index-filter-grid">
        <label className="index-toolbar-field index-search-field">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Country or region…"
            spellCheck={false}
          />
        </label>
        <label className="index-toolbar-field">
          <span>Region</span>
          <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
            <option value="all">All regions</option>
            {availableRegions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>
        <label className="index-toolbar-field">
          <span>Trust</span>
          <select value={trustFilter} onChange={(event) => setTrustFilter(event.target.value as typeof trustFilter)}>
            <option value="all">All trust states</option>
            <option value="good">Observed data</option>
            <option value="warning">Quality notice</option>
            <option value="bad">Low trust</option>
          </select>
        </label>
        <label className="index-toolbar-field">
          <span>Risk tier</span>
          <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as typeof riskFilter)}>
            <option value="all">All tiers</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="index-toolbar-field">
          <span>Regime</span>
          <select value={regimeFilter} onChange={(event) => setRegimeFilter(event.target.value as typeof regimeFilter)}>
            <option value="all">All regimes</option>
            <option value="democracy">Democracy</option>
            <option value="hybrid">Hybrid</option>
            <option value="authoritarian">Authoritarian</option>
          </select>
        </label>
        {(search.length > 0 || activeFilterCount > 0) && (
          <button type="button" className="btn btn-ghost btn-sm index-reset-btn" onClick={resetFilters}>
            <SvgIcon.Reset />
            Reset
          </button>
        )}
      </div>

      <div className="index-layout">
        <section className="index-list-section">
          <h3 className="movers-section-title">Country rankings</h3>
          {ranked.length === 0 ? (
            <div className="empty-state">
              <strong>No countries match</strong>
              <p>Try broadening the search or clearing one of the active filters.</p>
            </div>
          ) : (
            <div className="index-list">
              {ranked.map((country, index) => {
                const trust = summarizeCountryTrust(country.profile);
                return (
                  <button
                    key={country.profile.id}
                    type="button"
                    className={`index-row ${selectedIdSet.has(country.profile.id) ? 'index-row-active' : ''}`}
                    onClick={() => toggleCountry(country.profile.id)}
                  >
                    <span className="index-rank">#{index + 1}</span>
                    <span className="index-main">
                      <span className="index-main-row">
                        <strong>{country.profile.displayName}</strong>
                        <TrustTag summary={trust} />
                      </span>
                      <span className="index-sub">
                        {country.profile.region} · {country.profile.regimeType} · Risk {getRiskTier(country.risk)}
                      </span>
                      <span className="index-sub">{trust.detail}</span>
                    </span>
                    <span className="index-score">
                      {metric === 'coverage' ? `${country.profile.sourceCoverage}%` : metric === 'confidence' ? `${country.confidence}%` : `${country.risk}%`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="index-compare-section">
          <h3 className="movers-section-title">Compare countries</h3>
          {compared.length === 0 ? (
            <p className="movers-empty">Select up to {maxComparisonCountries} countries from the ranking to compare trust, risk, confidence, and relationship density.</p>
          ) : (
            <>
              <div className="index-compare-grid">
                {compared.map((country) => {
                  const trust = summarizeCountryTrust(country.profile);
                  return (
                    <article key={country.profile.id} className="methodology-priority-card index-compare-card">
                      <header>
                        <strong>{country.profile.displayName}</strong>
                        <TrustTag summary={trust} />
                      </header>
                      <p>{country.profile.region} · {country.profile.regimeType} · updated {country.profile.lastUpdated}</p>
                      <p>Coverage {country.profile.sourceCoverage}% · Confidence {country.confidence}% · Risk {country.risk}%</p>
                      <p>Relationships {country.profile.relationships.length} · {trust.detail}</p>
                      <div className="index-compare-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSelectCountry(country.profile.mapName)}>
                          Open inspector
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleCountry(country.profile.id)}>
                          Remove
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {compared.length > 1 && (
                <div className="index-matrix-wrap">
                  <h4 className="index-matrix-title">Comparison matrix</h4>
                  <div className="index-matrix-scroll">
                    <table className="index-matrix">
                      <thead>
                        <tr>
                          <th>Metric</th>
                          {compared.map((country) => (
                            <th key={country.profile.id}>{country.profile.displayName}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matrixRows.map((row) => (
                          <tr key={row.label}>
                            <th>{row.label}</th>
                            {compared.map((country) => (
                              <td key={`${row.label}-${country.profile.id}`}>{row.value(country)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
