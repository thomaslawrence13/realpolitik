import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';
import type {
  Alignment,
  MapFillMode,
  OverlayMode,
  RegimeType,
  RelationshipDimension,
  SimulatedCountry,
} from '../types';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  countries,
  countryCentroids,
  countryPathStrings,
} from '../lib/map';
import { getRiskTier } from '../simulation';
import { IconButton, SvgIcon } from './ui';

// Factors used to normalize WheelEvent.deltaY across different deltaMode values
const WHEEL_LINE_PX = 17;  // approximate pixels per "line" scroll unit
const WHEEL_PAGE_PX = 500; // approximate pixels per "page" scroll unit
const MIN_ZOOM = 0.85;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.3;
// How much of the map (in SVG viewBox units) must remain on-screen when panning
const PAN_MARGIN = 80;
// Approximate pixel height of the main hover card (used to clamp card position near the bottom edge)
const HOVER_CARD_HEIGHT = 115;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Prevent the map from being dragged completely off-screen. */
function clampOffset(offset: { x: number; y: number }, zoom: number) {
  return {
    x: clamp(offset.x, -(MAP_WIDTH * zoom - PAN_MARGIN), MAP_WIDTH - PAN_MARGIN),
    y: clamp(offset.y, -(MAP_HEIGHT * zoom - PAN_MARGIN), MAP_HEIGHT - PAN_MARGIN),
  };
}

const overlayLabel: Record<RelationshipDimension, string> = {
  cooperation: 'Cooperation',
  hostility: 'Hostility',
  dependency: 'Dependency',
  deterrence: 'Deterrence',
};

const overlayColor: Record<RelationshipDimension, string> = {
  cooperation: '#38bdf8',
  hostility: '#fb7185',
  dependency: '#f59e0b',
  deterrence: '#a78bfa',
};

const overlayKeys: RelationshipDimension[] = ['cooperation', 'hostility', 'dependency', 'deterrence'];

const fillModeOptions: ReadonlyArray<{ value: MapFillMode; label: string; hint: string }> = [
  { value: 'alignment', label: 'Alignment', hint: 'Color by current bloc alignment' },
  { value: 'risk', label: 'Risk', hint: 'Green → red as escalation risk rises' },
  { value: 'confidence', label: 'Confidence', hint: 'Brighter = higher confidence' },
  { value: 'shift', label: 'Shift', hint: 'Highlights countries that diverge from baseline' },
  { value: 'gdpPerCapita', label: 'GDP/cap', hint: 'Choropleth by GDP per capita (USD)' },
  { value: 'nuclearArmed', label: 'Nuclear', hint: 'Highlight nuclear-armed states' },
  { value: 'militaryBurden', label: 'Mil.%GDP', hint: 'Military expenditure as % of GDP' },
  { value: 'regime', label: 'Regime', hint: 'Color by regime type (democracy / hybrid / authoritarian)' },
];

// Risk gradient: low (green) → medium (amber) → high (red).
const RISK_LOW = '#34d399';
const RISK_MED = '#fbbf24';
const RISK_HIGH = '#f87171';
const NEUTRAL = '#1b2538';

const lerpColor = (from: string, to: string, t: number): string => {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [fr, fg, fb] = parse(from);
  const [tr, tg, tb] = parse(to);
  const r = Math.round(fr + (tr - fr) * t);
  const g = Math.round(fg + (tg - fg) * t);
  const b = Math.round(fb + (tb - fb) * t);
  return `rgb(${r}, ${g}, ${b})`;
};

const riskColor = (risk: number): string => {
  const t = Math.max(0, Math.min(1, risk / 100));
  if (t < 0.5) return lerpColor(RISK_LOW, RISK_MED, t * 2);
  return lerpColor(RISK_MED, RISK_HIGH, (t - 0.5) * 2);
};

const confidenceColor = (confidence: number): string => {
  // Darker blue (low) to bright cyan (high).
  const t = Math.max(0, Math.min(1, (confidence - 30) / 60));
  return lerpColor('#1e3a8a', '#67e8f9', t);
};

