import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  Alignment,
  MapFillMode,
  CountryAssessment,
} from '../types';
import { MAP_HEIGHT, MAP_WIDTH, countryCentroids, countryPathStrings, projectLonLat } from '../lib/map';
import { getRiskTier } from '../assessment';
import { IconButton, SvgIcon } from './ui';
import { summarizeCountryTrust, TrustTag } from './provenance';
import { getCoverageMetrics } from '../lib/coverage';
import { useMapStore } from '../store/useMapStore';
import { MAP } from '../lib/constants';
import { clamp, capitalize } from './map/utils';
import { useMapInteraction } from '../hooks/useMapInteraction';
import {
  overlayLabel,
  overlayColor,
  MODE_CORE_PX,
  MODE_DASH_PX,
  MODE_MIN_OPACITY,
  overlayKeys,
  RELATIONSHIP_HOVER_RGB,
  computeBoundaryPoint,
  drawRelationshipArcs,
  getRelationshipMetric,
} from './map/relationshipArcs';
import { fillModeGroups } from './map/fillModeGroups';
import { fillModeReadout, formatStatProvenance } from './map/fillModeReadout';
import { CountryLayers } from './map/CountryLayers';
import { MapLegendControls } from './map/MapLegendControls';
import {
  criticalMineralIntensityScore,
  debtVulnerabilityScore,
  demographicPressureScore,
  formatGrowthPct,
  parseHex,
} from './map/countryColors';

const ZOOM_STEP = MAP.zoomStep;
const HOVER_CARD_HEIGHT = MAP.hoverCardHeight;
const LABELS_ZOOM_THRESHOLD = MAP.labelsZoomThreshold;
const LABEL_BASE_FONT_SIZE = MAP.labelBaseFontSize;
const LABEL_STROKE_WIDTH = MAP.labelStrokeWidth;

export type OverlayConnection = {
  countryId: string;
  mapName: string;
  displayName: string;
  score: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  boundaryX: number;
  boundaryY: number;
};

type Props = {
  byName: Map<string, CountryAssessment>;
  visibleNames: Set<string>;
  selectedName: string;
  onSelect: (name: string) => void;
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
};

/** Prefer curated geo centroid projected into map space; fall back to path centroid. */
const resolveCountryAnchor = (
  mapName: string,
  geo?: { lat: number; lng: number } | null,
): [number, number] | null => {
  if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lng)) {
    const projected = projectLonLat(geo.lng, geo.lat);
    if (projected) return projected;
  }
  return countryCentroids.get(mapName) ?? null;
};

