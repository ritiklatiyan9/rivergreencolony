// The fountain plaza as drawn on the official printed plan: the circular road
// round the fountain island cuts a concave arc out of each of the four corner
// gardens; clipped hedges line their straight edges, lamp posts, a walk and
// benches follow the arc, and coconut palms line both sides of the boulevard.
// Pure data in plan units (no three.js), so `node --test` can check it.

// The printed plan's roundabout is a true circle (diameter = the plan's roundabout width) centred on the fountain.
import { pointInPolygon } from '../data/sceneLandscape.js';
import { lampPoints } from './architecture-lamps.js';
import { builtPlotNumbers } from './sitePlots.js';
import { PLAN_SCALE, planWorldPoint } from '../data/colonySiteFit.js';

const layouts = new WeakMap();

const ellipseOf = (plan) => { const [cx, cy] = plan.roundabout.center; return { cx, cy, rx: plan.roundabout.width / 2, ry: plan.roundabout.width / 2 }; };
// < 1 inside the roundabout circle, 1 on it.
export const roundaboutReach = (plan, [x, y]) => { const { cx, cy, rx, ry } = ellipseOf(plan); return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; };
const boundsOf = (polygon) => { const xs = polygon.map(p => p[0]), ys = polygon.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
export const isPlazaGarden = (plan, polygon) => {
  const [x0, y0, x1, y1] = boundsOf(polygon), [cx, cy] = plan.roundabout.center;
  return Math.abs((x0 + x1) / 2 - cx) < 200 && Math.abs((y0 + y1) / 2 - cy) < 150;
};

export function plazaLayout(plan, siteFit = null) {
  if (!layouts.has(plan)) layouts.set(plan, new Map());
  const cache = layouts.get(plan);
  if (cache.has(siteFit)) return cache.get(siteFit);
  const { cx, cy, rx, ry } = ellipseOf(plan);
  // Work in the fountain's circular frame. The garden's outer edges still
  // follow the registered roads, while every inner arc meets the same pool
  // and roundabout circle. Return inverse-projected drawing coordinates so
  // the normal site surface shader places these paths without a second fit.
  const frame = siteFit?.asset(planWorldPoint([cx, cy], plan));
  const cos = Math.cos(frame?.angle || 0), sin = Math.sin(frame?.angle || 0), unit = PLAN_SCALE * (frame?.scale || 1);
  const toPlaza = point => {
    if (!frame) return point;
    const q = siteFit.point(planWorldPoint(point, plan)), x = q[0] - frame.target[0], y = q[1] - frame.target[1];
    return [cx + (cos * x + sin * y) / unit, cy + (-sin * x + cos * y) / unit];
  };
  const fromPlaza = ([x, y]) => {
    if (!frame) return [x, y];
    x = (x - cx) * unit; y = (y - cy) * unit;
    const q = siteFit.unpoint([frame.target[0] + cos * x - sin * y, frame.target[1] + sin * x + cos * y]);
    return [q[0] / PLAN_SCALE + plan.width / 2, q[1] / PLAN_SCALE + plan.height / 2];
  };
  const onEllipse = (angle, grow = 0) => fromPlaza([cx + Math.cos(angle) * (rx + grow), cy + Math.sin(angle) * (ry + grow)]);
  const angleOf = ([x, y]) => Math.atan2((y - cy) / ry, (x - cx) / rx);
  const spread = (a0, a1, count, grow) => Array.from({ length: count }, (_, i) => onEllipse(a0 + (a1 - a0) * (i + .5) / count, grow));
  const gardens = plan.landscaping.filter(({ polygon }) => isPlazaGarden(plan, polygon)).map(({ polygon }) => {
    // Include exact line/circle intersections before sampling the concave
    // recess, so the lawn and paved circle meet without a gap at either end.
    const outline = [], cut = [];
    const fittedPolygon = polygon.map(toPlaza);
    fittedPolygon.forEach((a, i) => {
      const b = fittedPolygon[(i + 1) % polygon.length], dx = b[0] - a[0], dy = b[1] - a[1], steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
      const A = dx * dx + dy * dy, B = 2 * ((a[0] - cx) * dx + (a[1] - cy) * dy), C = (a[0] - cx) ** 2 + (a[1] - cy) ** 2 - rx * rx;
      const discriminant = B * B - 4 * A * C;
      const samples = Array.from({ length: steps }, (_, s) => s / steps);
      if (discriminant >= 0 && A > 0) for (const t of [(-B - Math.sqrt(discriminant)) / (2 * A), (-B + Math.sqrt(discriminant)) / (2 * A)]) if (t > 0 && t < 1) samples.push(t);
      samples.sort((a, b) => a - b).forEach(t => {
        const p = [a[0] + dx * t, a[1] + dy * t], q = roundaboutReach(plan, p);
        if (q <= 1 + 1e-10) { const k = 1 / Math.sqrt(q); const out = [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]; outline.push(out); cut.push(angleOf(out)); } else outline.push(p);
      });
    });
    const clean = outline.filter((p, i) => Math.hypot(p[0] - outline[(i + 1) % outline.length][0], p[1] - outline[(i + 1) % outline.length][1]) > .0001).map(fromPlaza);
    const [a0, a1] = [Math.min(...cut), Math.max(...cut)];
    // Hedge balls along every straight edge, kept off the arc walk.
    const hedges = [];
    polygon.forEach((a, i) => {
      const b = polygon[(i + 1) % polygon.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]), [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const [x0, y0, x1, y1] = boundsOf(polygon), inward = [Math.sign((x0 + x1) / 2 - mx) * (Math.abs(b[1] - a[1]) > .1 ? 1 : 0), Math.sign((y0 + y1) / 2 - my) * (Math.abs(b[0] - a[0]) > .1 ? 1 : 0)];
      for (let d = 5; d <= length - 5; d += 7) {
        const p = [a[0] + (b[0] - a[0]) * d / length + inward[0] * 4.5, a[1] + (b[1] - a[1]) * d / length + inward[1] * 4.5];
        if (roundaboutReach(plan, toPlaza(p)) > (1 + 22 / rx) ** 2) hedges.push(p);
      }
    });
    return {
      polygon, outline: clean, arc: [a0, a1], hedges,
      lamps: spread(a0, a1, 5, 3),
      walk: Array.from({ length: 25 }, (_, i) => onEllipse(a0 + (a1 - a0) * i / 24, 9)),
      benches: [.32, .68].map(t => {
        const angle = a0 + (a1 - a0) * t, [x, y] = onEllipse(angle, 15.5);
        const localAngle = siteFit?.asset(planWorldPoint([x, y], plan)).angle || 0;
        return [x, y, Math.PI - angle - (frame?.angle || 0) + localAngle];
      }),
    };
  });
  // Coconut palms along both sides of the boulevard (client: "on road side, not in
  // the middle"), just off each kerb; clear of crossings, the plaza gardens,
  // street lamps, the boulevard-facing villas and the shops at the south.
  const boulevard = plan.roads.find(road => road.kind === 'boulevard').polygon;
  const [bx0, by0, bx1] = boundsOf(boulevard);
  const crossings = plan.roads.filter(road => road.kind === 'crossroad' && road.polygon.some(([x]) => Math.abs(x - bx0) < 1 || Math.abs(x - bx1) < 1)).map(road => { const [, y0, , y1] = boundsOf(road.polygon); return [y0, y1]; });
  const lamps = lampPoints(plan).map(({ point }) => point);
  const villas = plan.plots.filter(plot => builtPlotNumbers.has(plot.number)).map(plot => plot.geometry.polygon);
  const roadsidePalms = [];
  const free = ([x, y]) => !crossings.some(([y0, y1]) => y > y0 - 10 && y < y1 + 10) && !(y > 495 && y < 730)
    && lamps.every(([lx, ly]) => Math.hypot(lx - x, ly - y) >= 9) && !villas.some(polygon => pointInPolygon([x, y], polygon));
  // Every ~6 m on each kerb; a palm that meets a lamp slides a little along the kerb instead.
  for (const x of [bx0 - 4.5, bx1 + 4.5]) for (let y = by0 + 30; y < 1110; y += 26) {
    const point = [0, 9, -9].map(dy => [x, y + dy]).find(free);
    if (point && roadsidePalms.every(([px, py]) => px !== x || Math.abs(py - point[1]) > 16)) roadsidePalms.push(point);
  }
  const island = { centre: [cx, cy], radius: plan.roundabout.gardenDiameter / 2 };
  const layout = { gardens, island, roadsidePalms, ellipse: { cx, cy, rx, ry }, arcPoint: onEllipse };
  cache.set(siteFit, layout);
  return layout;
}
