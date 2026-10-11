import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { getColonyMapConfig, getColonySiteFit, RIVER_GREEN_FRONTAGE } from '../data/colonyLocation.js';
import { fitAssetPoint, prepareMapPlan, planWorldPoint } from '../data/colonySiteFit.js';
import { createColonyFrontage, createFrontageShopPlacement, createExpandedInteriorFit } from '../data/colonyFrontage.js';
import { createPlotClickGesture, createPlotSurfaces, pickPlotRay, pointInPlot } from './colonyPlotPicker.js';
import { updateMapCamera } from './colonyMapCamera.js';
import { villaSites } from './sitePlots.js';

const plan = JSON.parse(readFileSync(new URL('../data/threePlotGeometry.json', import.meta.url)));
const baseFit = getColonySiteFit(plan, getColonyMapConfig());
const basePlan = prepareMapPlan(plan), frontage = createColonyFrontage(plan, baseFit, RIVER_GREEN_FRONTAGE);
const placement = createFrontageShopPlacement(basePlan, baseFit, frontage);
const interior = createExpandedInteriorFit(basePlan, baseFit, frontage, placement);
const options = { groundHeight: .032, shopHeight: .355 };
const centre = polygon => polygon.reduce((sum, p) => [sum[0] + p[0] / polygon.length, sum[1] + p[1] / polygon.length], [0, 0]);
const surfaces = createPlotSurfaces(interior.plan, { ...options, siteFit: interior.fit, shopRows: placement.rows });

test('every original plot ID remains individually pickable in colony and fitted satellite views', () => {
  for (const cells of [surfaces, createPlotSurfaces(plan, options)]) {
    assert.equal(cells.length, 200);
    assert.deepEqual(cells.map(cell => cell.number), plan.plots.map(plot => plot.number));
    for (const cell of cells) {
      const [x, z] = centre(cell.polygon);
      assert.equal(pickPlotRay([x, 20, z], [0, -1, 0], cells), cell.number);
    }
  }
});

test('interior uses its expanded fit and shops retain their fixed wing fit and roof heights', () => {
  const residential = interior.plan.plots.find(plot => plot.number === 'A-1');
  assert.deepEqual(surfaces.find(cell => cell.number === 'A-1').polygon,
    residential.geometry.polygon.map(point => interior.fit.point(planWorldPoint(point, plan))));
  for (const row of placement.rows) for (const plot of row.plots) {
    const surface = surfaces.find(cell => cell.number === plot.number);
    assert.deepEqual(surface.polygon, plot.geometry.polygon.map(point => row.fit.point(planWorldPoint(point, plan))));
    assert.equal(surface.height, options.shopHeight * row.scale);
  }
  const row = placement.rows.find(row => row.side === 'east'), corner = row.plots.find(plot => plot.number === 'S1');
  assert.equal(corner.cornerShop, true);
  assert.notEqual(corner.geometry.polygon[1][0], corner.geometry.polygon[2][0]);
});

test('roads, parks, gate opening and outside the site do not select plots', () => {
  for (const point of [interior.plan.roundabout.center, [670, 300]]) {
    const [x, z] = interior.fit.point(planWorldPoint(point, plan));
    assert.equal(pickPlotRay([x, 20, z], [0, -1, 0], surfaces), null);
  }
  const [x, z] = placement.gateFront;
  assert.equal(pickPlotRay([x, 20, z], [0, -1, 0], surfaces), null);
  assert.equal(pickPlotRay([1000, 20, 1000], [0, -1, 0], surfaces), null);
  assert.equal(pickPlotRay([x, -10, z], [0, -1, 0], surfaces), null);
  assert.equal(pickPlotRay([x, 10, z], [1, 0, 0], surfaces), null);
});

