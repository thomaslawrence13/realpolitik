import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from 'react';
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
const KEYBOARD_PAN_PX = 60;
const DOUBLE_CLICK_ZOOM_FACTOR = 1.8;

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
  handleDoubleClick: (event: ReactMouseEvent<SVGSVGElement>) => void;
  handleKeyDown: (event: ReactKeyboardEvent<SVGSVGElement>) => void;
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
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);

  const applyTransform = useCallback((next: Transform) => {
    transformRef.current = next;
    setTransform(next);
  }, []);

  const cancelAutoCenter = useCallback(() => {
    if (autoCenterAnimRef.current == null) return;
    cancelAnimationFrame(autoCenterAnimRef.current);
    autoCenterAnimRef.current = null;
  }, []);

  const zoomAbout = useCallback(
    (nextZoomRaw: number, anchorX: number, anchorY: number) => {
      const { zoom, offset } = transformRef.current;
      const nextZoom = clamp(nextZoomRaw, MIN_ZOOM, MAX_ZOOM);
      if (nextZoom === zoom) return;
      const ratio = nextZoom / zoom;
      const nextOffset = clampOffset(
        {
          x: anchorX - (anchorX - offset.x) * ratio,
          y: anchorY - (anchorY - offset.y) * ratio,
        },
        nextZoom,
        MAP_WIDTH,
        MAP_HEIGHT,
        PAN_MARGIN,
      );
      applyTransform({ zoom: nextZoom, offset: nextOffset });
    },
    [applyTransform],
  );

  const toViewBoxPoint = useCallback((clientX: number, clientY: number): DOMPoint | null => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    return new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
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
      cancelAutoCenter();
      const { zoom } = transformRef.current;
      let raw = event.deltaY;
      if (event.deltaMode === 1) raw *= WHEEL_LINE_PX;
      if (event.deltaMode === 2) raw *= WHEEL_PAGE_PX;
      const cursor = toViewBoxPoint(event.clientX, event.clientY);
      if (!cursor) return;
      zoomAbout(zoom * Math.pow(1.001, -raw), cursor.x, cursor.y);
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [cancelAutoCenter, toViewBoxPoint, zoomAbout]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    cancelAutoCenter();
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    svgRef.current?.setPointerCapture(event.pointerId);
    if (activePointersRef.current.size === 2) {
      const [first, second] = [...activePointersRef.current.values()];
      pinchRef.current = {
        distance: Math.hypot(second!.x - first!.x, second!.y - first!.y),
        zoom: transformRef.current.zoom,
      };
      dragPrevRef.current = null;
      didDragRef.current = true;
      return;
    }
    dragPrevRef.current = { x: event.clientX, y: event.clientY };
    didDragRef.current = false;
  }, [cancelAutoCenter]);

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

    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    const pinch = pinchRef.current;
    if (pinch && activePointersRef.current.size === 2) {
      const [first, second] = [...activePointersRef.current.values()];
      const distance = Math.hypot(second!.x - first!.x, second!.y - first!.y);
      const anchor = toViewBoxPoint(
        (first!.x + second!.x) / 2,
        (first!.y + second!.y) / 2,
      );
      if (anchor && distance > 0 && pinch.distance > 0) {
        zoomAbout(pinch.zoom * (distance / pinch.distance), anchor.x, anchor.y);
      }
      return;
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
  }, [applyTransform, toViewBoxPoint, zoomAbout]);

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      activePointersRef.current.delete(event.pointerId);
      if (activePointersRef.current.size < 2) pinchRef.current = null;
      if (!didDragRef.current && hoveredIsParamRef.current && hoveredNameRef.current) {
        mapClickRef.current = true;
        onSelect(hoveredNameRef.current);
      }
      dragPrevRef.current = null;
      if (svgRef.current?.hasPointerCapture(event.pointerId)) {
        svgRef.current.releasePointerCapture(event.pointerId);
      }
    },
    [onSelect],
  );

  const handlePointerLeave = useCallback(() => {
    dragPrevRef.current = null;
    activePointersRef.current.clear();
    pinchRef.current = null;
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
      zoomAbout(transformRef.current.zoom + delta, MAP_WIDTH / 2, MAP_HEIGHT / 2);
    },
    [zoomAbout],
  );

  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      cancelAutoCenter();
      const anchor = toViewBoxPoint(event.clientX, event.clientY);
      if (!anchor) return;
      const { zoom } = transformRef.current;
      if (zoom >= MAX_ZOOM - 0.01) resetView();
      else zoomAbout(zoom * DOUBLE_CLICK_ZOOM_FACTOR, anchor.x, anchor.y);
    },
    [cancelAutoCenter, resetView, toViewBoxPoint, zoomAbout],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<SVGSVGElement>) => {
      const { zoom, offset } = transformRef.current;
      const panStep = KEYBOARD_PAN_PX / zoom;
      const panBy = (dx: number, dy: number) => {
        cancelAutoCenter();
        applyTransform({
          zoom,
          offset: clampOffset(
            { x: offset.x + dx, y: offset.y + dy },
            zoom,
            MAP_WIDTH,
            MAP_HEIGHT,
            PAN_MARGIN,
          ),
        });
      };
      switch (event.key) {
        case 'ArrowLeft': panBy(panStep, 0); break;
        case 'ArrowRight': panBy(-panStep, 0); break;
        case 'ArrowUp': panBy(0, panStep); break;
        case 'ArrowDown': panBy(0, -panStep); break;
        case '+':
        case '=': cancelAutoCenter(); zoomBy(MAP.zoomStep); break;
        case '-':
        case '_': cancelAutoCenter(); zoomBy(-MAP.zoomStep); break;
        case '0': cancelAutoCenter(); resetView(); break;
        default: return;
      }
      event.preventDefault();
    },
    [applyTransform, cancelAutoCenter, resetView, zoomBy],
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
    handleDoubleClick,
    handleKeyDown,
  };
}
