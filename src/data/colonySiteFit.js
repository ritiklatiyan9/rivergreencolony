// Site registration affects the layout plane only. Complete 3D assets use a
// local similarity frame, so a fitted trapezoid cannot shear a house or pool.
const R = 6378137, TAU = 2 * Math.PI;
export const PLAN_SCALE = .02;
export const mercatorPoint = ({ lat, lng }) => [(lng + 180) / 360, (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2];
export const mercatorLocation = ([x, y]) => ({ lng: x * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI });
export const mercatorMetre = lat => 1 / (TAU * R * Math.cos(lat * Math.PI / 180));
export const planWorldPoint = ([x, y], plan) => [(x - plan.width / 2) * PLAN_SCALE, (y - plan.height / 2) * PLAN_SCALE];

export function solveHomography(source, target) {
  const rows = source.flatMap(([x, y], i) => {
    const [u, v] = target[i];
    return [[x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]];
  });
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(rows[r][c]) > Math.abs(rows[pivot][c])) pivot = r;
    if (Math.abs(rows[pivot][c]) < 1e-12) throw new Error('The site boundary cannot define a footprint fit.');
    [rows[c], rows[pivot]] = [rows[pivot], rows[c]];
    const divisor = rows[c][c]; rows[c] = rows[c].map(v => v / divisor);
    for (let r = 0; r < 8; r++) if (r !== c) {
      const factor = rows[r][c]; rows[r] = rows[r].map((v, k) => v - factor * rows[c][k]);
    }
  }
  return [...rows.map(row => row[8]), 1];
}

export function fitSitePoint([x, z], h) {
  const w = h[6] * x + h[7] * z + h[8];
  return [(h[0] * x + h[1] * z + h[2]) / w, (h[3] * x + h[4] * z + h[5]) / w];
}

export function siteJacobian([x, z], h) {
  const w = h[6] * x + h[7] * z + h[8], [u, v] = fitSitePoint([x, z], h);
  return [(h[0] - u * h[6]) / w, (h[1] - u * h[7]) / w, (h[3] - v * h[6]) / w, (h[4] - v * h[7]) / w];
}

export function siteAssetFrame(anchor, h) {
  const [a, b, c, d] = siteJacobian(anchor, h), trace = a * a + b * b + c * c + d * d;
  const determinant = a * d - b * c;
  const scale = Math.sqrt(Math.max(0, (trace - Math.sqrt(Math.max(0, trace * trace - 4 * determinant * determinant))) / 2));
  const angle = Math.atan2(c - b, a + d);
  return { source: anchor, target: fitSitePoint(anchor, h), scale, angle };
}

export function fitAssetPoint([x, y, z], frame) {
  const c = Math.cos(frame.angle), s = Math.sin(frame.angle), dx = x - frame.source[0], dz = z - frame.source[1];
  return [frame.target[0] + frame.scale * (c * dx - s * dz), y * frame.scale, frame.target[1] + frame.scale * (s * dx + c * dz)];
}

export function createSiteFit(plan, config, boundary) {
  const centre = planWorldPoint(plan.roundabout.center, plan), origin = mercatorPoint(config.location);
  const scale = mercatorMetre(config.location.lat) * config.metresPerUnit, angle = config.heading * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  const worldToMercator = ([x, z]) => {
    x -= centre[0]; z -= centre[1];
    return [origin[0] + scale * (c * x - s * z), origin[1] + scale * (s * x + c * z)];
  };
  const worldFromMercator = m => {
    const x = (m[0] - origin[0]) / scale, z = (m[1] - origin[1]) / scale;
    return [centre[0] + c * x + s * z, centre[1] - s * x + c * z];
  };
  const target = boundary.map(location => worldFromMercator(mercatorPoint(location)));
  const matrix = solveHomography(plan.boundary.map(p => planWorldPoint(p, plan)), target);
  const inverse = solveHomography(target, plan.boundary.map(p => planWorldPoint(p, plan)));
  return { matrix, target, worldToMercator, worldFromMercator, point: point => fitSitePoint(point, matrix), unpoint: point => fitSitePoint(point, inverse), asset: point => siteAssetFrame(point, matrix),
    location: point => mercatorLocation(worldToMercator(fitSitePoint(planWorldPoint(point, plan), matrix))) };
}

const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
export function clipSitePolygon(polygon, boundary) {
  const area = boundary.reduce((sum, a, i) => { const b = boundary[(i + 1) % boundary.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0);
  const direction = Math.sign(area);
  let points = polygon.map(p => [...p]);
  for (let i = 0; i < boundary.length && points.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length], result = [];
    points.forEach((p, j) => {
      const q = points[(j + 1) % points.length], cp = direction * cross(a, b, p), cq = direction * cross(a, b, q);
      if (cp >= -1e-8) result.push(p);
      if ((cp >= 0) !== (cq >= 0)) { const t = cp / (cp - cq); result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    });
    points = result.filter((p, j) => !j || Math.hypot(p[0] - result[j - 1][0], p[1] - result[j - 1][1]) > 1e-7);
  }
  if (points.length > 1 && Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) < 1e-7) points.pop();
  if (points.length < 3) throw new Error('A colony polygon falls outside the registered site.');
  return points;
}

// Keep the source drawing and IDs untouched. Clip the few drawing strokes
// which extend past the perimeter before triangulating the map-only model.
export function prepareMapPlan(plan) {
  const clip = polygon => clipSitePolygon(polygon, plan.boundary);
  return { ...plan, roads: plan.roads.map(road => ({ ...road, polygon: clip(road.polygon) })),
    plots: plan.plots.map(plot => ({ ...plot, geometry: { ...plot.geometry, polygon: clip(plot.geometry.polygon) } })),
    landscaping: plan.landscaping.map(garden => ({ ...garden, polygon: clip(garden.polygon) })) };
}

export function siteBoundaryEdges(boundary) {
  const area = boundary.reduce((sum, a, i) => { const b = boundary[(i + 1) % boundary.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0), direction = Math.sign(area);
  return boundary.map((a, i) => {
    const b = boundary[(i + 1) % boundary.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -direction * (b[1] - a[1]) / length, nz = direction * (b[0] - a[0]) / length;
    return [nx, nz, -nx * a[0] - nz * a[1]];
  });
}

// Minimum translation which keeps an entire protected assembly within all
// four edges. End shops have rectangular walls around a tapered drawing cell;
// move the complete unit inward rather than clip or deform its architecture.
export function siteContainmentOffset(clearances, edges, margin = .002) {
  if (clearances.every(value => value >= margin)) return [0, 0];
  const required = clearances.map(value => margin - value), candidates = [[0, 0]];
  edges.forEach(([x, z], i) => candidates.push([x * required[i], z * required[i]]));
  edges.forEach(([ax, az], i) => edges.forEach(([bx, bz], j) => {
    if (j <= i) return;
    const determinant = ax * bz - az * bx;
    if (Math.abs(determinant) < 1e-10) return;
    candidates.push([(required[i] * bz - az * required[j]) / determinant, (ax * required[j] - required[i] * bx) / determinant]);
  }));
  const feasible = candidates.filter(([x, z]) => edges.every(([nx, nz], i) => nx * x + nz * z >= required[i] - 1e-8));
  feasible.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  if (!feasible.length) throw new Error('A protected architectural assembly is larger than the colony footprint.');
  return feasible[0];
}