test('pitched camera rays intersect the rendered roof rather than its ground projection', () => {
  const cell = surfaces.find(cell => cell.number === 'S1'), [x, z] = centre(cell.polygon);
  const camera = new THREE.PerspectiveCamera(45, 1.6, .01, 200);
  camera.position.set(x + .6, cell.height + 3, z + .8); camera.lookAt(x, cell.height, z); camera.updateMatrixWorld();
  const point = new THREE.Vector3(x, cell.height, z).project(camera), ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(point.x, point.y), camera);
  assert.equal(pickPlotRay(ray.ray.origin.toArray(), ray.ray.direction.toArray(), surfaces), 'S1');

  // MapLibre supplies a separated projection and shared world camera. Keep
  // picking aligned after the adapter reconstructs that camera too.
  const mapCamera = new THREE.PerspectiveCamera();
  const main = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
  updateMapCamera(mapCamera, { projectionMatrix: camera.projectionMatrix.toArray(), defaultProjectionData: { mainMatrix: main.toArray() } }, new THREE.Matrix4());
  ray.setFromCamera(new THREE.Vector2(point.x, point.y), mapCamera);
  assert.equal(pickPlotRay(ray.ray.origin.toArray(), ray.ray.direction.toArray(), surfaces), 'S1');
});

test('villa roof numbers select the correct plot, including each half of paired villas at pitched views', () => {
  for (const [drawing, fit, cells] of [[plan, null, createPlotSurfaces(plan, options)], [interior.plan, interior.fit, surfaces]]) {
    for (const site of villaSites(drawing)) {
      const frame = fit?.asset(planWorldPoint(site.toPlan(0, site.villa.y0), drawing));
      for (const label of site.labels) {
        const [x, z] = planWorldPoint(label.point, drawing), native = [x, options.groundHeight + label.height, z];
        const placed = frame ? fitAssetPoint(native, frame) : native;
        const camera = new THREE.PerspectiveCamera(45, 1.6, .01, 200);
        camera.position.set(placed[0] + .2, placed[1] + 1.5, placed[2] + .8); camera.lookAt(...placed); camera.updateMatrixWorld();
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
        assert.equal(pickPlotRay(ray.ray.origin.toArray(), ray.ray.direction.toArray(), cells), label.number);
      }
    }
  }
});

test('polygon picking supports concave cells and includes their boundary without selecting cutouts', () => {
  const polygon = [[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]];
  assert.equal(pointInPlot([.5, 2], polygon), true);
  assert.equal(pointInPlot([1, 2], polygon), true);
  assert.equal(pointInPlot([2, 2], polygon), false);
  assert.equal(pointInPlot([3.01, .5], polygon), false);
});

const pointer = (pointerId = 1, props = {}) => ({ pointerId, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100, type: 'pointerup', ...props });
test('clicks are accepted once; drags returning to start, cancellation, pinches and secondary buttons are rejected', () => {
  const gesture = createPlotClickGesture();
  gesture.begin(pointer());
  assert.equal(gesture.end(pointer()), true);
  assert.equal(gesture.end(pointer()), false, 'a bubbling pointerup cannot select twice');
  gesture.begin(pointer()); gesture.move(pointer(1, { clientX: 112 })); gesture.move(pointer());
  assert.equal(gesture.end(pointer()), false);
  gesture.begin(pointer()); gesture.cancel(); assert.equal(gesture.end(pointer()), false);
  gesture.begin(pointer()); gesture.begin(pointer(2, { pointerType: 'touch' }));
  assert.equal(gesture.end(pointer(2)), false); assert.equal(gesture.end(pointer()), false);
  for (const props of [{ button: 2 }, { shiftKey: true }, { ctrlKey: true }, { metaKey: true }]) {
    gesture.begin(pointer(1, props)); assert.equal(gesture.end(pointer(1, props)), false);
  }
  gesture.begin(pointer()); assert.equal(gesture.end(pointer(1, { type: 'pointercancel' })), false);
  gesture.begin(pointer(1, { pointerType: 'touch' })); assert.equal(gesture.end(pointer(1, { pointerType: 'touch' })), true);
});
