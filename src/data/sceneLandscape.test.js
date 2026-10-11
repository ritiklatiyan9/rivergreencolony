import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLandscape, distanceToPolygon, openBoundary, pointInPolygon, roadPolygons } from './sceneLandscape.js';

const plan = JSON.parse(readFileSync(new URL('./threePlotGeometry.json', import.meta.url)));

test('clearance accounts for polygon interiors, edges, and corners', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(distanceToPolygon([5, 5], square), 0);
  assert.equal(distanceToPolygon([5, 0], square), 0);
  assert.equal(distanceToPolygon([15, 5], square), 5);
  assert.equal(distanceToPolygon([13, 14], square), 5);
});

test('every complete plant canopy clears all roads, crossings, plaza, and forecourt', () => {
  const landscape = buildLandscape(plan), roads = roadPolygons(plan);
  assert.ok(landscape.palms.length >= 5 && landscape.trees.length >= 25 && landscape.shrubs.length >= 20);
  for (const [type, plants] of Object.entries(landscape)) for (const { point, radius } of plants) {
    assert.ok(pointInPolygon(point, plan.boundary), `${type} remains inside the colony`);
    for (const road of roads) assert.ok(distanceToPolygon(point, road) > radius + 3, `${type} at ${point} blocks a route`);
    // Verify the visible canopy perimeter too, rather than only its anchor.
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 24) {
      const edge = [point[0] + Math.cos(angle) * radius, point[1] + Math.sin(angle) * radius];
      for (const road of roads) assert.equal(pointInPolygon(edge, road), false);
    }
  }
  assert.equal(distanceToPolygon([670, 285], roads[0]), 0, 'the previous road-centre palm position is rejected');
  assert.equal(distanceToPolygon([670, 1288], roads.at(-2)), 0, 'the front forecourt is kept open');
});

test('palms and low hedges belong to the mapped gardens', () => {
  const { palms, shrubs } = buildLandscape(plan);
  for (const { point } of [...palms, ...shrubs]) assert.ok(plan.landscaping.some(garden => pointInPolygon(point, garden.polygon)));
});

test('the perimeter preserves its outline and leaves the gate road open', () => {
  const segments = openBoundary(plan), [x] = plan.entrance.center;
  const frontY = Math.max(...plan.boundary.map(point => point[1]));
  const front = segments.filter(([a, b]) => a[1] === frontY && b[1] === frontY);
  assert.equal(front.length, 2);
  for (const [a, b] of front) assert.ok(Math.max(a[0], b[0]) <= x - 30 || Math.min(a[0], b[0]) >= x + 30);
  assert.equal(segments.length, plan.boundary.length + 1);
});
