import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';
import { MAP_HEIGHT, MAP_WIDTH, countryCentroids } from '../lib/map';
import { MAP } from '../lib/constants';
import { useMapStore } from '../store/useMapStore';
import { clamp, clampOffset, easeInOut } from '../components/map/utils';

const WHEEL_LINE_PX = MAP.wheelLinePx;
const WHEEL_PAGE_PX = MAP.wheelPagePx;
const MIN_ZOOM = MAP.minZoom;
const MAX_ZOOM = MAP.maxZoom;
const PAN_MARGIN = MAP.panMargin;
const HOVER_CARD_HEIGHT = MAP.hoverCardHeight;

type Transform = { zoom: number; offset: { x: number; y: number } };

type Options = {
  selectedName: string;
  onSelect: (name: string) => void;
};

export type MapInteraction = {
  svgRef: MutableRefObject<SVGSVGElement | null>;
  frameRef: MutableRefObject<HTMLDivElement | null>;
  hoverCardRef: MutableRefObject<HTMLDivElement | null>;
  hoverCardMutedRef: MutableRefObject<HTMLDivElement | null>;
  hoverPosRef: MutableRefObject<{ x: number; y: number } | null>;
  hoveredName: string | null;
  hoveredNameRef: MutableRefObject<string | null>;
  hoveredIsParamRef: MutableRefObject<boolean>;
  hoveredCountry: string | null;
  setHoveredCountryCoalesced: (name: string | null) => void;
  transform: Transform;
  resetView: () => void;
  zoomBy: (delta: number) => void;
  handlePointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
  handlePointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  handlePointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
  handlePointerLeave: () => void;
};

/**
 * Owns all map viewport interaction: wheel zoom, pointer pan/click, hover
 * positioning, and selection auto-centering. Keeping this state together means
 * MapCanvas can focus on drawing layers instead of coordinating input lifecycles.
 */
