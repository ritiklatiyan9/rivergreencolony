import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { colonyPointToLatLng, COLONY_PLAN_SCALE, getColonyMapConfig, getColonySiteFit } from '../data/colonyLocation.js';
import { createColonyMapTransform } from './colonyMapPlacement.js';

const plan = JSON.parse(readFileSync(new URL('../data/threePlotGeometry.json', import.meta.url)));
const config = getColonyMapConfig();
const radians = v => v * Math.PI / 180;
const mercator = ({ lat, lng }) => new THREE.Vector3((lng + 180) / 360,
  (1 - Math.asinh(Math.tan(radians(lat))) / Math.PI) / 2, 0);
const metresInMercator = 1 / (2 * Math.PI * 6378137 * Math.cos(radians(config.location.lat)));
const anchor = mercator(config.location);
const transform = createColonyMapTransform(plan, config, anchor, metresInMercator);
const close = (a, b, tolerance = 2e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);

test('map placement preserves circular fountain radii, building proportions and perpendicular axes', () => {
  const origin = new THREE.Vector3(2, .4, -3).applyMatrix4(transform);
  const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]
    .map(axis => axis.add(new THREE.Vector3(2, .4, -3)).applyMatrix4(transform).sub(origin).divideScalar(metresInMercator));
  axes.forEach(axis => close(axis.length(), config.metresPerUnit));
  close(axes[0].dot(axes[1]), 0); close(axes[1].dot(axes[2]), 0); close(axes[0].dot(axes[2]), 0);
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * 2 * Math.PI;
    const point = new THREE.Vector3(2 + Math.cos(a), .4, -3 + Math.sin(a)).applyMatrix4(transform);
    close(point.distanceTo(origin) / metresInMercator, config.metresPerUnit);
  }
  const from = new THREE.Vector3(-10, .1, -7), to = new THREE.Vector3(12, .1, 6);
  const mid = from.clone().lerp(to, .35).applyMatrix4(transform);
  const expected = from.clone().applyMatrix4(transform).lerp(to.clone().applyMatrix4(transform), .35);
  close(mid.distanceTo(expected), 0, 1e-12); // roads never bend at triangle seams
});

test('renderer placement and map camera coordinates agree for all original plot vertices', () => {
  const points = [...plan.boundary, plan.entrance.center, plan.roundabout.center, ...plan.plots.flatMap(p => p.geometry.polygon)];
  for (const [x, y] of points) {
    const [u, v] = getColonySiteFit(plan, config).point([(x - plan.width / 2) * COLONY_PLAN_SCALE, (y - plan.height / 2) * COLONY_PLAN_SCALE]);
    const rendered = new THREE.Vector3(u, 0, v).applyMatrix4(transform);
    const geographic = mercator(colonyPointToLatLng([x, y], plan, config));
    assert.ok(rendered.distanceTo(geographic) / metresInMercator < .02, `renderer and map camera diverge at ${x},${y}`);
  }
});
