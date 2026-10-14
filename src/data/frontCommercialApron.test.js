import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getColonyMapConfig, getColonySiteFit, RIVER_GREEN_FRONTAGE } from './colonyLocation.js';
import { createColonyFrontage, createExpandedInteriorFit, createFrontageShopPlacement } from './colonyFrontage.js';
import { clipSitePolygon, prepareMapPlan, siteBoundaryEdges } from './colonySiteFit.js';
import { createCommercialApron, FRONT_COMMERCIAL_REFERENCE } from './frontCommercialApron.js';

const sourcePlan = JSON.parse(readFileSync(new URL('./threePlotGeometry.json', import.meta.url)));
const closePoint = (a, b) => a.forEach((value, i) => assert.ok(Math.abs(value - b[i]) < 1e-8));
const subtract = (a, b) => a.map((value, i) => value - b[i]);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const area = polygon => Math.abs(polygon.reduce((sum, a, i) => {
  const b = polygon[(i + 1) % polygon.length];
  return sum + a[0] * b[1] - a[1] * b[0];
}, 0) / 2);
const intersectionArea = (a, b) => {
  try { return area(clipSitePolygon(a, b)); }
  catch (error) { assert.match(error.message, /falls outside/); return 0; }
};

function fixture() {
  const plan = prepareMapPlan(sourcePlan), baseFit = getColonySiteFit(sourcePlan, getColonyMapConfig());
  const frontage = createColonyFrontage(sourcePlan, baseFit, RIVER_GREEN_FRONTAGE);
  const placement = createFrontageShopPlacement(plan, baseFit, frontage);
  const interior = createExpandedInteriorFit(plan, baseFit, frontage, placement);
  Object.assign(frontage, { shopRows: placement.rows, shopBoundary: placement.targetBoundary, shopGateFront: placement.gateFront,
    approach: interior.approach, entry: interior.entry, gardens: interior.frontageGardens,
    forecourtBoundary: interior.forecourtBoundary, forecourtTargetBoundary: interior.forecourtTargetBoundary });
  return { plan, baseFit, frontage, placement, interior };
}

test('the outside apron uses the fixed gate and both existing frontage ends as its controls', () => {
  const { frontage } = fixture(), apron = createCommercialApron(frontage);
  closePoint(apron.gate, frontage.gateTarget);
  closePoint(apron.point(FRONT_COMMERCIAL_REFERENCE.gate), frontage.gateTarget);
  closePoint(apron.point(FRONT_COMMERCIAL_REFERENCE.rearLeft), frontage.targetBoundary[2]);
  closePoint(apron.point(FRONT_COMMERCIAL_REFERENCE.rearRight), frontage.targetBoundary[1]);
  closePoint(apron.boundary[0], frontage.targetBoundary[2]);
  closePoint(apron.boundary[1], frontage.targetBoundary[1]);
  assert.ok(apron.depthScale > 0);
  assert.ok(area(apron.boundary) > 0);
  assert.ok(Math.abs(dot(apron.tangent, apron.outward)) < 1e-10);
  assert.ok(dot(subtract(apron.boundary[2], apron.gate), apron.outward) > 0, 'the new apron extends outward, away from the colony');
  closePoint(apron.entryLine[0], frontage.gateTarget);
});

test('H12 through H1 form twelve positive adjoining units without overlapping interiors', () => {
  const { frontage } = fixture(), apron = createCommercialApron(frontage);
  assert.deepEqual(apron.shops.map(shop => shop.number), Array.from({ length: 12 }, (_, i) => `H${12 - i}`));
  const rowArea = apron.shops.reduce((sum, shop) => sum + area(shop.polygon), 0);
  const outline = [apron.shops[0].polygon[0], ...apron.shops.map(shop => shop.polygon[1]),
    ...[...apron.shops].reverse().map(shop => shop.polygon[2]), apron.shops[0].polygon[3]];
  assert.ok(Math.abs(rowArea - area(outline)) < 1e-8, 'the shared boundaries must leave no gaps or duplicated area');
  apron.shops.forEach((shop, i) => {
    assert.equal(shop.polygon.length, 4);
    assert.ok(area(shop.polygon) > 0);
    assert.ok(shop.polygon.flat().every(Number.isFinite));
    assert.deepEqual(shop.facade, shop.polygon.slice(0, 2));
    siteBoundaryEdges(shop.polygon).forEach(([nx, nz, d]) => assert.ok(nx * shop.center[0] + nz * shop.center[1] + d > 0, 'the label/body center must be inside its unit'));
    if (i) {
      closePoint(apron.shops[i - 1].polygon[1], shop.polygon[0]);
      closePoint(apron.shops[i - 1].polygon[2], shop.polygon[3]);
    }
    apron.shops.slice(i + 1).forEach(other => assert.ok(intersectionArea(shop.polygon, other.polygon) < 1e-8,
      `${shop.number} and ${other.number} must not overlap`));
  });
});

