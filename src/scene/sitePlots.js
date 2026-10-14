// Built plots from the site survey note (7 Oct 2026): a villa on every listed
// plot; bracketed pairs are one villa across both plots. Each site gets a front
// compound wall with a gate, a paved forecourt where the owners' cars park nose
// to the house (BMW, Range Rover, Scorpio), the villa, and garden planting.
// Pure layout (no three.js) in a site frame: x along the road-facing side
// (world units, centred), y = depth from that side into the plot.
import { distanceToPolygon, roadPolygons } from '../data/sceneLandscape.js';
import { villaDesign } from './architecture-villa-designs.js';

export const VILLA_SITES = [['A-15'], ['A-47'], ['B-58'], ['B-38'], ['B-24'], ['A-55'], ['B-44'], ['B-1'], ['B-14'], ['A-34'], ['B-61', 'B-62'], ['A-41', 'A-42'], ['C-9']];
export const CARS = { bmw: { length: .41, width: .165 }, rangerover: { length: .42, width: .175 }, scorpio: { length: .39, width: .165 } };
const MODELS = ['rangerover', 'bmw', 'scorpio'];
const S = .02; // world units per plan unit (kit.js SCALE)
// Keep the full .032-wide pillar caps inside, with clearance to the plot edge.
export const FORECOURT = .53, WALL_INSET = .022, CAR_GAP = .075, CAR_BACK = .06;

// x-extent of the plots along the line y (edges touching it count).
const spanAt = (polygons, y) => {
  const xs = polygons.flatMap(polygon => polygon.flatMap((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    if (a[1] === b[1] || y < Math.min(a[1], b[1]) - 1e-9 || y > Math.max(a[1], b[1]) + 1e-9) return [];
    return [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1])];
  }));
  return [Math.min(...xs), Math.max(...xs)];
};
// Largest upright rectangle inside the plots, not their bounding box: the map
// view widens the east bank into trapezoids, and a bounding box there pushes
// the compound wall into the neighbouring plots.
// ponytail: assumes level front/back edges (true for every surveyed plot).
const rectOf = (polygons) => {
  const ys = polygons.flat().map(p => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const [a0, a1] = spanAt(polygons, y0), [b0, b1] = spanAt(polygons, y1);
  return [Math.max(a0, b0), y0, Math.min(a1, b1), y1];
};

export function siteLayout(plan, numbers, index, roads = roadPolygons(plan)) {
  const plots = numbers.map(n => plan.plots.find(p => p.number === n));
  const [x0, y0, x1, y1] = rectOf(plots.map(p => p.geometry.polygon));
  // Front = the side nearest a crossroad or the frontage road (never the boulevard).
  const streets = plan.roads.filter(r => r.kind !== 'boulevard').map(r => r.polygon);
  const sides = [
    { mid: [(x0 + x1) / 2, y0], v: [0, 1], length: x1 - x0, depth: y1 - y0 },
    { mid: [(x0 + x1) / 2, y1], v: [0, -1], length: x1 - x0, depth: y1 - y0 },
    { mid: [x0, (y0 + y1) / 2], v: [1, 0], length: y1 - y0, depth: x1 - x0 },
    { mid: [x1, (y0 + y1) / 2], v: [-1, 0], length: y1 - y0, depth: x1 - x0 },
  ].map(side => ({ ...side, gap: Math.min(...streets.map(r => distanceToPolygon(side.mid, r))) })).sort((a, b) => a.gap - b.gap);
  const { mid, v, length, depth } = sides[0], u = [-v[1], v[0]];
  const W = length * S, D = depth * S;
  // Plan point of a site-frame position (x across, y deep), and back again for tests.
  const toPlan = (x, y) => [mid[0] + (u[0] * x + v[0] * y) / S, mid[1] + (u[1] * x + v[1] * y) / S];
  const wide = W > 1.9;
  const w = wide ? Math.min(W * .56, W > 3 ? 1.95 : 1.45) : Math.min(Math.max(W * .64, .7), .95), d = Math.min(Math.max(D * .46, .62), .78);
  const variant = index % 3, doorX = w * .28;
  const count = wide ? 3 : W >= 1.25 ? 2 : 1;
  const cars = [];
  let left = -W / 2 + WALL_INSET + .05;
  for (let i = 0; i < count; i += 1) {
    const model = wide ? MODELS[i] : MODELS[(index + i) % 3], { length: L, width: cw } = CARS[model];
    // Mostly white, then silver, black and the odd accent colour, as on Indian roads.
    const pick = (index * 31 + i * 17) % 20, colour = pick < 8 ? 0 : pick < 13 ? 2 : pick < 17 ? 1 : 3;
    cars.push({ model, colour, x: left + cw / 2, y: CAR_BACK + L / 2, length: L, width: cw });
    left += cw + CAR_GAP;
  }
  const carRight = left - CAR_GAP;
  const steps = { x0: doorX - .1, x1: doorX + .1, y0: FORECOURT - .06, y1: FORECOURT };
  const pad = { x0: -W / 2 + WALL_INSET + .012, x1: Math.max(carRight + .04, steps.x1 + .05), y0: WALL_INSET + .012, y1: FORECOURT };
  const gate = { x0: -W / 2 + WALL_INSET + .03, x1: carRight + .03 };
  const villa = { x0: -w / 2, x1: w / 2, y0: FORECOURT, y1: FORECOURT + d };
  // Garden: a tree on the front lawn strip, shrubs before the house there, trees at the back.
  const trees = [], shrubs = [];
  const strip = W / 2 - WALL_INSET - pad.x1;
  if (strip > .12) trees.push({ x: pad.x1 + strip / 2, y: .16, radius: Math.min(strip / 2 - .015, .11) });
  for (let x = pad.x1 + .05; x < W / 2 - .05; x += .075) shrubs.push({ x, y: FORECOURT - .035, radius: .032 });
  const back = D - villa.y1 - WALL_INSET;
  if (back > .16) for (const x of wide ? [-W * .3, 0, W * .3] : [-W * .25, W * .25]) trees.push({ x, y: villa.y1 + back / 2, radius: Math.min(back / 2 - .02, .14) });
  const design = villaDesign(variant, w, d, doorX);
  const labels = numbers.map((number, i) => {
    const plot = plots[i], [cx, cy] = plot.geometry.center;
    // Plot numbers sit on the roof, over each plot's own share of the villa.
    const along = ((cx - mid[0]) * u[0] + (cy - mid[1]) * u[1]) * S, x = Math.max(design.label.x0, Math.min(design.label.x1, along));
    return { number, point: toPlan(x, FORECOURT + design.label.depth), height: design.label.height };
  });
  return { numbers, plots, index, variant, W, D, w, d, doorX, mid, u, v, toPlan, cars, steps, pad, gate, villa, trees, shrubs, design, labels };
}

export const villaSites = (plan) => { const roads = roadPolygons(plan); return VILLA_SITES.map((numbers, i) => siteLayout(plan, numbers, i, roads)); };
export const builtPlotNumbers = new Set(VILLA_SITES.flat());
