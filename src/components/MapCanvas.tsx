import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import type {
  Alignment,
  OverlayMode,
  RelationshipDimension,
  SimulatedCountry,
} from '../types';
import { MAP_HEIGHT, MAP_WIDTH, countries, path } from '../lib/map';
import { IconButton, SvgIcon } from './ui';

const MIN_ZOOM = 0.8;
const MAX_ZOOM = 3.6;
const ZOOM_STEP = 0.2;
const WHEEL_DELTA_PER_STEP = 125;
const WHEEL_ZOOM_SENSITIVITY = ZOOM_STEP / WHEEL_DELTA_PER_STEP;

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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
  zoom: number;
  offset: { x: number; y: number };
  onZoomChange: (zoom: number) => void;
  onOffsetChange: (offset: { x: number; y: number }) => void;
  overlayMode: OverlayMode;
  onOverlayModeChange: (mode: OverlayMode) => void;
  overlayConnections: OverlayConnection[];
  relatedNames: Set<string>;
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
};

export function MapCanvas({
  byName,
  visibleNames,
  selectedName,
  hoveredName,
  onSelect,
  onHover,
  zoom,
  offset,
  onZoomChange,
  onOffsetChange,
  overlayMode,
  onOverlayModeChange,
  overlayConnections,
  relatedNames,
  alignmentColor,
  alignmentLabel,
}: Props) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [didDrag, setDidDrag] = useState(false);

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    setDragStart({ x: event.clientX, y: event.clientY });
    setDidDrag(false);
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const frame = frameRef.current;
    if (frame) {
      const rect = frame.getBoundingClientRect();
      setHoverPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    }

    if (!dragStart) return;

    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) setDidDrag(true);

    onOffsetChange({
      x: offset.x + dx / zoom,
      y: offset.y + dy / zoom,
    });
    setDragStart({ x: event.clientX, y: event.clientY });
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    setDragStart(null);
    (event.target as Element).releasePointerCapture?.(event.pointerId);
  };

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    const next = clamp(zoom - event.deltaY * WHEEL_ZOOM_SENSITIVITY, MIN_ZOOM, MAX_ZOOM);
    onZoomChange(next);
  };

  const hovered = hoveredName ? byName.get(hoveredName) : undefined;
  const overlayKeys: RelationshipDimension[] = ['cooperation', 'hostility', 'dependency', 'deterrence'];

  return (
    <section className="map" aria-label="World map">
      <div className="map-frame" ref={frameRef}>
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="world-map"
          preserveAspectRatio="xMidYMid slice"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={(event) => {
            handlePointerUp(event);
            onHover(null);
            setHoverPos(null);
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
            <filter id="selected-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
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

              let stroke = 'rgba(148,163,184,0.18)';
              let strokeWidth = 0.4;

              if (isRelated && overlayMode !== 'none') {
                stroke = overlayColor[overlayMode];
                strokeWidth = 1.2;
              }
              if (isHovered) {
                stroke = '#cbd5e1';
                strokeWidth = 1.1;
              }
              if (isSelected) {
                stroke = '#f8fafc';
                strokeWidth = 1.8;
              }

              return (
                <path
                  key={`${country.id ?? country.properties.name}-${country.properties.name}`}
                  d={path(country as never) ?? undefined}
                  fill={fill}
                  fillOpacity={opacity}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  filter={isSelected ? 'url(#selected-glow)' : undefined}
                  className="country-path"
                  onPointerEnter={() => onHover(country.properties.name)}
                  onPointerLeave={() => onHover(null)}
                  onClick={(event) => {
                    if (didDrag) return;
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
                    strokeWidth={1 + connection.score / 60}
                    strokeOpacity={0.75}
                    strokeDasharray={overlayMode === 'dependency' ? '6 5' : undefined}
                  />
                  <circle cx={connection.x2} cy={connection.y2} r={3} fill={overlayColor[overlayMode]} />
                </g>
              ))}
          </g>
        </svg>

        {hovered && hoverPos && (
          <div
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
                {hovered.risk}%
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
            className="hover-card hover-card-muted"
            style={{
              left: clamp(hoverPos.x + 16, 12, (frameRef.current?.clientWidth ?? 800) - 220),
              top: clamp(hoverPos.y + 16, 12, (frameRef.current?.clientHeight ?? 600) - 60),
            }}
          >
            <strong>{hoveredName}</strong>
            <span>Visible · not yet parameterized</span>
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
          <IconButton
            label="Zoom out"
            onClick={() => onZoomChange(clamp(zoom - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
          >
            <SvgIcon.Minus />
          </IconButton>
          <button
            type="button"
            className="map-zoom-readout"
            onClick={() => {
              onZoomChange(1);
              onOffsetChange({ x: 0, y: 0 });
            }}
            title="Reset view"
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconButton
            label="Zoom in"
            onClick={() => onZoomChange(clamp(zoom + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
          >
            <SvgIcon.Plus />
          </IconButton>
        </div>
      </div>
    </section>
  );
}