test('all H shops lie within the new apron and strictly in front of the gate and existing S rows', () => {
  const { frontage, placement } = fixture(), apron = createCommercialApron(frontage);
  const depth = point => dot(subtract(point, frontage.gateTarget), apron.outward);
  const edges = siteBoundaryEdges(apron.targetBoundary);
  const maxExistingShopDepth = Math.max(...placement.rows.flatMap(row => row.targetRectangle.map(depth)));
  assert.ok(maxExistingShopDepth < 0, 'existing S shop bodies and projecting canopies remain behind the fixed gate');
  for (const shop of apron.shops) {
    for (const point of shop.polygon) {
      assert.ok(depth(point) > 0, `${shop.number} must stay outside the fixed colony entrance`);
      assert.ok(depth(point) > maxExistingShopDepth);
      edges.forEach(([nx, nz, d]) => assert.ok(nx * point[0] + nz * point[1] + d > 0, `${shop.number} must remain inside the black apron`));
    }
    assert.ok(intersectionArea(shop.polygon, apron.road) < 1e-8, 'shops must clear the diagonal external road');
  }
});

test('H1 is nearest the main road while the H12 end has the deeper taper shown in the reference', () => {
  const { frontage } = fixture(), apron = createCommercialApron(frontage);
  const h12 = apron.shops[0], h1 = apron.shops.at(-1), roadA = apron.road[0], roadB = apron.road[3];
  const distanceToRoad = point => Math.abs((roadB[0] - roadA[0]) * (point[1] - roadA[1])
    - (roadB[1] - roadA[1]) * (point[0] - roadA[0])) / Math.hypot(roadB[0] - roadA[0], roadB[1] - roadA[1]);
  assert.ok(distanceToRoad(h1.center) < distanceToRoad(h12.center));
  const unitDepth = shop => {
    const front = shop.facade[0].map((value, i) => (value + shop.facade[1][i]) / 2);
    const rear = shop.polygon[2].map((value, i) => (value + shop.polygon[3][i]) / 2);
    return dot(subtract(rear, front), apron.outward);
  };
  assert.ok(unitDepth(h12) > unitDepth(h1) * 3, 'the left end must be substantially deeper than H1');
  assert.ok(area(h12.polygon) > area(h1.polygon) * 2, 'retain the varying wedge depths instead of twelve equal rectangles');
  const depths = apron.shops.map(unitDepth);
  depths.forEach((depth, i) => { if (i) assert.ok(depth < depths[i - 1]); });
});

test('adding the commercial apron leaves the gate, interior registration and all 200 booking plot IDs untouched', () => {
  const fixtureState = fixture();
  const beforeSource = JSON.stringify(sourcePlan), before = JSON.stringify(fixtureState);
  const { frontage, plan, placement, interior, baseFit } = fixtureState;
  const gateReference = frontage.gateTarget, fitReference = interior.fit, rowFits = placement.rows.map(row => row.fit);
  const apron = createCommercialApron(frontage);
  assert.equal(JSON.stringify(sourcePlan), beforeSource);
  assert.equal(JSON.stringify(fixtureState), before);
  assert.equal(frontage.gateTarget, gateReference);
  assert.equal(interior.fit, fitReference);
  assert.deepEqual(placement.rows.map(row => row.fit), rowFits);
  assert.equal(plan.plots.length, 200);
  assert.deepEqual(interior.plan.plots.map(plot => plot.number), sourcePlan.plots.map(plot => plot.number));
  assert.equal(new Set(plan.plots.map(plot => plot.number)).size, 200);
  assert.equal(plan.plots.filter(plot => /^H\d+$/.test(plot.number)).length, 0, 'the visual H shops must not fabricate booking inventory');
  assert.notEqual(apron.gate, frontage.gateTarget, 'public descriptor points must not alias the retained gate control');
  assert.notEqual(apron.boundary, baseFit.target);
});
