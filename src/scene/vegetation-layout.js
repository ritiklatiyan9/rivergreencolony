// Where the new planting goes, in plan units. Every canopy (point + radius)
// stays inside the colony, clears every road and the roundabout by > 3, and
// never touches a shop plot. Pure data, so `node --test` can check it.
import { distanceToPolygon, pointInPolygon, roadPolygons } from '../data/sceneLandscape.js';
import { rng } from './kit.js';
import { builtPlotNumbers } from './sitePlots.js';

const edgeDistance = (point, polygon) => Math.min(...polygon.map((a, i) => {
  const b = polygon[(i + 1) % polygon.length], dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}));
const seedOf = (text) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647, 7);
const boundsOf = (polygon) => { const xs = polygon.map(p => p[0]), ys = polygon.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
// Point-in-any-polygon with a bounding-box prefilter (hundreds of plots).
const zone = (polygons) => { const boxes = polygons.map(boundsOf); return (point) => polygons.some((polygon, i) => { const [x0, y0, x1, y1] = boxes[i]; return point[0] >= x0 && point[0] <= x1 && point[1] >= y0 && point[1] <= y1 && pointInPolygon(point, polygon); }); };
const far = (point, radius, items, slack = 1) => items.every(item => Math.hypot(point[0] - item.point[0], point[1] - item.point[1]) > (radius + item.radius) * slack);

// The paved loop and benches life.js lays in each garden (kept in step with it).
export const parkLayout = (plan, polygon) => {
  const [cx, cy] = plan.roundabout.center, xs = polygon.map(p => p[0]), ys = polygon.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const plaza = Math.abs((minX + maxX) / 2 - cx) < 200 && Math.abs((minY + maxY) / 2 - cy) < 150;
  const [x0, x1] = !plaza ? [minX + 12, maxX - 12] : minX < cx ? [minX + 12, minX + 65] : [maxX - 65, maxX - 12];
  const top = minY + 22, bottom = maxY - 22, mid = (x0 + x1) / 2;
  return { plaza, minX, maxX, minY, maxY, loop: [[x0, top], [x1, top], [x1, bottom], [x0, bottom]], benches: [[mid + 8, top + 9], [mid - 8, bottom - 9]] };
};

export function layoutVegetation(plan, landscape, density = 1) {
  const roads = roadPolygons(plan), random = rng(8080);
  const shops = plan.plots.filter(plot => plot.number.startsWith('S')).map(plot => plot.geometry.polygon);
  // Nearest road distance; a bounding-box test skips roads that cannot be closer.
  const boxes = roads.map(boundsOf);
  const roadGap = (point) => roads.reduce((best, road, i) => {
    const [x0, y0, x1, y1] = boxes[i], box = Math.hypot(Math.max(x0 - point[0], 0, point[0] - x1), Math.max(y0 - point[1], 0, point[1] - y1));
    return box >= best ? best : Math.min(best, distanceToPolygon(point, road));
  }, Infinity);
  const clear = (point, radius, gap = roadGap(point)) => gap > radius + 3 && pointInPolygon(point, plan.boundary) && edgeDistance(point, plan.boundary) > radius
    && shops.every(shop => distanceToPolygon(point, shop) > radius);
  const keep = (list, share) => list.filter(() => random() < share);

  // Garden pockets: dense rounded tree groups (closest to the fountain first
  // in the plaza gardens) and flowering shrubs, clear of paths and benches.
  const groves = [], blooms = [];
  const fixed = [...landscape.palms.map(({ point }) => ({ point, radius: 3 })), ...landscape.shrubs.map(({ point }) => ({ point, radius: 6 }))];
  plan.landscaping.forEach(({ polygon }) => {
    const park = parkLayout(plan, polygon), [cx, cy] = plan.roundabout.center;
    if (park.plaza) return; // plaza.js owns the four gardens around the fountain
    const benches = park.benches.map(point => ({ point, radius: 5 }));
    const fits = (candidate, radius, pathGap) => {
      const { point } = candidate;
      if (!(edgeDistance(point, polygon) > radius * .45 && edgeDistance(point, park.loop) > radius + pathGap && far(point, radius, benches) && far(point, radius, fixed))) return false;
      candidate.gap ??= roadGap(point); return clear(point, radius, candidate.gap);
    };
    const candidates = [];
    for (let x = park.minX + 3; x < park.maxX; x += 4) for (let y = park.minY + 3; y < park.maxY; y += 4) {
      const point = [x + (random() - .5) * 3, y + (random() - .5) * 3];
      if (pointInPolygon(point, polygon)) candidates.push({ point, order: park.plaza ? Math.hypot((point[0] - cx) / 90, (point[1] - cy) / 80) + random() * .25 : random() });
    }
    candidates.sort((a, b) => a.order - b.order);
    const trees = [], shrubs = [];
    candidates.forEach((candidate) => {
      const { point } = candidate, radius = 5 + random() * 7;
      if (trees.length < (park.plaza ? 16 : 16) && far(point, radius, trees, .62) && fits(candidate, radius, 3)) trees.push({ point, radius });
    });
    candidates.forEach((candidate) => {
      const { point } = candidate, radius = 3 + random() * 1.8;
      if (shrubs.length < 22 && far(point, radius, trees, .85) && far(point, radius, shrubs, 1.15) && fits(candidate, radius, 2.5)) shrubs.push({ point, radius });
    });
    groves.push(...trees); blooms.push(...shrubs);
  });

  // Young fruit trees in a row along each plot's crossroad-facing edge,
  // within ~6 units of the boundary (villas may fill the interior).
  const streets = plan.roads.filter(road => road.kind !== 'boulevard').map(road => road.polygon);
  const blocked = [...landscape.trees.map(({ point, radius }) => ({ point, radius: radius * .8 }))];
  const saplings = [];
  plan.plots.forEach((plot) => {
    if (plot.number.startsWith('S') || builtPlotNumbers.has(plot.number)) return; // villa plots have their own garden (sitePlots.js)
    const polygon = plot.geometry.polygon, pick = rng(seedOf(plot.number)), row = [];
    polygon.forEach((a, i) => {
      const b = polygon[(i + 1) % polygon.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]); if (length < 30) return;
      let nx = (b[1] - a[1]) / length, ny = -(b[0] - a[0]) / length; const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (pointInPolygon([mid[0] + nx * 2, mid[1] + ny * 2], polygon)) { nx = -nx; ny = -ny; }
      if (!streets.some(street => pointInPolygon([mid[0] + nx * 5, mid[1] + ny * 5], street))) return;
      const count = length > 55 && pick() < .5 ? 3 : 2;
      for (let k = 0; k < count; k += 1) {
        const t = (k + .5 + (pick() - .5) * .35) / count, radius = 4 + pick() * 1.2, inset = radius + Math.max(1.6, 3.5 - roadGap(mid));
        const point = [a[0] + (b[0] - a[0]) * t - nx * inset, a[1] + (b[1] - a[1]) * t - ny * inset];
        if (pointInPolygon(point, polygon) && Math.min(...polygon.map(c => Math.hypot(point[0] - c[0], point[1] - c[1]))) > 8 && far(point, radius, row) && far(point, radius, blocked) && clear(point, radius)) row.push({ point, radius });
      }
    });
    saplings.push(...row.slice(0, Math.max(1, Math.round(row.length * density))));
  });

  // buildLandscape's palms and hedges, minus the plaza gardens (plaza.js plants those).
  const plazas = plan.landscaping.map(({ polygon }) => polygon).filter(polygon => parkLayout(plan, polygon).plaza);
  const outside = ({ point }) => !plazas.some(polygon => pointInPolygon(point, polygon));
  return {
    palms: landscape.palms.filter(outside), shrubs: landscape.shrubs.filter(outside),
    groves: keep(groves, .55 + .45 * density), blooms: keep(blooms, density), saplings,
  };
}
