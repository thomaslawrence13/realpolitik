import type { RelationshipDimension } from '../../types';
import { countryCentroids } from '../../lib/map';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type RelationshipArcTarget = {
  mapName: string;
  score?: number;
  boundaryX: number;
  boundaryY: number;
};

type RelationshipArcStyle = {
  /** Base stroke colour as an [r, g, b] triple. */
  rgb: [number, number, number];
  /** Core line width in CSS pixels — stays visually constant regardless of zoom. */
  corePx?: number;
  minOpacity?: number;
  maxOpacity?: number;
  /** Dash [on, off] lengths in CSS pixels. Omit for a solid line. */
  dashPx?: [number, number];
  /** Arrowhead size in CSS pixels (tip-to-base length). 0 suppresses it. */
  arrowheadPx?: number;
  /** Suppress the soft halo beneath the core line. */
  noGlow?: boolean;
  /** Suppress the hub marker at the source centroid. */
  noOriginNode?: boolean;
};

/**
 * Arc endpoint near the target country.
 *
 * Previously this *overshot* the target away from the source, so lines often
 * landed in the ocean next to small states. We now stop at the target anchor
 * (or slightly short of it so the arrowhead/node sits on the country).
 *
 * `inset` is world units pulled back toward the source; 0 pins exactly on the
 * target centroid / geo anchor.
 */
export const computeBoundaryPoint = (
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  inset = 0,
): [number, number] => {
  if (inset <= 0) return [targetX, targetY];
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return [targetX, targetY];
  const pull = Math.min(inset, distance * 0.35);
  return [targetX - (dx / distance) * pull, targetY - (dy / distance) * pull];
};

/**
 * Draw relationship arcs from a source country to multiple targets.
 *
 * All visual sizes are expressed in CSS pixels and divided by `pixelScale`
 * (world-units → CSS px = slice × zoom) so strokes and markers stay
 * constant on screen at any map zoom level.
 *
 * Arcs alternate their perpendicular bend direction (even = left, odd = right)
 * so a fan of connections spreads naturally rather than all bowing one way.
 */
