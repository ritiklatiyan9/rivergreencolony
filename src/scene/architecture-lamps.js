// Tall slim street lamps (single arm, LED head) along both boulevard kerbs
// and the north kerb of each crossroad, every ~1.8 world, standing just off
// the carriageway. None inside the roundabout, the plaza gardens or the shops.
import { distanceToPolygon, pointInPolygon, roadPolygons } from '../data/sceneLandscape.js';
import { builtPlotNumbers } from './sitePlots.js';

const SPACING = 90, KERB_GAP = 3; // plan units
// distanceToPolygon is 0 inside; the wall clearance needs the edge distance.
const edgeGap = (point, polygon) => Math.min(...polygon.map((a, i) => distanceToPolygon(point, [a, polygon[(i + 1) % polygon.length]])));

export function lampPoints(plan) {
  const roads = roadPolygons(plan), [cx, cy] = plan.roundabout.center;
  const shops = plan.plots.filter(plot => plot.number.startsWith('S')).map(plot => plot.geometry.polygon);
  const villas = plan.plots.filter(plot => builtPlotNumbers.has(plot.number)).map(plot => plot.geometry.polygon); // walls and gates there
  const plazas = plan.landscaping.map(garden => garden.polygon).filter(polygon => polygon.every(([x, y]) => Math.abs(x - cx) < 260 && Math.abs(y - cy) < 200));
  const ok = (point) => pointInPolygon(point, plan.boundary) && edgeGap(point, plan.boundary) > 12
    && roads.every(road => distanceToPolygon(point, road) > 1.5)
    && Math.hypot((point[0] - cx) / (plan.roundabout.width / 2 + 25), (point[1] - cy) / (plan.roundabout.height / 2 + 25)) > 1
    && [...plazas, ...shops].every(polygon => distanceToPolygon(point, polygon) > 4)
    && villas.every(polygon => distanceToPolygon(point, polygon) > 2);
  const points = [];
  // Nudge along the kerb when a junction or garden blocks the regular spot.
  const place = (at, toward) => { for (const shift of [0, 22, -22, 38, -38]) { const point = at(shift); if (ok(point)) { points.push({ point, toward }); return; } } };
  const boulevard = plan.roads.find(road => road.kind === 'boulevard').polygon, xs = boulevard.map(p => p[0]), ys = boulevard.map(p => p[1]);
  for (const [kerb, dir] of [[Math.min(...xs), -1], [Math.max(...xs), 1]]) {
    for (let y = Math.min(...ys) + 40; y < Math.max(...ys); y += SPACING) {
      place(shift => [kerb + dir * KERB_GAP, y + shift], [-dir, 0]);
    }
  }
  plan.roads.filter(road => road.kind === 'crossroad').forEach(({ polygon }) => {
    const x0 = Math.min(...polygon.map(p => p[0])), x1 = Math.max(...polygon.map(p => p[0])), top = Math.min(...polygon.map(p => p[1]));
    const west = x1 <= Math.min(...xs) + 1, count = Math.max(1, Math.round((x1 - x0 - 60) / SPACING)), step = (x1 - x0 - 60) / count;
    for (let i = 0; i <= count; i += 1) {
      const x = west ? x1 - 45 - i * step : x0 + 45 + i * step;
      place(shift => [x + shift, top - KERB_GAP], [0, 1]);
    }
  });
  return points;
}

export function buildLamps({ THREE, plan, kit, world }, batch, mat) {
  const pole = new THREE.CylinderGeometry(.0055, .009, .64, 8), arm = new THREE.CylinderGeometry(.0035, .0035, .13, 6);
  arm.rotateZ(-(Math.PI / 2 - .12));
  const led = kit.material('#f4f1e6', { emissive: '#fff4d6', emissiveIntensity: .45, roughness: .3 });
  lampPoints(plan).forEach(({ point, toward }) => {
    const [x, z] = world(point), yaw = Math.atan2(-toward[1], toward[0]);
    const out = (d, y) => [x + toward[0] * d, y, z + toward[1] * d];
    batch.withAsset([x, z], () => {
      batch.addBox(mat.concrete, [.034, .03, .034], [x, .015, z]);
      batch.add(mat.metal, pole, [x, .35, z]);
      batch.add(mat.metal, arm, out(.062, .673), yaw);
      batch.addBox(mat.metal, [.012, .03, .012], [x, .668, z]);
      batch.addBox(mat.metal, [.058, .008, .022], out(.134, .683), yaw);
      batch.addBox(led, [.046, .0025, .016], out(.136, .678), yaw);
    });
  });
  pole.dispose(); arm.dispose();
}
