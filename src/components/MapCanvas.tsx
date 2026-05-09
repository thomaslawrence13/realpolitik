import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type {
  Alignment,
  OverlayMode,
  RelationshipDimension,
  SimulatedCountry,
} from '../types';
import { MAP_HEIGHT, MAP_WIDTH, countries, path } from '../lib/map';
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Prevent the map from being dragged completely off-screen. */
function clampOffset(offset: { x: number; y: number }, zoom: number) {
  return {
    x: clamp(offset.x, -(MAP_WIDTH * zoom - PAN_MARGIN), MAP_WIDTH - PAN_MARGIN),
    y: clamp(offset.y, -(MAP_HEIGHT * zoom - PAN_MARGIN), MAP_HEIGHT - PAN_MARGIN),
  };
}

// ─── Overlay metadata ─────────────────────────────────────────────────────────
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
  visibleNames: Set<string>;
  selectedName: string;
  hoveredName: string | null;
  onSelect: (name: string) => void;
  onHover: (name: string | null) => void;
  overlayMode: OverlayMode;
  onOverlayModeChange: (mode: OverlayMode) => void;
  overlayConnections: OverlayConnection[];
  relatedNames: Set<string>;
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
};

// ─── Component ────────────────────────────────────────────────────────────────
export function MapCanvas({
  byName,
  visibleNames,
  selectedName,
  hoveredName,
  onSelect,
  onHover,
  overlayMode,
  onOverlayModeChange,
  overlayConnections,
  relatedNames,
  alignmentColor,
  alignmentLabel,
}: Props) {
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

  // ── Hover-card position ────────────────────────────────────────────────────────
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

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
        hoverCardRef.current.style.top = `${clamp(y + 16, 12, h - 90)}px`;
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
  const hovered = hoveredName ? byName.get(hoveredName) : undefined;  // Read current hover position from ref at render time (for initial card placement).
  // Subsequent mouse moves update card position imperatively without triggering re-renders.
  const hoverPos = hoverPosRef.current;  const overlayKeys: RelationshipDimension[] = ['cooperation', 'hostility', 'dependency', 'deterrence'];

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
          onPointerLeave={(event) => {
            handlePointerUp(event);
            onHover(null);
            hoverPosRef.current = null;
          }}
        >
          <defs>
            <radialGradient id="map-glow" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#0e1d3a" stopOpacity="1" />
              <stop offset="100%" stopColor="#04070d" stopOpacity="1" />
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
            {countries.map((country) => {
              const simulated = byName.get(country.properties.name);
              const isParameterized = Boolean(simulated);
              const isVisible = isParameterized && visibleNames.has(country.properties.name);
              const isSelected = selectedName === country.properties.name;
              const isHovered = hoveredName === country.properties.name;
              const isRelated = relatedNames.has(country.properties.name);

              const fill = simulated ? alignmentColor[simulated.alignment] : '#1b2538';
              let opacity = 0.3;
              if (isParameterized) opacity = isVisible ? 1 : 0.2;
              if (isHovered && isParameterized) opacity = Math.min(1, opacity + 0.05);

              // strokeWidth values are in screen pixels because of vectorEffect="non-scaling-stroke"
              let stroke = 'rgba(148,163,184,0.18)';
              let strokeWidth = 0.4;

              if (isRelated && overlayMode !== 'none') {
                stroke = overlayColor[overlayMode];
                strokeWidth = 1.3;
              }
              if (isHovered) {
                stroke = '#cbd5e1';
                strokeWidth = 1.1;
              }
              if (isSelected) {
                stroke = '#f8fafc';
                strokeWidth = 2;
              }

              return (
                <path
                  key={`${country.id ?? country.properties.name}-${country.properties.name}`}
                  d={path(country as never) ?? undefined}
                  fill={fill}
                  fillOpacity={opacity}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  // Stroke stays visually constant regardless of zoom level
                  vectorEffect="non-scaling-stroke"
                  filter={isSelected ? 'url(#selected-glow)' : undefined}
                  className="country-path"
                  onPointerEnter={() => onHover(country.properties.name)}
                  onPointerLeave={() => onHover(null)}
                  onClick={(event) => {
                    if (didDragRef.current) return;
                    event.stopPropagation();
                    if (isParameterized) onSelect(country.properties.name);
                  }}
                />
              );
            })}

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
              top: clamp(hoverPos.y + 16, 12, (frameRef.current?.clientHeight ?? 600) - 90),
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
          {(Object.keys(alignmentLabel) as Alignment[]).map((key) => (
            <span key={key} className="legend-chip">
              <i style={{ background: alignmentColor[key] }} aria-hidden />
              {alignmentLabel[key]}
            </span>
          ))}
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