// GDP per capita: log-scale purple (< $1 K) → amber (~$10 K) → green (>$100 K).
const GDP_POOR = '#581c87';
const GDP_MID  = '#f59e0b';
const GDP_RICH = '#22c55e';
const gdpPerCapitaColor = (gdp: number | undefined): string => {
  if (!gdp) return NEUTRAL;
  // log10 scale: $1 K → 0, $10 K → 0.5, $100 K → 1
  const t = Math.max(0, Math.min(1, (Math.log10(Math.max(1, gdp)) - 3) / 2));
  if (t < 0.5) return lerpColor(GDP_POOR, GDP_MID, t * 2);
  return lerpColor(GDP_MID, GDP_RICH, (t - 0.5) * 2);
};

// Nuclear-armed: vivid yellow (armed) vs deep navy (unarmed).
const NUCLEAR_YES = '#fef08a';
const NUCLEAR_NO  = '#1b2d4a';
const nuclearArmedColor = (armed: boolean | undefined): string => {
  if (armed === undefined) return NEUTRAL;
  return armed ? NUCLEAR_YES : NUCLEAR_NO;
};

// Military burden: sky blue (0 %) → red (≥ 5 % GDP).
const MIL_LOW  = '#0ea5e9';
const MIL_HIGH = '#f87171';
const militaryBurdenColor = (pct: number | undefined): string => {
  if (pct == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, pct / 5));
  return lerpColor(MIL_LOW, MIL_HIGH, t);
};

// Regime type: fixed palette.
const regimeTypeColor: Record<RegimeType, string> = {
  democracy:     '#22d3ee',
  hybrid:        '#f59e0b',
  authoritarian: '#f87171',
};

type FillResolverArgs = {
  simulated: SimulatedCountry;
  baseline?: SimulatedCountry;
  alignmentColor: Record<Alignment, string>;
};

const resolveFill = (mode: MapFillMode, args: FillResolverArgs): string => {
  const { simulated, baseline, alignmentColor } = args;
  if (mode === 'alignment') return alignmentColor[simulated.alignment];
  if (mode === 'risk') return riskColor(simulated.risk);
  if (mode === 'confidence') return confidenceColor(simulated.confidence);
  if (mode === 'gdpPerCapita') return gdpPerCapitaColor(simulated.profile.economicStats?.gdpPerCapitaUsd);
  if (mode === 'nuclearArmed') return nuclearArmedColor(simulated.profile.militaryStats?.nuclearArmed);
  if (mode === 'militaryBurden') return militaryBurdenColor(simulated.profile.militaryStats?.militaryExpGdpPct);
  if (mode === 'regime') return regimeTypeColor[simulated.profile.regimeType];
  // shift: highlight countries whose risk or alignment diverged from baseline.
  if (!baseline) return alignmentColor[simulated.alignment];
  const alignmentChanged = simulated.alignment !== baseline.alignment;
  const riskGap = simulated.risk - baseline.risk;
  if (alignmentChanged) return alignmentColor[simulated.alignment];
  if (Math.abs(riskGap) < 4) return NEUTRAL;
  return riskGap > 0 ? lerpColor(NEUTRAL, RISK_HIGH, Math.min(1, riskGap / 30))
    : lerpColor(NEUTRAL, RISK_LOW, Math.min(1, -riskGap / 30));
};

// ─── Memoized country paths layer ────────────────────────────────────────────
// Defined outside MapCanvas so React.memo has stable component identity.
// Only re-renders when alignment data, filters, selection, or overlays change —
// NOT on hover or zoom/pan.
type CountryLayersProps = {
  byName: Map<string, SimulatedCountry>;
  baselineByName: Map<string, SimulatedCountry>;
  visibleNames: Set<string>;
  selectedName: string;
  relatedNames: Set<string>;
  overlayMode: OverlayMode;
  fillMode: MapFillMode;
  alignmentColor: Record<Alignment, string>;
  setHoveredName: (name: string | null) => void;
  hoveredNameRef: MutableRefObject<string | null>;
  hoveredIsParamRef: MutableRefObject<boolean>;
};

import type React from 'react';