export function drawRelationshipArcs(
  ctx: CanvasRenderingContext2D,
  sourceCountry: string,
  targets: RelationshipArcTarget[],
  pixelScale: number,
  style: RelationshipArcStyle,
  /** Optional projected source anchor (prefer curated geo). Falls back to path centroid. */
  sourceAnchor?: [number, number] | null,
) {
  const source = sourceAnchor ?? countryCentroids.get(sourceCountry);
  if (!source || targets.length === 0) return;
  const [sx, sy] = source;
  const [r, g, b] = style.rgb;
  const corePx      = style.corePx      ?? 1.15;
  const minOpacity  = style.minOpacity  ?? 0.32;
  const maxOpacity  = style.maxOpacity  ?? 0.85;
  const arrowheadPx = style.arrowheadPx ?? 5;
  // Convert a CSS-px measurement into world units.
  const px   = (v: number) => v / pixelScale;
  const rgba = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;

  ctx.save();
  ctx.lineCap  = 'round';
  ctx.lineJoin = 'round';

  targets.forEach((target, arcIndex) => {
    const tx = target.boundaryX;
    const ty = target.boundaryY;
    const dx = tx - sx;
    const dy = ty - sy;
    const distance = Math.hypot(dx, dy);

    // Mild alternate bend so fans separate without drifting off-target.
    // Cap lift tightly — large bows made endpoints feel detached from countries.
    const liftSign = arcIndex % 2 === 0 ? 1 : -1;
    const liftMag  = Math.min(36, Math.sqrt(Math.max(distance, 1)) * 2.2);
    const lift     = liftSign * liftMag;
    const nx  = distance === 0 ? 0  : -dy / distance;
    const ny  = distance === 0 ? -1 :  dx / distance;
    const cpx = (sx + tx) / 2 + nx * lift;
    const cpy = (sy + ty) / 2 + ny * lift;

    const strength = clamp((target.score ?? 60) / 100, 0, 1);
    const opacity  = target.score != null
      ? clamp(target.score / 100, minOpacity, maxOpacity)
      : (minOpacity + maxOpacity) / 2;
    const widthPx  = corePx * (0.8 + 0.6 * strength);

    // Point and tangent on the quadratic bezier at parameter t.
    const bezierAt = (t: number): [number, number] => {
      const mt = 1 - t;
      return [mt * mt * sx + 2 * mt * t * cpx + t * t * tx,
              mt * mt * sy + 2 * mt * t * cpy + t * t * ty];
    };
    const bezierTangentAt = (t: number): [number, number] => {
      const mt = 1 - t;
      return [2 * mt * (cpx - sx) + 2 * t * (tx - cpx),
              2 * mt * (cpy - sy) + 2 * t * (ty - cpy)];
    };

    // Soft halo — always solid so it shows clearly beneath a dashed core.
    if (!style.noGlow) {
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.lineWidth   = px(widthPx * 3);
      ctx.strokeStyle = rgba(opacity * 0.2);
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cpx, cpy, tx, ty);
      ctx.stroke();
    }

    // Core line: gradient bright at source, faint at target → implicit direction.
    const gradient = ctx.createLinearGradient(sx, sy, tx, ty);
    gradient.addColorStop(0, rgba(opacity));
    gradient.addColorStop(1, rgba(opacity * 0.45));
    ctx.beginPath();
    ctx.lineWidth   = px(widthPx);
    ctx.strokeStyle = gradient;
    ctx.setLineDash(style.dashPx ? [px(style.dashPx[0]), px(style.dashPx[1])] : []);
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cpx, cpy, tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead near the target — placed at t≈0.86 so it sits just before
    // the endpoint node, aligned to the actual bezier tangent direction.
    if (arrowheadPx > 0) {
      const [ax, ay]     = bezierAt(0.86);
      const [tanX, tanY] = bezierTangentAt(0.86);
      const tanLen       = Math.hypot(tanX, tanY);
      if (tanLen > 0) {
        const utx    = tanX / tanLen;
        const uty    = tanY / tanLen;
        const perpX  = -uty;
        const perpY  =  utx;
        const aLen   = px(arrowheadPx);
        const aHalfW = px(arrowheadPx * 0.44);
        ctx.beginPath();
        ctx.fillStyle = rgba(opacity * 0.72);
        ctx.moveTo(ax + utx * aLen * 0.55,  ay + uty * aLen * 0.55);          // tip
        ctx.lineTo(ax - utx * aLen * 0.45 + perpX * aHalfW,
                   ay - uty * aLen * 0.45 + perpY * aHalfW);                  // left wing
        ctx.lineTo(ax - utx * aLen * 0.45 - perpX * aHalfW,
                   ay - uty * aLen * 0.45 - perpY * aHalfW);                  // right wing
        ctx.closePath();
        ctx.fill();
      }
    }

    // Target node: filled dot + faint outer ring, sized subtly by score.
    const nodeR = px(2 + 1.1 * strength);
    ctx.beginPath();
    ctx.fillStyle = rgba(clamp(opacity + 0.15, 0, 1));
    ctx.arc(tx, ty, nodeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.lineWidth   = px(0.8);
    ctx.strokeStyle = rgba(opacity * 0.5);
    ctx.arc(tx, ty, nodeR + px(1.6), 0, Math.PI * 2);
    ctx.stroke();
  });

  // Hub marker at source centroid — drawn last so it sits atop arc starts.
  if (!style.noOriginNode) {
    ctx.beginPath();
    ctx.fillStyle = rgba(maxOpacity);
    ctx.arc(sx, sy, px(2.6), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.lineWidth   = px(1);
    ctx.strokeStyle = rgba(maxOpacity * 0.4);
    ctx.arc(sx, sy, px(5), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

export const getRelationshipMetric = (
  mode: RelationshipDimension,
  relationship: { cooperation: number; hostility: number; dependency: number; deterrence: number },
) => relationship[mode];

// Per-mode arc visual parameters
export const MODE_CORE_PX: Record<RelationshipDimension, number> = {
  cooperation: 1.15,
  hostility:   1.4,
  dependency:  1.1,
  deterrence:  1.2,
};

export const MODE_DASH_PX: Partial<Record<RelationshipDimension, [number, number]>> = {
  dependency: [10, 5],
  deterrence: [3,  6],
};

export const MODE_MIN_OPACITY: Partial<Record<RelationshipDimension, number>> = {
  hostility: 0.42,
};

// Hover highlight arc colour (near-white), shared by the relationship overlay.
export const RELATIONSHIP_HOVER_RGB: [number, number, number] = [248, 250, 252];

export const overlayLabel: Record<RelationshipDimension, string> = {
  cooperation: 'Cooperation',
  hostility: 'Hostility',
  dependency: 'Dependency',
  deterrence: 'Deterrence',
};

export const overlayColor: Record<RelationshipDimension, string> = {
  cooperation: '#38bdf8',
  hostility: '#fb7185',
  dependency: '#f59e0b',
  deterrence: '#a78bfa',
};

export const overlayKeys: RelationshipDimension[] = ['cooperation', 'hostility', 'dependency', 'deterrence'];