export function useMapInteraction({ selectedName, onSelect }: Options): MapInteraction {
  const [transform, setTransform] = useState<Transform>({ zoom: 1, offset: { x: 0, y: 0 } });
  const hoveredCountry = useMapStore((state) => state.hoveredCountry);
  const setHoveredCountry = useMapStore((state) => state.setHoveredCountry);

  const transformRef = useRef(transform);
  transformRef.current = transform;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const hoverCardRef = useRef<HTMLDivElement | null>(null);
  const hoverCardMutedRef = useRef<HTMLDivElement | null>(null);
  const hoverPosRef = useRef<{ x: number; y: number } | null>(null);
  const hoveredNameRef = useRef<string | null>(null);
  const hoveredIsParamRef = useRef(false);
  const dragPrevRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const hoverRafRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<string | null | undefined>(undefined);
  const autoCenterAnimRef = useRef<number | null>(null);
  const mapClickRef = useRef(false);
  const isFirstSelectRef = useRef(true);

  const applyTransform = useCallback((next: Transform) => {
    transformRef.current = next;
    setTransform(next);
  }, []);

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
      let raw = event.deltaY;
      if (event.deltaMode === 1) raw *= WHEEL_LINE_PX;
      if (event.deltaMode === 2) raw *= WHEEL_PAGE_PX;
      const nextZoom = clamp(zoom * Math.pow(1.001, -raw), MIN_ZOOM, MAX_ZOOM);
      const ratio = nextZoom / zoom;
      const cursor = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
      const nextOffset = clampOffset(
        {
          x: cursor.x - (cursor.x - offset.x) * ratio,
          y: cursor.y - (cursor.y - offset.y) * ratio,
        },
        nextZoom,
        MAP_WIDTH,
        MAP_HEIGHT,
        PAN_MARGIN,
      );
      applyTransform({ zoom: nextZoom, offset: nextOffset });
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [applyTransform]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (autoCenterAnimRef.current != null) {
      cancelAnimationFrame(autoCenterAnimRef.current);
      autoCenterAnimRef.current = null;
    }
    dragPrevRef.current = { x: event.clientX, y: event.clientY };
    didDragRef.current = false;
    svgRef.current?.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const frame = frameRef.current;
    if (frame) {
      const rect = frame.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      hoverPosRef.current = { x, y };
      const w = frame.clientWidth;
      const h = frame.clientHeight;
      const left = clamp(x + 16, 12, w - 220);
      hoverCardRef.current?.style.setProperty('left', `${left}px`);
      hoverCardRef.current?.style.setProperty('top', `${clamp(y + 16, 12, h - HOVER_CARD_HEIGHT)}px`);
      hoverCardMutedRef.current?.style.setProperty('left', `${left}px`);
      hoverCardMutedRef.current?.style.setProperty('top', `${clamp(y + 16, 12, h - 60)}px`);
    }

    const previous = dragPrevRef.current;
    if (!previous) return;
    const svg = svgRef.current;
    if (!svg) return;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDragRef.current = true;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const { zoom, offset } = transformRef.current;
    const nextOffset = clampOffset(
      { x: offset.x + dx / ctm.a, y: offset.y + dy / ctm.d },
      zoom,
      MAP_WIDTH,
      MAP_HEIGHT,
      PAN_MARGIN,
    );
    applyTransform({ zoom, offset: nextOffset });
    dragPrevRef.current = { x: event.clientX, y: event.clientY };
  }, [applyTransform]);

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (!didDragRef.current && hoveredIsParamRef.current && hoveredNameRef.current) {
        mapClickRef.current = true;
        onSelect(hoveredNameRef.current);
      }
      dragPrevRef.current = null;
      svgRef.current?.releasePointerCapture(event.pointerId);
    },
    [onSelect],
  );

  const handlePointerLeave = useCallback(() => {
    dragPrevRef.current = null;
    hoveredNameRef.current = null;
    hoveredIsParamRef.current = false;
    setHoveredCountryCoalesced(null);
    hoverPosRef.current = null;
  }, [setHoveredCountryCoalesced]);

  const resetView = useCallback(() => {
    applyTransform({ zoom: 1, offset: { x: 0, y: 0 } });
  }, [applyTransform]);

  const zoomBy = useCallback(
    (delta: number) => {
      const { zoom, offset } = transformRef.current;
      const cx = MAP_WIDTH / 2;
      const cy = MAP_HEIGHT / 2;
      const nextZoom = clamp(zoom + delta, MIN_ZOOM, MAX_ZOOM);
      const ratio = nextZoom / zoom;
      const nextOffset = clampOffset(
        { x: cx - (cx - offset.x) * ratio, y: cy - (cy - offset.y) * ratio },
        nextZoom,
        MAP_WIDTH,
        MAP_HEIGHT,
        PAN_MARGIN,
      );
      applyTransform({ zoom: nextZoom, offset: nextOffset });
    },
    [applyTransform],
  );

  useEffect(() => {
    if (isFirstSelectRef.current) {
      isFirstSelectRef.current = false;
      return;
    }
    if (mapClickRef.current) {
      mapClickRef.current = false;
      return;
    }
    const centroid = countryCentroids.get(selectedName);
    if (!centroid) return;
    const [wx, wy] = centroid;
    const { zoom: startZoom, offset: startOffset } = transformRef.current;
    const targetOffset = clampOffset(
      { x: MAP_WIDTH / 2 - startZoom * wx, y: MAP_HEIGHT / 2 - startZoom * wy },
      startZoom,
      MAP_WIDTH,
      MAP_HEIGHT,
      PAN_MARGIN,
    );
    if (Math.hypot(targetOffset.x - startOffset.x, targetOffset.y - startOffset.y) < 4) return;
    if (autoCenterAnimRef.current != null) cancelAnimationFrame(autoCenterAnimRef.current);
    const duration = 450;
    const startTime = performance.now();
    const animate = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = easeInOut(t);
      applyTransform({
        zoom: startZoom,
        offset: {
          x: startOffset.x + (targetOffset.x - startOffset.x) * ease,
          y: startOffset.y + (targetOffset.y - startOffset.y) * ease,
        },
      });
      if (t < 1) autoCenterAnimRef.current = requestAnimationFrame(animate);
      else autoCenterAnimRef.current = null;
    };
    autoCenterAnimRef.current = requestAnimationFrame(animate);
  }, [applyTransform, selectedName]);

  useEffect(
    () => () => {
      if (autoCenterAnimRef.current != null) cancelAnimationFrame(autoCenterAnimRef.current);
      if (hoverRafRef.current != null) cancelAnimationFrame(hoverRafRef.current);
    },
    [],
  );

  return {
    svgRef,
    frameRef,
    hoverCardRef,
    hoverCardMutedRef,
    hoverPosRef,
    hoveredName: hoveredCountry,
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
  };
}
