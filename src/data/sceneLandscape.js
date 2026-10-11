// Coordinates stay in the original colony plan's units. A plant's entire
// canopy, rather than just its trunk, must clear every road and the plaza.
export const pointInPolygon = ([x, y], polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i], [bx, by] = polygon[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
};

export const distanceToPolygon = (point, polygon) => {
  if (pointInPolygon(point, polygon)) return 0;
  return Math.min(...polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length], dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
  }));
};

export const roadPolygons = (plan) => [...plan.roads.map(road => road.polygon),
  Array.from({ length: 96 }, (_, i) => {
    const angle = i / 96 * Math.PI * 2;
    return [plan.roundabout.center[0] + Math.cos(angle) * plan.roundabout.width / 2,
      plan.roundabout.center[1] + Math.sin(angle) * plan.roundabout.height / 2];
  }),
];

export function buildLandscape(plan) {
  const roads = roadPolygons(plan);
  const clear = (point, radius) => pointInPolygon(point, plan.boundary)
    && roads.every(polygon => distanceToPolygon(point, polygon) > radius + 3);
  const palms = [], trees = [], shrubs = [];
  plan.landscaping.forEach(({ polygon }) => {
    const minX = Math.min(...polygon.map(p => p[0])), maxX = Math.max(...polygon.map(p => p[0]));
    const minY = Math.min(...polygon.map(p => p[1])), maxY = Math.max(...polygon.map(p => p[1]));
    for (const point of [[minX + 32, minY + 33], [maxX - 32, maxY - 33]]) {
      if (clear(point, 25)) palms.push({ point, radius: 25 });
    }
    for (let x = minX + 10; x <= maxX - 10; x += 17) for (const y of [minY + 10, maxY - 10]) {
      const point = [x, y];
      if (clear(point, 8) && palms.every(palm => Math.hypot(x - palm.point[0], y - palm.point[1]) > 28)) shrubs.push({ point, radius: 8 });
    }
  });
  plan.boundary.forEach((a, i) => {
    const b = plan.boundary[(i + 1) % plan.boundary.length], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    for (let d = 38; d < length - 28; d += 70) {
      const point = [a[0] + dx * d / length - dy / length * 20, a[1] + dy * d / length + dx / length * 20];
      if (clear(point, 17)) trees.push({ point, radius: 17 });
    }
  });
  return { palms, trees, shrubs };
}

export function openBoundary(plan) {
  const segments = [], gap = plan.entrance.roadWidth / 2 + 10;
  plan.boundary.forEach((a, i) => {
    const b = plan.boundary[(i + 1) % plan.boundary.length];
    if (a[1] === b[1] && a[1] > plan.entrance.center[1]) {
      const x = plan.entrance.center[0], left = [x - gap, a[1]], right = [x + gap, a[1]];
      if (a[0] > b[0]) segments.push([a, right], [left, b]);
      else segments.push([a, left], [right, b]);
    } else segments.push([a, b]);
  });
  return segments;
}
