// Plastered compound wall along the west, east and south boundary (the south
// entrance stays open), pillars every ~0.35 world and coping.
import { openBoundary } from '../data/sceneLandscape.js';

const WALL = { height: .18, thick: .03, pillar: .05, pillarHeight: .205, spacing: .35 };

export function buildWall({ plan, world, frontage }, batch, mat) {
  // The north side is the Chakroad (printed plan): no wall there, and the side
  // walls stop 12 plan units short of the boundary line, at its kerb.
  const [na, nb] = plan.boundary, length = Math.hypot(nb[0] - na[0], nb[1] - na[1]);
  const inside = ([x, y]) => -((x - na[0]) * (nb[1] - na[1]) - (y - na[1]) * (nb[0] - na[0])) / length;
  const trim = (from, to) => { const f = inside(from), g = inside(to); if (f >= 12 || g <= f) return from; const t = (12 - f) / (g - f); return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]; };
  const segments = openBoundary(plan)
    .filter(([a, b]) => !frontage || !(a[1] === b[1] && a[1] > plan.entrance.center[1]))
    .filter(([a, b]) => inside(a) > 1 || inside(b) > 1)
    .map(([a, b]) => [trim(a, b), trim(b, a)]);
  buildWallSegments({ world, boundary: plan.boundary }, segments, batch, mat);
}

// A separate frontage keeps the original survey and interior walls intact.
// Choose each run's inward side from its own polygon so split gate runs need
// not rely on the caller preserving perimeter traversal order.
export function buildWallSegments({ world, boundary }, segments, batch, mat) {
  const centre = world(boundary.reduce((sum, p) => [sum[0] + p[0] / boundary.length, sum[1] + p[1] / boundary.length], [0, 0]));
  const panelInset = (WALL.thick + .012) / 2 + .001, pillarInset = (WALL.pillar + .014) / 2 + .002;
  segments.forEach(([a, b]) => {
    const [ax, az] = world(a), [bx, bz] = world(b), dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz), yaw = -Math.atan2(dz, dx);
    if (length < 1e-8) return;
    let inward = [-dz / length, dx / length];
    if ((centre[0] - (ax + bx) / 2) * inward[0] + (centre[1] - (az + bz) / 2) * inward[1] < 0) inward = inward.map(value => -value);
    const at = (t, y, inset = panelInset) => [ax + dx * t + inward[0] * inset, y, az + dz * t + inward[1] * inset];
    // The site's surveyed edge is the outside face, not the wall's centreline.
    // Keep coping and pillar caps inside that edge, including corner ends.
    const panelLength = Math.max(length - pillarInset * 2, .001);
    batch.addBox(mat.plaster, [panelLength, WALL.height, WALL.thick], at(.5, WALL.height / 2), yaw);
    batch.addBox(mat.trim, [panelLength, .012, WALL.thick + .012], at(.5, WALL.height + .004), yaw);
    batch.addBox(mat.concrete, [panelLength, .022, WALL.thick + .008], at(.5, .011), yaw);
    const spans = Math.max(1, Math.round(length / WALL.spacing));
    for (let i = 0; i <= spans; i += 1) {
      const t = (pillarInset + (length - pillarInset * 2) * i / spans) / length;
      const base = at(t, 0, pillarInset);
      batch.withAsset([base[0], base[2]], () => {
        batch.addBox(mat.plaster, [WALL.pillar, WALL.pillarHeight, WALL.pillar], at(t, WALL.pillarHeight / 2, pillarInset), yaw);
        batch.addBox(mat.trim, [WALL.pillar + .014, .012, WALL.pillar + .014], at(t, WALL.pillarHeight + .006, pillarInset), yaw);
      });
    }
  });
}

// The commercial frontage opens to the access road. A low paving edge joins
// the full side walls at the corners without blocking the shop shutters.
export function buildCurbSegments({ world, boundary, floor }, segments, batch, mat) {
  const centre = world(boundary.reduce((sum, p) => [sum[0] + p[0] / boundary.length, sum[1] + p[1] / boundary.length], [0, 0]));
  const thick = .032, height = .014, cap = .004;
  segments.forEach(([a, b]) => {
    const [ax, az] = world(a), [bx, bz] = world(b), dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
    if (length < .04) return;
    let inward = [-dz / length, dx / length];
    if ((centre[0] - (ax + bx) / 2) * inward[0] + (centre[1] - (az + bz) / 2) * inward[1] < 0) inward = inward.map(value => -value);
    const yaw = -Math.atan2(dz, dx), inset = (thick + cap) / 2 + .002;
    const at = y => [(ax + bx) / 2 + inward[0] * inset, floor + y, (az + bz) / 2 + inward[1] * inset];
    batch.addBox(mat.concrete, [length - .04, height, thick], at(height / 2), yaw);
    batch.addBox(mat.trim, [length - .04, cap, thick + cap], at(height + cap / 2), yaw);
  });
}
