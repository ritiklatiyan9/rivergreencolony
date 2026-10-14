import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getColonySiteFit, getColonyMapConfig, RIVER_GREEN_FRONTAGE } from './colonyLocation.js';
import { createColonyFrontage } from './colonyFrontage.js';
import { createCommercialApron } from './frontCommercialApron.js';
import { createFrontApronLandscape } from './frontApronLandscape.js';
import { siteBoundaryEdges, clipSitePolygon } from './colonySiteFit.js';
import { distanceToPolygon } from './sceneLandscape.js';

const plan = JSON.parse(readFileSync(new URL('./threePlotGeometry.json', import.meta.url)));
const fit = getColonySiteFit(plan, getColonyMapConfig());
const apron = createCommercialApron(createColonyFrontage(plan, fit, RIVER_GREEN_FRONTAGE));
const segmentDistance = (p, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};

test('grass strips follow only the borders, leaving the road side and inward openings clear', () => {
  for (const bed of createFrontApronLandscape(apron)) {
    assert.ok([0, 2, 3].includes(bed.perimeterEdge));
    assert.ok(bed.boundary.length >= 1 && bed.boundary.length <= 3);
    assert.deepEqual(bed.opening, [bed.polygon[2], bed.polygon[3]]);
    assert.ok(bed.boundary.every(edge => JSON.stringify(edge) !== JSON.stringify(bed.opening)));
    assert.ok(bed.shrubs.every(plant => segmentDistance(plant.point, ...bed.opening) > plant.radius + .01));
    assert.deepEqual(clipSitePolygon(bed.polygon, apron.boundary), bed.polygon);
    const a = apron.boundary[bed.perimeterEdge], b = apron.boundary[(bed.perimeterEdge + 1) % 4];
    assert.ok(bed.polygon.every(point => segmentDistance(point, a, b) <= .680001), 'all grass must remain in a narrow perimeter strip');
  }
});

test('grass and outer borders join at corners without gaps or internal end walls', () => {
  const beds = createFrontApronLandscape(apron), first = beds[0], front = beds.find(bed => bed.perimeterEdge === 2), side = beds.find(bed => bed.perimeterEdge === 3);
  assert.deepEqual(front.polygon[1], side.polygon[0]);
  assert.deepEqual(front.polygon[2], side.polygon[3]);
  assert.deepEqual(side.polygon[1], first.polygon[0]);
  assert.deepEqual(side.polygon[2], first.polygon[3]);
  assert.equal(side.boundary.length, 1, 'both side-strip corners are continuous rather than capped');
  assert.equal(front.boundary.length, 2, 'only the road-side end is capped');
  assert.equal(first.boundary.length, 2, 'only the gate end is capped');
});

test('complete tree and shrub canopies remain on grass and clear the driving route and all shops', () => {
  const beds = createFrontApronLandscape(apron);
  assert.ok(beds.flatMap(bed => bed.trees).length >= 12);
  assert.ok(beds.flatMap(bed => bed.shrubs).length > 20);
  for (const bed of beds) {
    const edges = siteBoundaryEdges(bed.polygon);
    for (const plant of [...bed.trees, ...bed.shrubs]) {
      assert.ok(edges.every(([nx, nz, d]) => nx * plant.point[0] + nz * plant.point[1] + d > plant.radius), 'plant canopy must remain inside its garden');
      for (let i = 0; i < apron.entryLine.length - 1; i++) {
        assert.ok(segmentDistance(plant.point, apron.entryLine[i], apron.entryLine[i + 1]) > plant.radius + .65, 'the full gate-to-road approach remains open');
      }
      assert.ok(Math.hypot(plant.point[0] - apron.roundabout.center[0], plant.point[1] - apron.roundabout.center[1]) > plant.radius + apron.roundabout.radius + .35);
      assert.ok(apron.shops.every(shop => distanceToPolygon(plant.point, shop.polygon) > plant.radius + .08), 'plants remain clear of shop buildings');
      assert.ok(apron.shops.every(shop => segmentDistance(plant.point, ...shop.facade) > plant.radius + .3), 'shop fronts and their walkways stay unobstructed');
    }
  }
});

test('landscaping does not change the apron, gate, shop footprints or original plot inventory', () => {
  const before = JSON.stringify({ apron, plan });
  createFrontApronLandscape(apron);
  assert.equal(JSON.stringify({ apron, plan }), before);
  assert.equal(plan.plots.length, 200);
});
