import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type {
  Alignment,
  MapFillMode,
  OverlayMode,
  SimulatedCountry,
} from '../types';
import { MAP_HEIGHT, MAP_WIDTH, countryCentroids, countryPathStrings, projectLonLat } from '../lib/map';
import { getRiskTier } from '../simulation';
import { IconButton, SvgIcon } from './ui';
import { summarizeCountryTrust, TrustTag } from './provenance';
import { useMapStore } from '../store/useMapStore';
import { MAP, STORAGE_KEYS } from '../lib/constants';
import { clamp, easeInOut, capitalize } from './map/utils';
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
import { CountryLayers } from './map/CountryLayers';
import { MapLegendControls } from './map/MapLegendControls';
import {
  criticalMineralIntensityScore,
  debtVulnerabilityScore,
  demographicPressureScore,
  formatGrowthPct,
  parseHex,
} from './map/countryColors';

const clampOffset = (offset: { x: number; y: number }, zoom: number): { x: number; y: number } => ({
  x: clamp(offset.x, -(MAP_WIDTH * zoom - PAN_MARGIN), MAP_WIDTH - PAN_MARGIN),
  y: clamp(offset.y, -(MAP_HEIGHT * zoom - PAN_MARGIN), MAP_HEIGHT - PAN_MARGIN),
});

const WHEEL_LINE_PX = MAP.wheelLinePx;
const WHEEL_PAGE_PX = MAP.wheelPagePx;
const MIN_ZOOM = MAP.minZoom;
const MAX_ZOOM = MAP.maxZoom;
const ZOOM_STEP = MAP.zoomStep;
const PAN_MARGIN = MAP.panMargin;
const HOVER_CARD_HEIGHT = MAP.hoverCardHeight;
const LABELS_ZOOM_THRESHOLD = MAP.labelsZoomThreshold;
const LABEL_BASE_FONT_SIZE = MAP.labelBaseFontSize;
const LABEL_STROKE_WIDTH = MAP.labelStrokeWidth;
const MAP_UI_STATE_KEY = STORAGE_KEYS.mapUiState;

type MapUiState = {
  overlayMode: OverlayMode;
  fillMode: MapFillMode;
};

const loadMapUiState = (): Partial<MapUiState> | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MAP_UI_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MapUiState>;
    return parsed;
  } catch {
    return null;
  }
};

