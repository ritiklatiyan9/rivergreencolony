// Relative tracing of the supplied front layout photograph (1280 × 720).
// H units are architectural frontage, separate from the 200 booking-map cells.
// The existing gate and both ends of its frontage are the registration controls;
// no residential geometry, shop S row or interior fit is changed here.
const REFERENCE = Object.freeze({
  gate: [650, 224], rearLeft: [150, 224], rearRight: [1070, 224],
  apron: [[150, 224], [1070, 224], [685, 566], [365, 527]],
  shopBack: [[357, 359], [710, 502]],
  shopRear: [[389, 493], [685, 534]],
  road: [[1070, 224], [1136, 346], [801, 658], [685, 566]],
});
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const subtract = (a, b) => a.map((v, i) => v - b[i]);

function centroid(polygon) {
  let area = 0, x = 0, z = 0;
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length], cross = a[0] * b[1] - b[0] * a[1];
    area += cross; x += (a[0] + b[0]) * cross; z += (a[1] + b[1]) * cross;
  });
  return [x / (3 * area), z / (3 * area)];
}

export function createCommercialApron(frontage) {
  const gate = frontage.gateTarget, angle = frontage.gateHeading;
  const tangent = [Math.cos(angle), Math.sin(angle)], outward = [-tangent[1], tangent[0]];
  const rearLeft = frontage.targetBoundary[2], rearRight = frontage.targetBoundary[1];
  const left = dot(subtract(rearLeft, gate), tangent), right = dot(subtract(rearRight, gate), tangent);
  const depthScale = (right - left) / (REFERENCE.rearRight[0] - REFERENCE.rearLeft[0]);
  // One planar projection registers both rear corners and the unchanged gate.
  // It keeps the traced shop row and every shared wall straight across the apron.
  const leftSpan = REFERENCE.gate[0] - REFERENCE.rearLeft[0], rightSpan = REFERENCE.rearRight[0] - REFERENCE.gate[0];
  const leftScale = -left / leftSpan, rightScale = right / rightSpan;
  const perspective = (leftScale - rightScale) / (leftSpan * leftScale + rightSpan * rightScale);
  const alongScale = leftScale * (1 - leftSpan * perspective);
  const point = ([x, y]) => {
    const denominator = 1 + perspective * (x - REFERENCE.gate[0]);
    const along = (x - REFERENCE.gate[0]) * alongScale / denominator;
    const depth = (y - REFERENCE.gate[1]) * depthScale / denominator;
    return gate.map((v, i) => v + tangent[i] * along + outward[i] * depth);
  };
  const boundary = REFERENCE.apron.map(point);
  const shops = Array.from({ length: 12 }, (_, i) => {
    const a = i / 12, b = (i + 1) / 12;
    const polygon = [mix(...REFERENCE.shopBack, a), mix(...REFERENCE.shopBack, b),
      mix(...REFERENCE.shopRear, b), mix(...REFERENCE.shopRear, a)].map(point);
    return { number: `H${12 - i}`, polygon, facade: [polygon[0], polygon[1]], center: centroid(polygon) };
  });
  const road = REFERENCE.road.map(point);
  return { boundary, targetBoundary: boundary, road, shops, gate: [...gate], tangent, outward,
    depthScale, point, cameraBoundary: boundary,
    roundabout: { center: point([650, 365]), radius: 20 * depthScale },
    entryLine: [[650, 224], [650, 333], [650, 393], [739, 469]].map(point),
  };
}

export const FRONT_COMMERCIAL_REFERENCE = REFERENCE;