// ─── Component ────────────────────────────────────────────────────────────────
export const MapCanvas = memo(function MapCanvas({
  byName,
  visibleNames,
  selectedName,
  onSelect,
  alignmentColor,
  alignmentLabel,
}: Props) {
  const overlayMode = useMapStore((state) => state.overlayMode);
  const fillMode = useMapStore((state) => state.fillMode);
  const setOverlayMode = useMapStore((state) => state.setOverlayMode);
  const setFillMode = useMapStore((state) => state.setFillMode);
  const handleOverlayModeChange = useCallback(
    (mode: typeof overlayMode) => setOverlayMode(mode),
    [setOverlayMode],
  );
  const handleFillModeChange = useCallback((mode: MapFillMode) => setFillMode(mode), [setFillMode]);

  // Overlay connections derive entirely from byName + selection + overlay mode,
  // so MapCanvas owns the computation. App.tsx no longer needs lib/map at all,
  // which lets the world-atlas TopoJSON ride along with this component's chunk.
  const overlayConnections = useMemo<OverlayConnection[]>(() => {
    if (overlayMode === 'none') return [];
    const profile = byName.get(selectedName)?.profile;
    if (!profile) return [];
    const sourceAnchor = resolveCountryAnchor(selectedName, profile.geo);
    if (!sourceAnchor) return [];
    const [sourceX, sourceY] = sourceAnchor;
    return profile.relationships
      .map((relationship) => {
        if (relationship.mapName === selectedName) return null;
        const targetProfile = byName.get(relationship.mapName)?.profile;
        const targetAnchor = resolveCountryAnchor(relationship.mapName, targetProfile?.geo);
        if (!targetAnchor) return null;
        const [boundaryX, boundaryY] = computeBoundaryPoint(
          sourceX,
          sourceY,
          targetAnchor[0],
          targetAnchor[1],
        );
        return {
          countryId: relationship.countryId,
          mapName: relationship.mapName,
          displayName: relationship.displayName,
          score: getRelationshipMetric(overlayMode, relationship),
          x1: sourceX,
          y1: sourceY,
          x2: targetAnchor[0],
          y2: targetAnchor[1],
          boundaryX,
          boundaryY,
        };
      })
      .filter((connection): connection is OverlayConnection => Boolean(connection))
      .filter((connection) => connection.score >= 40)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);
  }, [byName, overlayMode, selectedName]);

  const relatedNames = useMemo(
    () => new Set(overlayConnections.map((connection) => connection.mapName)),
    [overlayConnections],
  );

  // Memoize once — the centroid map never changes, so converting it outside the
  // JSX here avoids recreating the array on every render when labels are visible.
  const centroidEntries = useMemo(() => Array.from(countryCentroids.entries()), []);
  const {
    svgRef,
    frameRef,
    hoverCardRef,
    hoverCardMutedRef,
    hoverPosRef,
    hoveredName,
    hoveredNameRef,
    hoveredIsParamRef,
    hoveredCountry,
    setHoveredCountryCoalesced,
    transform,
    resetView,
    zoomBy,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    handleDoubleClick,
    handleKeyDown,
  } = useMapInteraction({ selectedName, onSelect });

  const relationshipCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Derived values ────────────────────────────────────────────────────────────
  const { zoom, offset } = transform;
  const hovered = hoveredName ? byName.get(hoveredName) : undefined;
  const hoverPos = hoverPosRef.current;
  const hoveredReadout = hovered ? fillModeReadout(fillMode, hovered.profile) : null;
  const hoveredReadoutSource = hovered
    ? formatStatProvenance(hovered.profile, hoveredReadout?.statField)
    : null;

  // invZoom is used by the SVG layer (glow filter, labels) to keep sizes constant.
  const invZoom = 1 / zoom;

  // Draw the relationship arc overlay onto the transparent canvas.
  // Uses the same uniform "xMidYMid slice" mapping as the SVG so arcs land
  // exactly on their countries at any frame aspect ratio.
  const drawRelationshipOverlay = useCallback(() => {
    const frame = frameRef.current;
    const canvas = relationshipCanvasRef.current;
    if (!frame || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = frame.clientWidth;
    const height = frame.clientHeight;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    // Uniform slice scale + centering matches SVG preserveAspectRatio="xMidYMid slice".
    const slice = Math.max(width / MAP_WIDTH, height / MAP_HEIGHT);
    ctx.translate((width - MAP_WIDTH * slice) / 2, (height - MAP_HEIGHT * slice) / 2);
    ctx.scale(slice, slice);
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);
    // pixelScale converts world units → CSS px for zoom-invariant visual sizes.
    const pixelScale = slice * zoom;

    if (overlayMode !== 'none' && overlayConnections.length > 0) {
      const sourceProfile = byName.get(selectedName)?.profile;
      const sourceAnchor = resolveCountryAnchor(selectedName, sourceProfile?.geo);
      drawRelationshipArcs(
        ctx,
        selectedName,
        overlayConnections,
        pixelScale,
        {
          rgb:        parseHex(overlayColor[overlayMode]),
          corePx:     MODE_CORE_PX[overlayMode],
          minOpacity: MODE_MIN_OPACITY[overlayMode] ?? 0.34,
          maxOpacity: 0.85,
          dashPx:     MODE_DASH_PX[overlayMode],
        },
        sourceAnchor,
      );
    }

    // Hover highlight arc — bright, overlay-agnostic.
    if (hoveredCountry && hoveredCountry !== selectedName) {
      const sourceProfile = byName.get(selectedName)?.profile;
      const targetProfile = byName.get(hoveredCountry)?.profile;
      const sourceAnchor = resolveCountryAnchor(selectedName, sourceProfile?.geo);
      const targetAnchor = resolveCountryAnchor(hoveredCountry, targetProfile?.geo);
      if (sourceAnchor && targetAnchor) {
        const [boundaryX, boundaryY] = computeBoundaryPoint(
          sourceAnchor[0],
          sourceAnchor[1],
          targetAnchor[0],
          targetAnchor[1],
        );
        // Pass explicit endpoints via boundary; sourceCountry string is only used
        // when targets lack coordinates — we always supply boundaryX/Y here.
        drawRelationshipArcs(
          ctx,
          selectedName,
          [{ mapName: hoveredCountry, score: 100, boundaryX, boundaryY }],
          pixelScale,
          { rgb: RELATIONSHIP_HOVER_RGB, corePx: 1.9, minOpacity: 0.85, maxOpacity: 1 },
          sourceAnchor,
        );
      }
    }
  }, [byName, hoveredCountry, offset.x, offset.y, overlayConnections, overlayMode, selectedName, zoom]);

  // Run the draw whenever inputs change.
  useEffect(() => {
    drawRelationshipOverlay();
  }, [drawRelationshipOverlay]);

  // Re-draw after resize without re-subscribing on every transform change.
  const drawRelationshipOverlayRef = useRef(drawRelationshipOverlay);
  drawRelationshipOverlayRef.current = drawRelationshipOverlay;
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => drawRelationshipOverlayRef.current());
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="map" aria-label="World map">
      <div className="map-frame" ref={frameRef}>
        <canvas
          ref={relationshipCanvasRef}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="world-map"
          preserveAspectRatio="xMidYMid slice"
          tabIndex={0}
          role="application"
          aria-label="World map — arrow keys pan, plus and minus zoom, 0 fits the world"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onDoubleClick={handleDoubleClick}
          onKeyDown={handleKeyDown}
        >
          <defs>
            {/* Layered ocean: deep base → cool mid → soft center highlight */}
            <radialGradient id="map-ocean-base" cx="48%" cy="40%" r="72%">
              <stop offset="0%" stopColor="#173a6e" />
              <stop offset="42%" stopColor="#0d2248" />
              <stop offset="78%" stopColor="#081428" />
              <stop offset="100%" stopColor="#04080f" />
            </radialGradient>
            <radialGradient id="map-ocean-sheen" cx="36%" cy="28%" r="55%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.14" />
              <stop offset="45%" stopColor="#1d4ed8" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="map-ocean-horizon" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.05" />
              <stop offset="35%" stopColor="#000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
            </linearGradient>
            <pattern id="map-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke="rgba(148,163,184,0.035)"
                strokeWidth="0.6"
              />
            </pattern>
            <pattern id="map-stars" width="120" height="120" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="18" r="0.45" fill="rgba(226,232,240,0.28)" />
              <circle cx="68" cy="42" r="0.35" fill="rgba(226,232,240,0.18)" />
              <circle cx="96" cy="88" r="0.4" fill="rgba(226,232,240,0.22)" />
              <circle cx="40" cy="96" r="0.3" fill="rgba(226,232,240,0.14)" />
              <circle cx="110" cy="22" r="0.35" fill="rgba(226,232,240,0.16)" />
            </pattern>
            {/* Soft land edge shadow for cartographic depth */}
            <filter id="land-shadow" x="-8%" y="-8%" width="116%" height="116%">
              <feDropShadow dx="0" dy="0.6" stdDeviation="0.7" floodColor="#000" floodOpacity="0.35" />
            </filter>
            {/* Selection outer bloom — size stays roughly constant on screen via invZoom */}
            <filter id="selected-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation={3.2 * invZoom} result="blur" />
              <feFlood floodColor="#6eb0ff" floodOpacity="0.55" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Ocean stack (fixed to viewBox — does not pan with countries) */}
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-ocean-base)" />
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-ocean-sheen)" />
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-stars)" opacity="0.55" />
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-grid)" />
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-ocean-horizon)" />

          <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
            {/* Memoized country fills — group filter adds a single soft land edge */}
            <g filter="url(#land-shadow)" className="map-countries">
              <CountryLayers
                byName={byName}
                visibleNames={visibleNames}
                selectedName={selectedName}
                relatedNames={relatedNames}
                overlayMode={overlayMode}
                fillMode={fillMode}
                alignmentColor={alignmentColor}
                setHoveredCountry={setHoveredCountryCoalesced}
                hoveredNameRef={hoveredNameRef}
                hoveredIsParamRef={hoveredIsParamRef}
              />
            </g>

            {/* Selection chrome: outer bloom + bright inner ring (drawn above fills) */}
            {selectedName && countryPathStrings.get(selectedName) && (
              <g className="map-selection-ring" style={{ pointerEvents: 'none' }} filter="url(#selected-glow)">
                <path
                  d={countryPathStrings.get(selectedName)!}
                  fill="none"
                  stroke="rgba(110, 176, 255, 0.55)"
                  strokeWidth={3.4}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={countryPathStrings.get(selectedName)!}
                  fill="none"
                  stroke="rgba(248, 250, 252, 0.95)"
                  strokeWidth={1.35}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )}

            {/* Hover highlight — single path re-render instead of all 240+ paths */}
            {hoveredName && hoveredName !== selectedName && (
              <g className="map-hover-ring" style={{ pointerEvents: 'none' }}>
                <path
                  d={countryPathStrings.get(hoveredName) ?? undefined}
                  fill="none"
                  stroke="rgba(226, 232, 240, 0.28)"
                  strokeWidth={2.6}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={countryPathStrings.get(hoveredName) ?? undefined}
                  fill="none"
                  stroke="rgba(248, 250, 252, 0.92)"
                  strokeWidth={1.15}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )}

            {/* Country labels — denser when zoomed in; always show selected at threshold */}
            {zoom >= LABELS_ZOOM_THRESHOLD &&
              centroidEntries.map(([name, [cx, cy]]) => {
                const entry = byName.get(name);
                if (!entry) return null;
                const isSelected = name === selectedName;
                const isHovered = name === hoveredName;
                const isRelated = relatedNames.has(name);
                // At moderate zoom, only label focus / related / hover to reduce clutter.
                if (zoom < LABELS_ZOOM_THRESHOLD + 0.55 && !isSelected && !isHovered && !isRelated) {
                  return null;
                }
                const label = entry.profile.displayName;
                const weight = isSelected || isHovered ? 700 : 600;
                const fill = isSelected
                  ? 'rgba(248,250,252,0.98)'
                  : isHovered
                    ? 'rgba(248,250,252,0.95)'
                    : 'rgba(226,232,240,0.88)';
                return (
                  <text
                    key={`label-${name}`}
                    x={cx}
                    y={cy}
                    fontSize={LABEL_BASE_FONT_SIZE * invZoom * (isSelected ? 1.08 : 1)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={fill}
                    stroke="rgba(6, 10, 18, 0.78)"
                    strokeWidth={LABEL_STROKE_WIDTH * 1.65 * invZoom}
                    paintOrder="stroke"
                    className="map-country-label"
                    style={{
                      pointerEvents: 'none',
                      fontWeight: weight,
                      letterSpacing: '0.01em',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    {label}
                  </text>
                );
              })}
          </g>
        </svg>
        <div className="map-vignette" aria-hidden />

        {hovered && hoverPos && (
          <div
            ref={hoverCardRef}
            className="hover-card"
            style={{
              left: clamp(hoverPos.x + 16, 12, (frameRef.current?.clientWidth ?? 800) - 220),
              top: clamp(hoverPos.y + 16, 12, (frameRef.current?.clientHeight ?? 600) - HOVER_CARD_HEIGHT),
            }}
          >
            <div className="hover-card-header">
              <strong>{hovered.profile.displayName}</strong>
              <TrustTag summary={summarizeCountryTrust(hovered.profile)} />
            </div>
            <span className="hover-card-row">
              <span
                className="hover-dot"
                style={{ background: alignmentColor[hovered.alignment] }}
                aria-hidden
              />
              {alignmentLabel[hovered.alignment]}
            </span>
            <span className="hover-card-provenance">{summarizeCountryTrust(hovered.profile).detail}</span>
            <div className="hover-stats">
              <span>
                <em>Risk</em>
                <span data-risk-tier={getRiskTier(hovered.risk)}>{hovered.risk}%</span>
              </span>
              <span>
                <em>Conf</em>
                {hovered.confidence}%
              </span>
              {fillMode === 'gdpPerCapita' && hovered.profile.economicStats?.gdpPerCapitaUsd != null && (
                <span>
                  <em>GDP/cap</em>
                  ${hovered.profile.economicStats.gdpPerCapitaUsd.toLocaleString()}
                </span>
              )}
              {fillMode === 'gdpGrowth' && hovered.profile.economicStats?.gdpGrowthPct != null && (
                <span>
                  <em>Growth</em>
                  {formatGrowthPct(hovered.profile.economicStats.gdpGrowthPct)}
                </span>
              )}
              {fillMode === 'inflation' && hovered.profile.economicStats?.inflationPct != null && (
                <span>
                  <em>Inflation</em>
                  {hovered.profile.economicStats.inflationPct.toFixed(1)}%
                </span>
              )}
              {fillMode === 'tradeOpenness' && hovered.profile.economicStats?.tradeGdpPct != null && (
                <span>
                  <em>Trade/GDP</em>
                  {Math.round(hovered.profile.economicStats.tradeGdpPct)}%
                </span>
              )}
              {fillMode === 'nuclearArmed' && hovered.profile.militaryStats && (
                <span>
                  <em>Nuclear</em>
                  {hovered.profile.militaryStats.nuclearArmed ? 'Armed' : 'No'}
                </span>
              )}
              {fillMode === 'militaryBurden' && hovered.profile.militaryStats?.militaryExpGdpPct != null && (
                <span>
                  <em>Mil.%GDP</em>
                  {hovered.profile.militaryStats.militaryExpGdpPct.toFixed(1)}%
                </span>
              )}
              {fillMode === 'regime' && (
                <span>
                  <em>Regime</em>
                  {capitalize(hovered.profile.regimeType)}
                </span>
              )}
              {fillMode === 'conflictPressure' && (
                <span>
                  <em>Conflict</em>
                  {capitalize(hovered.profile.indicators.conflictPressure)}
                </span>
              )}
              {fillMode === 'population' && hovered.profile.demographics?.populationMillions != null && (
                <span>
                  <em>Pop</em>
                  {hovered.profile.demographics.populationMillions >= 1000
                    ? `${(hovered.profile.demographics.populationMillions / 1000).toFixed(2)}B`
                    : `${hovered.profile.demographics.populationMillions.toFixed(0)}M`}
                </span>
              )}
              {fillMode === 'medianAge' && hovered.profile.demographics?.medianAge != null && (
                <span>
                  <em>Median age</em>
                  {hovered.profile.demographics.medianAge.toFixed(1)}y
                </span>
              )}
              {fillMode === 'energyExports' && hovered.profile.energy != null && (
                <span>
                  <em>Energy</em>
                  {hovered.profile.energy.energyImportDependencePct > 0
                    ? `${Math.round(hovered.profile.energy.energyImportDependencePct)}% imports`
                    : `${Math.round(-hovered.profile.energy.energyImportDependencePct)}% exporter`}
                </span>
              )}
              {fillMode === 'demographicPressure' && hovered.profile.demographics != null && (
                <span>
                  <em>Demo pressure</em>
                  {(() => {
                    const score = demographicPressureScore(hovered.profile);
                    return score == null ? '—' : `${score}`;
                  })()}
                </span>
              )}
              {fillMode === 'cyberCapability' && hovered.profile.cyber != null && (
                <span>
                  <em>Cyber</em>
                  {`${capitalize(hovered.profile.cyber.offensiveTier)}/${capitalize(hovered.profile.cyber.defensiveTier)}`}
                </span>
              )}
              {fillMode === 'internetFreedom' && hovered.profile.cyber?.internetFreedomScore != null && (
                <span>
                  <em>Net free</em>
                  {hovered.profile.cyber.internetFreedomScore}/100
                </span>
              )}
              {fillMode === 'foodImportDependence' && hovered.profile.foodWater?.foodImportDependencePct != null && (
                <span>
                  <em>Food</em>
                  {hovered.profile.foodWater.foodImportDependencePct >= 0
                    ? `${Math.round(hovered.profile.foodWater.foodImportDependencePct)}% imports`
                    : `${Math.round(-hovered.profile.foodWater.foodImportDependencePct)}% exporter`}
                </span>
              )}
              {fillMode === 'waterStress' && hovered.profile.foodWater?.waterStressIndex != null && (
                <span>
                  <em>Water</em>
                  {hovered.profile.foodWater.waterStressIndex}/5
                </span>
              )}
              {fillMode === 'debtVulnerability' && hovered.profile.fiscal != null && (
                <span>
                  <em>Debt</em>
                  {(() => {
                    const score = debtVulnerabilityScore(hovered.profile);
                    return score == null ? '—' : `${score}/100`;
                  })()}
                </span>
              )}
              {fillMode === 'sovereignRating' && hovered.profile.fiscal != null && (
                <span>
                  <em>Rating</em>
                  {capitalize(hovered.profile.fiscal.sovereignRatingTier)}
                </span>
              )}
              {fillMode === 'unVotingBlocA' && hovered.profile.diplomatic?.unVotingAlignmentBlocA != null && (
                <span>
                  <em>UN-A</em>
                  {hovered.profile.diplomatic.unVotingAlignmentBlocA}%
                </span>
              )}
              {fillMode === 'unVotingBlocB' && hovered.profile.diplomatic?.unVotingAlignmentBlocB != null && (
                <span>
                  <em>UN-B</em>
                  {hovered.profile.diplomatic.unVotingAlignmentBlocB}%
                </span>
              )}
              {fillMode === 'criticalMineralIntensity' && hovered.profile.criticalMinerals != null && (
                <span>
                  <em>Minerals</em>
                  {(() => {
                    const score = criticalMineralIntensityScore(hovered.profile);
                    return score == null ? '—' : `${score}/100`;
                  })()}
                </span>
              )}
              {fillMode === 'softPower' && hovered.profile.softPower?.reachScore != null && (
                <span>
                  <em>Soft</em>
                  {hovered.profile.softPower.reachScore}/100
                </span>
              )}
              {fillMode === 'defensePactDensity' && hovered.profile.diplomatic != null && (
                <span>
                  <em>Pacts</em>
                  {hovered.profile.diplomatic.defensePacts.length}
                </span>
              )}
              <span>
                <em>Quality</em>
                {(() => {
                  const coverage = getCoverageMetrics(hovered.profile);
                  return `${coverage.freshPct}% fresh · ${coverage.observedPct}% observed · ${coverage.fallbackPct}% fallback · ${coverage.stalePct}% stale`;
                })()}
              </span>
            </div>
            {hoveredReadoutSource && (
              <span className="hover-card-source">
                {hoveredReadout?.label}: {hoveredReadoutSource}
              </span>
            )}
          </div>
        )}

        {hoveredName && !hovered && hoverPos && (
          <div
            ref={hoverCardMutedRef}
            className="hover-card hover-card-muted"
            style={{
              left: clamp(hoverPos.x + 16, 12, (frameRef.current?.clientWidth ?? 800) - 220),
              top: clamp(hoverPos.y + 16, 12, (frameRef.current?.clientHeight ?? 600) - 60),
            }}
          >
            <strong>{hoveredName}</strong>
            <span>Not yet parameterized</span>
          </div>
        )}

        <MapLegendControls
          fillMode={fillMode}
          overlayMode={overlayMode}
          alignmentColor={alignmentColor}
          alignmentLabel={alignmentLabel}
        />

        {/* ── Unified bottom toolbar: Fill · Overlay · Zoom ── */}
        <div className="map-toolbar" role="group" aria-label="Map display controls">
          <div className="map-toolbar-section map-toolbar-fill" role="group" aria-label="Map fill">
            <span className="map-toolbar-label">Fill</span>
            <span className="map-toolbar-select-shell">
              <select
                className="map-toolbar-select"
                value={fillMode}
                onChange={(e) => handleFillModeChange(e.target.value as MapFillMode)}
                title="Select map fill mode"
                aria-label="Map fill mode"
              >
                {fillModeGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <SvgIcon.Chevron dir="down" />
            </span>
          </div>

          <div className="map-toolbar-divider" aria-hidden />

          <div className="map-toolbar-section map-toolbar-overlay" role="group" aria-label="Relationship overlay">
            <span className="map-toolbar-label">Overlay</span>
            <div className="map-toolbar-btn-row">
              <button
                type="button"
                className={`map-toolbar-btn${overlayMode === 'none' ? ' map-toolbar-btn-active' : ''}`}
                onClick={() => handleOverlayModeChange('none')}
                aria-pressed={overlayMode === 'none'}
              >
                None
              </button>
              {overlayKeys.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`map-toolbar-btn${overlayMode === mode ? ' map-toolbar-btn-active' : ''}`}
                  onClick={() => handleOverlayModeChange(mode)}
                  aria-pressed={overlayMode === mode}
                  style={
                    overlayMode === mode
                      ? ({ '--toolbar-accent': overlayColor[mode] } as React.CSSProperties)
                      : undefined
                  }
                >
                  <i className="overlay-dot" style={{ background: overlayColor[mode] }} aria-hidden />
                  {overlayLabel[mode]}
                </button>
              ))}
            </div>
          </div>

          <div className="map-toolbar-divider" aria-hidden />

          <div className="map-toolbar-section map-toolbar-zoom" role="group" aria-label="Map zoom">
            <span className="map-toolbar-label">Zoom</span>
            <IconButton label="Zoom out" onClick={() => zoomBy(-ZOOM_STEP)}>
              <SvgIcon.Minus />
            </IconButton>
            <button
              type="button"
              className="map-toolbar-readout"
              onClick={resetView}
              title="Reset view (click to fit world)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <IconButton label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)}>
              <SvgIcon.Plus />
            </IconButton>
          </div>
        </div>
      </div>
    </section>
  );
});