const saveMapUiState = (state: MapUiState) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MAP_UI_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};

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
  byName: Map<string, SimulatedCountry>;
  baselineByName: Map<string, SimulatedCountry>;
  visibleNames: Set<string>;
  selectedName: string;
  onSelect: (name: string) => void;
  initialOverlayMode?: OverlayMode;
  initialFillMode?: MapFillMode;
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
  baselineByName,
  visibleNames,
  selectedName,
  onSelect,
  initialOverlayMode,
  initialFillMode,
  alignmentColor,
  alignmentLabel,
}: Props) {
  const persistedMapUiState = useMemo(() => loadMapUiState(), []);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>(
    persistedMapUiState?.overlayMode ?? initialOverlayMode ?? 'none',
  );
  // Live-tracker default: risk choropleth (stats-first). Alignment remains available.
  const [fillMode, setFillMode] = useState<MapFillMode>(
    persistedMapUiState?.fillMode ?? initialFillMode ?? 'risk',
  );
  const handleOverlayModeChange = useCallback((mode: OverlayMode) => setOverlayMode(mode), []);
  const handleFillModeChange = useCallback((mode: MapFillMode) => setFillMode(mode), []);

  useEffect(() => {
    saveMapUiState({ overlayMode, fillMode });
  }, [fillMode, overlayMode]);

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
  // ── Internal hover state (kept here so App.tsx never re-renders on hover) ─────
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const hoveredCountry = useMapStore((state) => state.hoveredCountry);
  const setHoveredCountry = useMapStore((state) => state.setHoveredCountry);
  // Coalesce rapid border-crossing hover updates so RightInspector bilateral
  // strip does not re-render more than once per frame.
  const hoverRafRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<string | null | undefined>(undefined);
  const setHoveredCountryCoalesced = useCallback(
    (name: string | null) => {
      pendingHoverRef.current = name;
      if (hoverRafRef.current != null) return;
      hoverRafRef.current = requestAnimationFrame(() => {
        hoverRafRef.current = null;
        if (pendingHoverRef.current === undefined) return;
        setHoveredCountry(pendingHoverRef.current);
        pendingHoverRef.current = undefined;
      });
    },
    [setHoveredCountry],
  );
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
  const relationshipCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Drag tracking (refs to avoid stale closures) ──────────────────────────────
  const dragPrevRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  // ── Hover-card position (ref to avoid 60fps re-renders on mouse move) ──────────
  const hoverPosRef = useRef<{ x: number; y: number } | null>(null);

  // ── Hover-card DOM refs for imperative positioning ────────────────────────────
  const hoverCardRef = useRef<HTMLDivElement | null>(null);
  const hoverCardMutedRef = useRef<HTMLDivElement | null>(null);

  // ── Auto-center animation state ───────────────────────────────────────────────
  const autoCenterAnimRef = useRef<number | null>(null);
  // Set to true in handlePointerUp so the auto-center effect skips map clicks.
  const mapClickRef      = useRef(false);
  // Skip centering on the very first render (initial country is already visible).
  const isFirstSelectRef = useRef(true);

  // ── Non-passive wheel handler for zoom-toward-cursor ──────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (autoCenterAnimRef.current != null) {
        cancelAnimationFrame(autoCenterAnimRef.current);
        autoCenterAnimRef.current = null;
      }

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
    // Cancel any running auto-center animation so the drag takes immediate control.
    if (autoCenterAnimRef.current != null) {
      cancelAnimationFrame(autoCenterAnimRef.current);
      autoCenterAnimRef.current = null;
    }
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
      mapClickRef.current = true; // skip auto-center; country is already in view
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

  // ── Auto-center on external selection (sidebar, URL state, auto-play, etc.) ──
  useEffect(() => {
    // Skip the first render — the default country is already in view.
    if (isFirstSelectRef.current) {
      isFirstSelectRef.current = false;
      return;
    }
    // Skip selections that originated from a direct map click; the country is
    // already visible and re-centering would feel jarring.
    if (mapClickRef.current) {
      mapClickRef.current = false;
      return;
    }

    const centroid = countryCentroids.get(selectedName);
    if (!centroid) return;

    const [wx, wy] = centroid;
    const { zoom: startZoom, offset: startOffset } = transformRef.current;

    // Center the world point at MAP_WIDTH/2, MAP_HEIGHT/2 (the viewport centre
    // in viewBox units), then clamp so the map doesn't scroll out of bounds.
    const targetOffset = clampOffset(
      { x: MAP_WIDTH / 2 - startZoom * wx, y: MAP_HEIGHT / 2 - startZoom * wy },
      startZoom,
    );

    // Don't animate if already essentially centred.
    if (Math.hypot(targetOffset.x - startOffset.x, targetOffset.y - startOffset.y) < 4) return;

    if (autoCenterAnimRef.current != null) cancelAnimationFrame(autoCenterAnimRef.current);

    const DURATION = 450;
    const startTime = performance.now();
    const animate = (now: number) => {
      const t    = Math.min(1, (now - startTime) / DURATION);
      const ease = easeInOut(t);
      applyTransform({
        zoom: startZoom,
        offset: {
          x: startOffset.x + (targetOffset.x - startOffset.x) * ease,
          y: startOffset.y + (targetOffset.y - startOffset.y) * ease,
        },
      });
      if (t < 1) {
        autoCenterAnimRef.current = requestAnimationFrame(animate);
      } else {
        autoCenterAnimRef.current = null;
      }
    };
    autoCenterAnimRef.current = requestAnimationFrame(animate);
  }, [selectedName, applyTransform]);

  // Cancel any running animation when the component unmounts.
  useEffect(() => () => {
    if (autoCenterAnimRef.current != null) cancelAnimationFrame(autoCenterAnimRef.current);
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
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            // Moving off the map without dragging: clear state but do NOT select a country.
            dragPrevRef.current = null;
            hoveredNameRef.current = null;
            hoveredIsParamRef.current = false;
            setHoveredName(null);
              setHoveredCountryCoalesced(null);
            hoverPosRef.current = null;
          }}
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
                baselineByName={baselineByName}
                visibleNames={visibleNames}
                selectedName={selectedName}
                relatedNames={relatedNames}
                overlayMode={overlayMode}
                fillMode={fillMode}
                alignmentColor={alignmentColor}
                setHoveredName={setHoveredName}
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
                  const indicators = hovered.profile.dataQuality?.indicators ?? [];
                  const fallbackCount = indicators.filter((indicator) => indicator.evidenceClass === 'fallback').length;
                  const staleCount = indicators.filter((indicator) => indicator.stale).length;
                  return `${hovered.profile.sourceCoverage}% cov · ${fallbackCount} fallback · ${staleCount} stale`;
                })()}
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

        <MapLegendControls
          fillMode={fillMode}
          overlayMode={overlayMode}
          alignmentColor={alignmentColor}
          alignmentLabel={alignmentLabel}
        />

        {/* ── Unified bottom toolbar: Fill · Overlay · Zoom ── */}
        <div className="map-toolbar">
          <div className="map-toolbar-section">
            <span className="map-toolbar-label">Fill</span>
            <select
              className="map-toolbar-select"
              value={fillMode}
              onChange={(e) => handleFillModeChange(e.target.value as MapFillMode)}
              title="Select map fill mode"
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
          </div>

          <div className="map-toolbar-divider" aria-hidden />

          <div className="map-toolbar-section">
            <span className="map-toolbar-label">Overlay</span>
            <div className="map-toolbar-btn-row">
              <button
                type="button"
                className={`map-toolbar-btn${overlayMode === 'none' ? ' map-toolbar-btn-active' : ''}`}
                onClick={() => handleOverlayModeChange('none')}
              >
                None
              </button>
              {overlayKeys.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`map-toolbar-btn${overlayMode === mode ? ' map-toolbar-btn-active' : ''}`}
                  onClick={() => handleOverlayModeChange(mode)}
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

          <div className="map-toolbar-section map-toolbar-zoom">
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
