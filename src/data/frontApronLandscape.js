// Narrow planting strips follow the existing forecourt perimeter. The road
// edge and the gate opening are left clear; there are no beds in the centre.
import { siteBoundaryEdges } from './colonySiteFit.js';

function insetCorners(polygon, inset) {
  const edges = siteBoundaryEdges(polygon);
  return edges.map(([nx, nz, d], i) => {
    const [px, pz, pd] = edges[(i + edges.length - 1) % edges.length];
    const det = px * nz - pz * nx, previous = inset - pd, current = inset - d;
    return [(previous * nz - pz * current) / det, (px * current - previous * nx) / det];
  });
}

export function createFrontApronLandscape(apron) {
  const beds = [], middle = apron.boundary.reduce((sum, p) => sum.map((v, i) => v + p[i] / 4), [0, 0]);
  const outer = insetCorners(apron.boundary, .14), inner = insetCorners(apron.boundary, .68);
  for (const edge of [0, 2, 3]) {
    const a = apron.boundary[edge], b = apron.boundary[(edge + 1) % 4];
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz), tangent = [dx / length, dz / length];
    let normal = [-tangent[1], tangent[0]];
    if ((middle[0] - (a[0] + b[0]) / 2) * normal[0] + (middle[1] - (a[1] + b[1]) / 2) * normal[1] < 0) normal = normal.map(v => -v);
    const at = (along, inset) => a.map((v, i) => v + tangent[i] * along + normal[i] * inset);
    const gateAlong = (apron.gate[0] - a[0]) * tangent[0] + (apron.gate[1] - a[1]) * tangent[1];
    const next = (edge + 1) % 4;
    const strips = edge === 0 ? [
      { polygon: [outer[0], at(gateAlong - 1.2, .14), at(gateAlong - 1.2, .68), inner[0]], capStart: false, capEnd: true },
      { polygon: [at(gateAlong + 1.2, .14), outer[1], inner[1], at(gateAlong + 1.2, .68)], capStart: true, capEnd: true },
    ] : [{ polygon: [outer[edge], outer[next], inner[next], inner[edge]], capStart: edge === 2, capEnd: false }];
    strips.forEach(({ polygon, capStart, capEnd }, index) => {
      const along = point => (point[0] - a[0]) * tangent[0] + (point[1] - a[1]) * tangent[1];
      const start = Math.max(along(polygon[0]), along(polygon[3])), end = Math.min(along(polygon[1]), along(polygon[2]));
      const edges = siteBoundaryEdges(polygon);
      const trees = [], shrubs = [];
      const fits = (point, radius) => edges.every(([nx, nz, d]) => nx * point[0] + nz * point[1] + d >= radius + .012);
      for (let distance = start + .35; distance < end - .3; distance += 1.4) {
        const point = at(distance, .41);
        if (fits(point, .2)) trees.push({ point, radius: .2, height: .7 + trees.length % 2 * .08, variant: trees.length % 2 });
      }
      for (let distance = start + .18; distance < end - .18; distance += .42) {
        const point = at(distance, .25);
        if (fits(point, .065)) shrubs.push({ point, radius: .065 });
      }
      // Joined corners share both lawn vertices. Only the gate and road ends
      // have caps; there is no cross-wall cutting the continuous grass strip.
      const boundary = [[polygon[0], polygon[1]]];
      if (capEnd) boundary.push([polygon[1], polygon[2]]);
      if (capStart) boundary.push([polygon[3], polygon[0]]);
      beds.push({ name: `Forecourt border garden ${edge}-${index}`, perimeterEdge: edge, polygon,
        center: at((start + end) / 2, .41), boundary,
        opening: [polygon[2], polygon[3]], trees, shrubs });
    });
  }
  return beds;
}