const CountryLayers = memo(function CountryLayers({
  byName,
  baselineByName,
  visibleNames,
  selectedName,
  relatedNames,
  overlayMode,
  fillMode,
  alignmentColor,
  setHoveredName,
  hoveredNameRef,
  hoveredIsParamRef,
}: CountryLayersProps) {
  return (
    <>
      {countries.map((country) => {
        const name = country.properties.name;
        const simulated = byName.get(name);
        const baseline = baselineByName.get(name);
        const isParameterized = Boolean(simulated);
        const isVisible = isParameterized && visibleNames.has(name);
        const isSelected = selectedName === name;
        const isRelated = relatedNames.has(name);

        const fill = simulated
          ? resolveFill(fillMode, { simulated, baseline, alignmentColor })
          : NEUTRAL;
        const opacity = !isParameterized ? 0.3 : isVisible ? 1 : 0.2;

        let stroke = 'rgba(148,163,184,0.18)';
        let strokeWidth = 0.4;
        if (isRelated && overlayMode !== 'none') { stroke = overlayColor[overlayMode]; strokeWidth = 1.3; }
        if (isSelected) { stroke = '#f8fafc'; strokeWidth = 2; }

        return (
          <path
            key={`${country.id ?? name}-${name}`}
            d={countryPathStrings.get(name) ?? undefined}
            fill={fill}
            fillOpacity={opacity}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
            filter={isSelected ? 'url(#selected-glow)' : undefined}
            className="country-path"
            onPointerEnter={() => {
              hoveredNameRef.current = name;
              hoveredIsParamRef.current = isParameterized;
              setHoveredName(name);
            }}
            onPointerLeave={() => {
              hoveredNameRef.current = null;
              hoveredIsParamRef.current = false;
              setHoveredName(null);
            }}
          />
        );
      })}
    </>
  );
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type OverlayConnection = {
  countryId: string;
  mapName: string;
  displayName: string;
  score: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type Props = {
  byName: Map<string, SimulatedCountry>;
  baselineByName: Map<string, SimulatedCountry>;
  visibleNames: Set<string>;
  selectedName: string;
  onSelect: (name: string) => void;
  overlayMode: OverlayMode;
  onOverlayModeChange: (mode: OverlayMode) => void;
  fillMode: MapFillMode;
  onFillModeChange: (mode: MapFillMode) => void;
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
};

const getRelationshipMetric = (
  mode: RelationshipDimension,
  relationship: { cooperation: number; hostility: number; dependency: number; deterrence: number },
) => relationship[mode];

// ─── Component ────────────────────────────────────────────────────────────────
export function MapCanvas({
  byName,
  baselineByName,
  visibleNames,
  selectedName,
  onSelect,
  overlayMode,
  onOverlayModeChange,
  fillMode,
  onFillModeChange,
  alignmentColor,
  alignmentLabel,
}: Props) {
  // Overlay connections derive entirely from byName + selection + overlay mode,
  // so MapCanvas owns the computation. App.tsx no longer needs lib/map at all,
  // which lets the world-atlas TopoJSON ride along with this component's chunk.
  const overlayConnections = useMemo<OverlayConnection[]>(() => {
    if (overlayMode === 'none') return [];
    const sourceCentroid = countryCentroids.get(selectedName);
    if (!sourceCentroid) return [];
    const profile = byName.get(selectedName)?.profile;
    if (!profile) return [];
    const [sourceX, sourceY] = sourceCentroid;
    return profile.relationships
      .map((relationship) => {
        const targetCentroid = countryCentroids.get(relationship.mapName);
        if (!targetCentroid) return null;
        return {
          countryId: relationship.countryId,
          mapName: relationship.mapName,
          displayName: relationship.displayName,
          score: getRelationshipMetric(overlayMode, relationship),
          x1: sourceX,
          y1: sourceY,
          x2: targetCentroid[0],
          y2: targetCentroid[1],
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
  // ── Internal hover state (kept here so App.tsx never re-renders on hover) ─────
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  // Refs so pointer handlers always see the latest value without stale closures
  const hoveredNameRef = useRef<string | null>(null);
  const hoveredIsParamRef = useRef<boolean>(false);
  // ── Transform state + mirrored ref (avoids stale closures in event handlers) ─
  const [transform, setTransform] = useState({ zoom: 1, offset: { x: 0, y: 0 } });
  const transformRef = useRef(transform);
  // Keep the ref always current; this runs synchronously before effects.
  transformRef.current = transform;

  const applyTransform = useCallback((next: { zoom: number; offset: { x: number; y: number } }) => {
    transformRef.current = next; // update ref immediately so the next event sees fresh values
    setTransform(next);
  }, []);

  // ── Element refs ──────────────────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  // ── Drag tracking (refs to avoid stale closures) ──────────────────────────────
  const dragPrevRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  // ── Hover-card position (ref to avoid 60fps re-renders on mouse move) ──────────
  const hoverPosRef = useRef<{ x: number; y: number } | null>(null);

  // ── Hover-card DOM refs for imperative positioning ────────────────────────────
  const hoverCardRef = useRef<HTMLDivElement | null>(null);
  const hoverCardMutedRef = useRef<HTMLDivElement | null>(null);

  // ── Non-passive wheel handler for zoom-toward-cursor ──────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      const ctm = svg.getScreenCTM();
      if (!ctm) return;

      const { zoom, offset } = transformRef.current;

      // Normalize delta across deltaMode values (pixels / lines / pages)
      let raw = event.deltaY;
      if (event.deltaMode === 1) raw *= WHEEL_LINE_PX;
      if (event.deltaMode === 2) raw *= WHEEL_PAGE_PX;

      // Exponential scaling gives the same relative change regardless of current zoom level
      const nextZoom = clamp(zoom * Math.pow(1.001, -raw), MIN_ZOOM, MAX_ZOOM);
      const ratio = nextZoom / zoom;

      // Convert cursor to SVG viewBox coordinates
      const cursor = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());

      // Zoom toward cursor: keep the world point under the cursor fixed
      const nextOffset = clampOffset(
        {
          x: cursor.x - (cursor.x - offset.x) * ratio,
          y: cursor.y - (cursor.y - offset.y) * ratio,
        },
        nextZoom,
      );

      applyTransform({ zoom: nextZoom, offset: nextOffset });
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [applyTransform]);

  // ── Pointer handlers ──────────────────────────────────────────────────────────
  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    dragPrevRef.current = { x: event.clientX, y: event.clientY };
    didDragRef.current = false;
    // Capture on the SVG so all pointer events route here during the drag
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    // Update hover-card position imperatively — no setState so no React re-render
    const frame = frameRef.current;
    if (frame) {
      const rect = frame.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      hoverPosRef.current = { x, y };
      const w = frame.clientWidth;
      const h = frame.clientHeight;
      const cx = clamp(x + 16, 12, w - 220);
      if (hoverCardRef.current) {
        hoverCardRef.current.style.left = `${cx}px`;
        hoverCardRef.current.style.top = `${clamp(y + 16, 12, h - HOVER_CARD_HEIGHT)}px`;
      }
      if (hoverCardMutedRef.current) {
        hoverCardMutedRef.current.style.left = `${cx}px`;
        hoverCardMutedRef.current.style.top = `${clamp(y + 16, 12, h - 60)}px`;
      }
    }

    const prev = dragPrevRef.current;
    if (!prev) return;

    const svg = svgRef.current;
    if (!svg) return;

    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDragRef.current = true;

    const ctm = svg.getScreenCTM();
    if (!ctm) return;

    const { zoom, offset } = transformRef.current;

    // Convert screen delta to SVG viewBox delta (accounts for SVG viewBox scale)
    const dx_svg = dx / ctm.a;
    const dy_svg = dy / ctm.d;

    // Panning: offset = offset + delta (no division by zoom needed)
    const nextOffset = clampOffset({ x: offset.x + dx_svg, y: offset.y + dy_svg }, zoom);
    applyTransform({ zoom, offset: nextOffset });

    dragPrevRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    // If pointer was released without dragging, treat it as a click on the country
    // that was under the pointer at press-down time (pointer capture prevents path
    // onClick from firing, so we handle selection here instead).
    if (!didDragRef.current && hoveredIsParamRef.current && hoveredNameRef.current) {
      onSelect(hoveredNameRef.current);
    }
    dragPrevRef.current = null;
    svgRef.current?.releasePointerCapture(event.pointerId);
  };

  const resetView = () => applyTransform({ zoom: 1, offset: { x: 0, y: 0 } });

  // ── Convenience zoom buttons ──────────────────────────────────────────────────
  const zoomBy = (delta: number) => {
    const { zoom, offset } = transformRef.current;
    // Zoom toward the center of the visible SVG area
    const cx = MAP_WIDTH / 2;
    const cy = MAP_HEIGHT / 2;
    const nextZoom = clamp(zoom + delta, MIN_ZOOM, MAX_ZOOM);
    const ratio = nextZoom / zoom;
    const nextOffset = clampOffset(
      { x: cx - (cx - offset.x) * ratio, y: cy - (cy - offset.y) * ratio },
      nextZoom,
    );
    applyTransform({ zoom: nextZoom, offset: nextOffset });
  };

  // ── Derived values ────────────────────────────────────────────────────────────
  const { zoom, offset } = transform;
  const hovered = hoveredName ? byName.get(hoveredName) : undefined;
  const hoverPos = hoverPosRef.current;

  // Overlay geometry is drawn in world-space (inside the <g> transform), so
  // we divide sizes by zoom to keep them visually constant regardless of zoom level.
  const invZoom = 1 / zoom;

  return (
    <section className="map" aria-label="World map">
      <div className="map-frame" ref={frameRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="world-map"
          preserveAspectRatio="xMidYMid slice"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            // Moving off the map without dragging: clear state but do NOT select a country.
            dragPrevRef.current = null;
            hoveredNameRef.current = null;
            hoveredIsParamRef.current = false;
            setHoveredName(null);
            hoverPosRef.current = null;
          }}
        >
          <defs>
            {/* Navy ocean — saturated blue at the focus, deepening toward the edges. */}
            <radialGradient id="map-glow" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#1e3a8a" stopOpacity="1" />
              <stop offset="100%" stopColor="#0a1f4a" stopOpacity="1" />
            </radialGradient>
            <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.05)" strokeWidth="0.5" />
            </pattern>
            {/* stdDeviation divided by zoom → constant visual blur size at any zoom level */}
            <filter id="selected-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation={2.4 * invZoom} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-glow)" />
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-grid)" />

          <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
            {/* Memoized — only re-renders when data/selection/overlay changes, not on hover or zoom */}
            <CountryLayers
              byName={byName}
              baselineByName={baselineByName}
              visibleNames={visibleNames}
              selectedName={selectedName}
              relatedNames={relatedNames}
              overlayMode={overlayMode}
              fillMode={fillMode}
              alignmentColor={alignmentColor}
              setHoveredName={setHoveredName}
              hoveredNameRef={hoveredNameRef}
              hoveredIsParamRef={hoveredIsParamRef}
            />
            {/* Hover highlight — single path re-render instead of all 240+ paths */}
            {hoveredName && (
              <path
                d={countryPathStrings.get(hoveredName) ?? undefined}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.1}
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {overlayMode !== 'none' &&
              overlayConnections.map((connection) => (
                <g key={`overlay-${connection.countryId}-${overlayMode}`} className="relationship-overlay">
                  <line
                    x1={connection.x1}
                    y1={connection.y1}
                    x2={connection.x2}
                    y2={connection.y2}
                    stroke={overlayColor[overlayMode]}
                    strokeWidth={(1 + connection.score / 60) * invZoom}
                    strokeOpacity={0.75}
                    strokeDasharray={overlayMode === 'dependency' ? `${6 * invZoom} ${5 * invZoom}` : undefined}
                  />
                  <circle
                    cx={connection.x2}
                    cy={connection.y2}
                    r={3 * invZoom}
                    fill={overlayColor[overlayMode]}
                  />
                </g>
              ))}
          </g>
        </svg>

        {hovered && hoverPos && (
          <div
            ref={hoverCardRef}
            className="hover-card"
            style={{
              left: clamp(hoverPos.x + 16, 12, (frameRef.current?.clientWidth ?? 800) - 220),
              top: clamp(hoverPos.y + 16, 12, (frameRef.current?.clientHeight ?? 600) - HOVER_CARD_HEIGHT),
            }}
          >
            <strong>{hovered.profile.displayName}</strong>
            <span className="hover-card-row">
              <span
                className="hover-dot"
                style={{ background: alignmentColor[hovered.alignment] }}
                aria-hidden
              />
              {alignmentLabel[hovered.alignment]}
            </span>
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
                  {hovered.profile.regimeType.charAt(0).toUpperCase() + hovered.profile.regimeType.slice(1)}
                </span>
              )}
            </div>
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

        <div className="map-legend">
          {fillMode === 'alignment' &&
            (Object.keys(alignmentLabel) as Alignment[]).map((key) => (
              <span key={key} className="legend-chip">
                <i style={{ background: alignmentColor[key] }} aria-hidden />
                {alignmentLabel[key]}
              </span>
            ))}
          {fillMode === 'risk' && (
            <>
              <span className="legend-chip">
                <i style={{ background: RISK_LOW }} aria-hidden />
                Low
              </span>
              <span className="legend-chip">
                <i style={{ background: RISK_MED }} aria-hidden />
                Medium
              </span>
              <span className="legend-chip">
                <i style={{ background: RISK_HIGH }} aria-hidden />
                High
              </span>
            </>
          )}
          {fillMode === 'confidence' && (
            <>
              <span className="legend-chip">
                <i style={{ background: '#1e3a8a' }} aria-hidden />
                Low
              </span>
              <span className="legend-chip">
                <i style={{ background: '#67e8f9' }} aria-hidden />
                High
              </span>
            </>
          )}
          {fillMode === 'shift' && (
            <>
              <span className="legend-chip">
                <i style={{ background: NEUTRAL }} aria-hidden />
                Tracks baseline
              </span>
              <span className="legend-chip">
                <i style={{ background: RISK_LOW }} aria-hidden />
                Risk down
              </span>
              <span className="legend-chip">
                <i style={{ background: RISK_HIGH }} aria-hidden />
                Risk up
              </span>
              <span className="legend-chip">
                <i style={{ background: '#c77dff' }} aria-hidden />
                Alignment shifted
              </span>
            </>
          )}
          {fillMode === 'gdpPerCapita' && (
            <>
              <span className="legend-chip">
                <i style={{ background: GDP_POOR }} aria-hidden />
                &lt; $1 K
              </span>
              <span className="legend-chip">
                <i style={{ background: GDP_MID }} aria-hidden />
                ~$10 K
              </span>
              <span className="legend-chip">
                <i style={{ background: GDP_RICH }} aria-hidden />
                &gt; $100 K
              </span>
            </>
          )}
          {fillMode === 'nuclearArmed' && (
            <>
              <span className="legend-chip">
                <i style={{ background: NUCLEAR_YES }} aria-hidden />
                Nuclear armed
              </span>
              <span className="legend-chip">
                <i style={{ background: NUCLEAR_NO }} aria-hidden />
                Non-nuclear
              </span>
            </>
          )}
          {fillMode === 'militaryBurden' && (
            <>
              <span className="legend-chip">
                <i style={{ background: MIL_LOW }} aria-hidden />
                Low (&lt; 1%)
              </span>
              <span className="legend-chip">
                <i style={{ background: lerpColor(MIL_LOW, MIL_HIGH, 0.5) }} aria-hidden />
                ~2.5%
              </span>
              <span className="legend-chip">
                <i style={{ background: MIL_HIGH }} aria-hidden />
                High (5%+)
              </span>
            </>
          )}
          {fillMode === 'regime' && (
            <>
              <span className="legend-chip">
                <i style={{ background: regimeTypeColor.democracy }} aria-hidden />
                Democracy
              </span>
              <span className="legend-chip">
                <i style={{ background: regimeTypeColor.hybrid }} aria-hidden />
                Hybrid
              </span>
              <span className="legend-chip">
                <i style={{ background: regimeTypeColor.authoritarian }} aria-hidden />
                Authoritarian
              </span>
            </>
          )}
        </div>

        <div className="map-fill-toggle">
          <span className="map-overlay-label">Fill</span>
          <div className="map-overlay-row">
            {fillModeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`overlay-btn ${fillMode === option.value ? 'overlay-btn-active' : ''}`}
                onClick={() => onFillModeChange(option.value)}
                title={option.hint}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="map-overlay-toggle">
          <span className="map-overlay-label">Overlay</span>
          <div className="map-overlay-row">
            <button
              type="button"
              className={`overlay-btn ${overlayMode === 'none' ? 'overlay-btn-active' : ''}`}
              onClick={() => onOverlayModeChange('none')}
            >
              None
            </button>
            {overlayKeys.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`overlay-btn ${overlayMode === mode ? 'overlay-btn-active' : ''}`}
                onClick={() => onOverlayModeChange(mode)}
                style={
                  overlayMode === mode
                    ? ({ ['--overlay-accent' as string]: overlayColor[mode] } as React.CSSProperties)
                    : undefined
                }
              >
                <i className="overlay-dot" style={{ background: overlayColor[mode] }} aria-hidden />
                {overlayLabel[mode]}
              </button>
            ))}
          </div>
        </div>

        <div className="map-zoom">
          <IconButton label="Zoom out" onClick={() => zoomBy(-ZOOM_STEP)}>
            <SvgIcon.Minus />
          </IconButton>
          <button
            type="button"
            className="map-zoom-readout"
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
    </section>
  );
}
