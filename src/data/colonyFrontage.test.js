import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getColonyMapConfig, getColonySiteFit } from './colonyLocation.js';
import { createColonyFrontage, createExpandedInteriorFit, createFrontageShopPlacement } from './colonyFrontage.js';
import { clipSitePolygon, fitAssetPoint, fitSitePoint, mercatorPoint, PLAN_SCALE, planWorldPoint, prepareMapPlan, siteBoundaryEdges } from './colonySiteFit.js';

const plan = JSON.parse(readFileSync(new URL('./threePlotGeometry.json', import.meta.url)));
const fit = getColonySiteFit(plan, getColonyMapConfig());
const marks = {
  outerLeft: { lng: 77.29573872685432, lat: 29.469016583278982 },
  outerRight: { lng: 77.29641673564907, lat: 29.47008067697554 },
  gate: { lng: 77.29607936739922, lat: 29.469551200218408 },
};
const target = point => fit.point(planWorldPoint(point, plan));
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
const closePoint = (actual, expected, tolerance) => actual.forEach((value, i) => close(value, expected[i], tolerance));
const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const area = polygon => Math.abs(polygon.reduce((sum, a, i) => { const b = polygon[(i + 1) % polygon.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0) / 2);
const intersectionArea = (polygon, boundary) => {
  try { return area(clipSitePolygon(polygon, boundary)); }
  catch (error) { assert.match(error.message, /falls outside/); return 0; }
};

test('frontage preserves the interior calibration and joins the original front edge without a seam', () => {
  const originalPlan = JSON.stringify(plan), originalFit = JSON.stringify({ matrix: fit.matrix, target: fit.target });
  const interior = [...plan.plots.flatMap(plot => plot.geometry.polygon), plan.roundabout.center];
  const positions = interior.map(target);
  const frontage = createColonyFrontage(plan, fit, marks);
  closePoint(frontage.boundary[0], plan.boundary[2]);
  closePoint(frontage.boundary[3], plan.boundary[3]);
  closePoint(frontage.targetBoundary[0], fit.target[2]);
  closePoint(frontage.targetBoundary[3], fit.target[3]);
  closePoint(frontage.approach[0], [650, 1307.5]);
  closePoint(frontage.approach[1], [690, 1307.5]);
  closePoint(frontage.entry, [670, 1307.5]);
  assert.equal(JSON.stringify(plan), originalPlan);
  assert.equal(JSON.stringify({ matrix: fit.matrix, target: fit.target }), originalFit);
  interior.forEach((point, i) => closePoint(target(point), positions[i]));
});

test('front corners continue the original sides and the marked gate lies on the new outer front', () => {
  const frontage = createColonyFrontage(plan, fit, marks);
  const [innerRight, outerRight, outerLeft, innerLeft] = frontage.targetBoundary;
  close(cross(fit.target[0], innerLeft, outerLeft), 0);
  close(cross(fit.target[1], innerRight, outerRight), 0);
  close(cross(outerLeft, outerRight, frontage.gateTarget), 0);
  closePoint(frontage.gateTarget, fit.worldFromMercator(mercatorPoint(marks.gate)));
  // The line intersection corrects only the rounding of the visual marks.
  closePoint(outerLeft, fit.worldFromMercator(mercatorPoint(marks.outerLeft)), .002);
  closePoint(outerRight, fit.worldFromMercator(mercatorPoint(marks.outerRight)), .002);
  assert.ok(frontage.gate[1] > frontage.entry[1]);
});

test('the approach remains inside the annex and its opening matches the undistorted portal scale', () => {
  const frontage = createColonyFrontage(plan, fit, marks), edges = siteBoundaryEdges(frontage.targetBoundary);
  for (const polygon of [frontage.approach, frontage.gateGap, ...frontage.wallSegments]) for (const point of polygon) {
    const [x, z] = target(point);
    edges.forEach(([nx, nz, offset]) => assert.ok(nx * x + nz * z + offset >= -1e-8, 'frontage elements must stay in the annex'));
  }
  const [gateRight, gateLeft] = frontage.approach.slice(2).map(target);
  close(Math.hypot(gateRight[0] - gateLeft[0], gateRight[1] - gateLeft[1]), 40 * PLAN_SCALE * frontage.gateScale);
  const [gapLeft, gapRight] = frontage.gateGap.map(target);
  close(Math.hypot(gapRight[0] - gapLeft[0], gapRight[1] - gapLeft[1]), 70 * PLAN_SCALE * frontage.gateScale);
  closePoint(target(frontage.wallSegments[1][1]), gapRight);
  closePoint(target(frontage.wallSegments[2][0]), gapLeft);
  assert.ok(Math.hypot(gapRight[0] - gapLeft[0], gapRight[1] - gapLeft[1]) > 1.21 * frontage.gateScale);
});

test('camera footprint includes the extended outer corners while keeping the original rear corners', () => {
  const frontage = createColonyFrontage(plan, fit, marks);
  closePoint(frontage.cameraBoundary[0], plan.boundary[0]);
  closePoint(frontage.cameraBoundary[1], plan.boundary[1]);
  closePoint(frontage.cameraBoundary[2], frontage.outerFront[1]);
  closePoint(frontage.cameraBoundary[3], frontage.outerFront[0]);
  const cameraEdges = siteBoundaryEdges(frontage.cameraBoundary.map(target));
  for (const point of [...plan.boundary, ...frontage.boundary]) {
    const [x, z] = target(point);
    cameraEdges.forEach(([nx, nz, offset]) => assert.ok(nx * x + nz * z + offset >= -1e-8));
  }
});

test('relocating the commercial frontage preserves all IDs and the residential registration', () => {
  const mapped = prepareMapPlan(plan), before = JSON.stringify(mapped), originalFit = JSON.stringify(fit.matrix);
  const frontage = createColonyFrontage(mapped, fit, marks), placement = createFrontageShopPlacement(mapped, fit, frontage);
  assert.equal(placement.rows.length, 2);
  assert.equal(placement.rows.flatMap(row => row.plots).length, 34);
  assert.equal(placement.plots.length, 200);
  assert.deepEqual(placement.plots.map(plot => plot.number), mapped.plots.map(plot => plot.number));
  mapped.plots.filter(plot => !plot.number.startsWith('S')).forEach(plot => assert.equal(placement.plots.find(item => item.number === plot.number), plot));
  assert.equal(JSON.stringify(mapped), before);
  assert.equal(JSON.stringify(fit.matrix), originalFit);
  placement.rows.forEach(row => row.plots.forEach((plot, i) => {
    const moved = placement.plots.find(item => item.number === plot.number);
    moved.geometry.polygon.forEach((point, j) => closePoint(target(point), row.targetPolygons[i][j]));
    closePoint(target(moved.geometry.center), row.fit.point(planWorldPoint(plot.geometry.center, mapped)));
  }));
});

test('both shop rows retain orthogonal proportions and align continuously with the marked gate', () => {
  const mapped = prepareMapPlan(plan), frontage = createColonyFrontage(mapped, fit, marks), placement = createFrontageShopPlacement(mapped, fit, frontage);
  for (const row of placement.rows) {
    closePoint(row.fit.point(row.sourceFront), row.targetFront);
    closePoint(fitSitePoint(row.sourceFront, row.fit.matrix), row.targetFront);
    close(Math.hypot(row.targetFront[0] - placement.gateFront[0], row.targetFront[1] - placement.gateFront[1]), .4 * frontage.gateScale);
    for (const plot of row.plots) {
      const xs = plot.geometry.polygon.map(([x]) => x), ys = plot.geometry.polygon.map(([, y]) => y);
      const anchor = planWorldPoint([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2], mapped);
      assert.ok(row.scale <= fit.asset(anchor).scale + 1e-10, 'a relocated shop must never exceed its previous proportional dimensions');
      const frame = row.fit.asset(anchor), origin = fitAssetPoint([anchor[0], 0, anchor[1]], frame);
      const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(axis => fitAssetPoint([anchor[0] + axis[0], axis[1], anchor[1] + axis[2]], frame).map((value, i) => value - origin[i]));
      axes.forEach(axis => close(Math.hypot(...axis), row.scale));
      close(axes[0].reduce((sum, value, i) => sum + value * axes[2][i], 0), 0);
    }
    const front = Math.max(...row.plots.flatMap(plot => plot.geometry.polygon.map(([, y]) => y)));
    row.plots.forEach(plot => plot.geometry.polygon.filter(([, y]) => Math.abs(y - front) < 1e-8).forEach(source => {
      const p = row.fit.point(planWorldPoint(source, mapped));
      close(cross(placement.rows[0].targetFront, placement.rows[1].targetFront, p), 0);
    }));
  }
  close(Math.hypot(placement.gateFront[0] - frontage.gateTarget[0], placement.gateFront[1] - frontage.gateTarget[1]), .135 * frontage.gateScale + .002);
});

test('whole shop rows including canopies remain within the extended site boundary', () => {
  const mapped = prepareMapPlan(plan), frontage = createColonyFrontage(mapped, fit, marks), placement = createFrontageShopPlacement(mapped, fit, frontage);
  const edges = siteBoundaryEdges(placement.targetBoundary);
  for (const row of placement.rows) {
    assert.equal(row.clipBoundary, placement.targetBoundary);
    for (const [x, z] of [...row.targetRectangle, ...row.targetPolygons.flat()]) {
      edges.forEach(([nx, nz, offset]) => assert.ok(nx * x + nz * z + offset >= .002 - 1e-8));
    }
    // A unit's protected placement and the row surface placement coincide,
    // keeping body, roof, paving and status geometry on the same footprint.
    row.plots.forEach(plot => {
      const source = planWorldPoint(plot.geometry.center, mapped), frame = row.fit.asset(source);
      plot.geometry.polygon.forEach(point => {
        const original = planWorldPoint(point, mapped), rigid = fitAssetPoint([original[0], 0, original[1]], frame);
        closePoint([rigid[0], rigid[2]], row.fit.point(original));
      });
    });
  }
});

test('S1 fills the tapered eastern corner as one larger shop joined to S2', () => {
  const mapped = prepareMapPlan(plan), before = JSON.stringify(mapped), frontage = createColonyFrontage(mapped, fit, marks);
  const placement = createFrontageShopPlacement(mapped, fit, frontage), east = placement.rows.find(row => row.side === 'east');
  const corner = east.plots.find(plot => plot.number === 'S1'), neighbour = east.plots.find(plot => plot.number === 'S2');
  assert.equal(corner.cornerShop, true);
  assert.equal(east.plots.length, 17);
  assert.equal(placement.plots.length, 200);
  assert.ok(area(corner.geometry.polygon) > area(neighbour.geometry.polygon) * 1.5, 'the printed end shop is larger than the regular units');
  const shared = neighbour.geometry.polygon.filter(([x]) => Math.abs(x - Math.max(...neighbour.geometry.polygon.map(([x]) => x))) < 1e-8);
  shared.forEach(point => assert.ok(corner.geometry.polygon.some(next => Math.hypot(next[0] - point[0], next[1] - point[1]) < 1e-8), 'S1 must join S2 along the whole party wall'));
  const side = siteBoundaryEdges(placement.targetBoundary)[1];
  corner.geometry.polygon.filter(([x]) => x > shared[0][0] + 1e-8).forEach(source => {
    const [x, z] = east.fit.point(planWorldPoint(source, mapped));
    close(side[0] * x + side[1] * z + side[2], .065);
  });
  assert.notEqual(corner.geometry.polygon[1][0], corner.geometry.polygon[2][0], 'the outer wall must follow the tapered colony boundary');
  east.plots.filter(plot => plot.number !== 'S1').forEach(plot => assert.equal(plot, mapped.plots.find(original => original.number === plot.number)));
  assert.equal(JSON.stringify(mapped), before, 'the source plan and original IDs must stay intact');
});

test('the complete printed grid keeps its row depths while the right bank fills the site', () => {
  const mapped = prepareMapPlan(plan), before = JSON.stringify(mapped), frontage = createColonyFrontage(mapped, fit, marks);
  const placement = createFrontageShopPlacement(mapped, fit, frontage), frames = JSON.stringify(placement.rows.map(row => row.fit.matrix));
  const expanded = createExpandedInteriorFit(mapped, fit, frontage, placement);
  close(expanded.frontY, 1118); close(expanded.originalFrontY, 1118);
  assert.deepEqual(expanded.plan.plots.map(plot => plot.number), mapped.plots.map(plot => plot.number));
  assert.equal(expanded.plan.plots.length, 200);
  assert.equal(JSON.stringify(mapped), before);
  assert.equal(JSON.stringify(placement.rows.map(row => row.fit.matrix)), frames);
  assert.equal(expanded.plan.roundabout, mapped.roundabout);
  mapped.plots.forEach((plot, i) => {
    const updated = expanded.plan.plots[i];
    assert.deepEqual(updated.geometry.polygon.map(([, y]) => y), plot.geometry.polygon.map(([, y]) => y), `${plot.number} must retain its printed row depth`);
    close(updated.geometry.center[1], plot.geometry.center[1]);
    if (plot.number.startsWith('S') || plot.geometry.polygon.every(([x]) => x <= 690)) assert.equal(updated, plot);
  });
  const residential = mapped.plots.filter(plot => !plot.number.startsWith('S'));
  const depth = plot => Math.max(...plot.geometry.polygon.map(([, y]) => y)) - Math.min(...plot.geometry.polygon.map(([, y]) => y));
  const frontRow = residential.filter(plot => Math.max(...plot.geometry.polygon.map(([, y]) => y)) > 1035);
  const otherSingleRows = residential.filter(plot => !frontRow.includes(plot) && depth(plot) >= 70 && depth(plot) <= 100);
  const mean = rows => rows.reduce((sum, plot) => sum + depth(plot), 0) / rows.length;
  assert.equal(frontRow.length, 14);
  assert.ok(mean(frontRow) / mean(otherSingleRows) < 1.15, 'the front row must have a depth comparable to the other single rows');
  // The extended physical span is filled by the complete unmodified grid.
  // Every row uses this same homography rather than a separate row multiplier.
  const front = [670, expanded.frontY], rear = [670, 120];
  const distance = placement => {
    const a = placement.point(planWorldPoint(front, mapped)), b = placement.point(planWorldPoint(rear, mapped));
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  };
  assert.ok(distance(expanded.fit) > distance(fit) * 1.1, 'the whole residential plane must fill the newly available length');
});

test('the eastern ground and road ends join the fixed side wall with width shared across every row', () => {
  const mapped = prepareMapPlan(plan), frontage = createColonyFrontage(mapped, fit, marks), placement = createFrontageShopPlacement(mapped, fit, frontage);
  const expanded = createExpandedInteriorFit(mapped, fit, frontage, placement);
  const side = siteBoundaryEdges(placement.targetBoundary)[1];
  const clearance = ([x, z]) => side[0] * x + side[1] * z + side[2];
  // This gap used to reach 2.8 world units (~17 m) near the front corner.
  close(clearance(expanded.fit.target[1]), 0);
  close(clearance(expanded.fit.target[2]), 0);
  const sideX = (a, b, y) => a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
  let adjusted = 0;
  mapped.plots.forEach((plot, i) => {
    if (plot.number.startsWith('S') || plot.geometry.polygon.every(([x]) => x <= 690)) return;
    const next = expanded.plan.plots[i];
    plot.geometry.polygon.forEach(([x, y], j) => {
      const originalWidth = sideX(mapped.boundary[1], mapped.boundary[2], y) - 690;
      const fittedWidth = sideX(expanded.plan.boundary[1], expanded.plan.boundary[2], y) - 690;
      close((next.geometry.polygon[j][0] - 690) / fittedWidth, (x - 690) / originalWidth);
    });
    assert.ok(next.geometry.polygon.some(([x], j) => x > plot.geometry.polygon[j][0] + .01), `${plot.number} must share the right-bank correction`);
    adjusted++;
  });
  assert.ok(adjusted > 70, 'distribute the correction across the whole right bank, not a single column');
  const eastRoads = expanded.plan.roads.filter(road => road.kind === 'crossroad' && road.polygon.some(([x]) => x > 690));
  assert.equal(eastRoads.length, 5);
  eastRoads.forEach(road => {
    const clearances = road.polygon.filter(([x]) => x > 690).map(source => clearance(expanded.fit.point(planWorldPoint(source, mapped))));
    assert.ok(Math.max(...clearances) < .04, 'each crossroad must reach the side wall rather than stop at the old bank edge');
  });
});

test('the forecourt covers the complete front strip and joins both residential corners without a hole', () => {
  const mapped = prepareMapPlan(plan), frontage = createColonyFrontage(mapped, fit, marks), placement = createFrontageShopPlacement(mapped, fit, frontage);
  const expanded = createExpandedInteriorFit(mapped, fit, frontage, placement), court = expanded.forecourtTargetBoundary;
  closePoint(court[0], expanded.fit.target[2]); closePoint(court[3], expanded.fit.target[3]);
  closePoint(court[1], placement.targetBoundary[2]); closePoint(court[2], placement.targetBoundary[3]);
  expanded.forecourtBoundary.forEach((source, i) => closePoint(target(source), court[i]));
  const edges = siteBoundaryEdges(court), outside = siteBoundaryEdges(placement.targetBoundary);
  frontage.targetBoundary.forEach(([x, z]) => edges.forEach(([nx, nz, offset]) => assert.ok(nx * x + nz * z + offset >= -1e-8, 'the former apron must lie within the continuous forecourt')));
  court.forEach(([x, z]) => outside.forEach(([nx, nz, offset]) => assert.ok(nx * x + nz * z + offset >= -1e-8)));
  assert.ok(area(court) > area(frontage.targetBoundary), 'cover the missing corner wedges as well as the original apron');
});

test('distributed fitting preserves every crossroad width and the boulevard width from the printed plan', () => {
  const mapped = prepareMapPlan(plan), frontage = createColonyFrontage(mapped, fit, marks), placement = createFrontageShopPlacement(mapped, fit, frontage);
  const expanded = createExpandedInteriorFit(mapped, fit, frontage, placement);
  const crossroad = road => Math.max(...road.polygon.map(([, y]) => y)) - Math.min(...road.polygon.map(([, y]) => y));
  const originalCrossroads = mapped.roads.filter(road => road.kind === 'crossroad' && Math.min(...road.polygon.map(([, y]) => y)) < expanded.originalFrontY);
  const crossroads = expanded.plan.roads.filter(road => road.kind === 'crossroad');
  assert.equal(crossroads.length, originalCrossroads.length);
  crossroads.forEach((road, i) => { close(crossroad(road), crossroad(originalCrossroads[i])); assert.equal(road.label, originalCrossroads[i].label); });
  const boulevard = expanded.plan.roads.find(road => road.kind === 'boulevard');
  close(Math.max(...boulevard.polygon.map(([x]) => x)) - Math.min(...boulevard.polygon.map(([x]) => x)), 40);
});

test('expanded plots and roads remain behind the commercial rear line and never intersect shop footprints', () => {
  const mapped = prepareMapPlan(plan), frontage = createColonyFrontage(mapped, fit, marks), placement = createFrontageShopPlacement(mapped, fit, frontage);
  const expanded = createExpandedInteriorFit(mapped, fit, frontage, placement), interiorEdges = siteBoundaryEdges(expanded.fit.target);
  assert.equal(expanded.fit.target.length, 4, 'the fitted interior must retain its four-edge clip region');
  const outsideEdges = siteBoundaryEdges(placement.targetBoundary);
  expanded.fit.target.forEach(([x, z]) => outsideEdges.forEach(([nx, nz, offset]) => assert.ok(nx * x + nz * z + offset >= -1e-8)));
  const outward = [-Math.sin(frontage.gateHeading), Math.cos(frontage.gateHeading)];
  const polygons = [...expanded.plan.plots.filter(plot => !plot.number.startsWith('S')).map(plot => plot.geometry.polygon), ...expanded.plan.roads.map(road => road.polygon)]
    .map(polygon => polygon.map(source => expanded.fit.point(planWorldPoint(source, mapped))));
  for (const polygon of polygons) {
    assert.ok(area(polygon) > 0);
    polygon.forEach(([x, z]) => {
      const depth = (x - placement.gateFront[0]) * outward[0] + (z - placement.gateFront[1]) * outward[1];
      assert.ok(depth <= expanded.rearLine + 1e-8, 'front plot banks must not extend into the moved shops');
      interiorEdges.forEach(([nx, nz, offset]) => assert.ok(nx * x + nz * z + offset >= -1e-8));
    });
    placement.rows.forEach(row => close(intersectionArea(polygon, row.targetRectangle), 0));
  }
  placement.rows.forEach(row => close(intersectionArea(expanded.targetApproach, row.targetRectangle), 0));
  assert.ok(!expanded.plan.roads.some(road => road.kind === 'frontage'));
  assert.ok(!expanded.plan.roads.some(road => road.kind === 'crossroad' && Math.min(...road.polygon.map(([, y]) => y)) >= expanded.originalFrontY));
});

test('a short straight approach joins the expanded boulevard to the marked gate without breaking road edges', () => {
  const mapped = prepareMapPlan(plan), frontage = createColonyFrontage(mapped, fit, marks), placement = createFrontageShopPlacement(mapped, fit, frontage);
  const expanded = createExpandedInteriorFit(mapped, fit, frontage, placement);
  const boulevard = expanded.plan.roads.find(road => road.kind === 'boulevard');
  close(Math.max(...boulevard.polygon.map(([, y]) => y)), expanded.frontY);
  closePoint(expanded.targetApproach[0], expanded.fit.point(planWorldPoint([650, expanded.frontY], mapped)));
  closePoint(expanded.targetApproach[1], expanded.fit.point(planWorldPoint([690, expanded.frontY], mapped)));
  closePoint(expanded.targetApproach[2].map((value, i) => (value + expanded.targetApproach[3][i]) / 2), frontage.gateTarget);
  expanded.approach.forEach((source, i) => closePoint(fit.point(planWorldPoint(source, mapped)), expanded.targetApproach[i]));
  expanded.plan.roads.forEach(road => road.polygon.forEach((a, i) => {
    const b = road.polygon[(i + 1) % road.polygon.length], targetA = expanded.fit.point(planWorldPoint(a, mapped)), targetB = expanded.fit.point(planWorldPoint(b, mapped));
    for (let j = 1; j < 8; j++) {
      const t = j / 8, point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      close(cross(targetA, targetB, expanded.fit.point(planWorldPoint(point, mapped))), 0, 1e-7);
    }
  }));
});

test('the corner park remains positive and inside the frontage while the four central gardens stay intact', () => {
  const mapped = prepareMapPlan(plan), frontage = createColonyFrontage(mapped, fit, marks), placement = createFrontageShopPlacement(mapped, fit, frontage);
  const expanded = createExpandedInteriorFit(mapped, fit, frontage, placement);
  assert.equal(expanded.plan.landscaping.length, 4);
  assert.equal(expanded.frontageGardens.length, 1);
  expanded.plan.landscaping.forEach(garden => {
    const original = mapped.landscaping.find(item => item.corner && Object.keys(item.corner)[0] === Object.keys(garden.corner)[0]);
    assert.ok(original);
    assert.deepEqual(garden.polygon.map(([, y]) => y), original.polygon.map(([, y]) => y));
    if (original.polygon.every(([x]) => x <= 690)) assert.equal(garden, original);
  });
  expanded.frontageGardens.forEach(item => {
    assert.ok(area(item.targetPolygon) > 0);
    const edges = siteBoundaryEdges(item.clipBoundary);
    item.garden.polygon.forEach((source, i) => {
      const [x, z] = item.fit.point(planWorldPoint(source, mapped));
      closePoint([x, z], item.targetPolygon[i]);
      edges.forEach(([nx, nz, offset]) => assert.ok(nx * x + nz * z + offset >= -1e-8));
    });
  });
});
