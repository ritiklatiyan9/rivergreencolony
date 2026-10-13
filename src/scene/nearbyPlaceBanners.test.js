import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MercatorCoordinate } from 'maplibre-gl';
import { readFileSync } from 'node:fs';
import { getColonyMapConfig } from '../data/colonyLocation.js';
import { NEARBY_PLACES, nearbyPlacesBounds } from '../data/nearbyPlaces.js';
import { createColonyMapTransform } from './colonyMapPlacement.js';
import { createNearbyPlaceBanners, unipolePlacement, UNIPOLE } from './nearbyPlaceBanners.js';

const plan = JSON.parse(readFileSync(new URL('../data/threePlotGeometry.json', import.meta.url)));
const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
function fixture(heading = 301.71802239454354) {
  const config = { ...getColonyMapConfig(), heading };
  const anchor = MercatorCoordinate.fromLngLat([config.location.lng, config.location.lat], config.altitude);
  const transform = createColonyMapTransform(plan, config, anchor, anchor.meterInMercatorCoordinateUnits());
  return { scene: new THREE.Scene(), transform, anchor, heading, makeTexture: () => new THREE.Texture() };
}

test('all unipole bases retain geographic coordinates and all columns rise vertically at any colony heading', () => {
  for (const heading of [0, 90, 301.71802239454354]) {
    const { transform, anchor } = fixture(heading);
    NEARBY_PLACES.forEach(place => {
      const p = unipolePlacement(place, transform, anchor, heading);
      const matrix = new THREE.Matrix4().compose(p.position, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw), new THREE.Vector3(p.scale, p.scale, p.scale));
      const projected = transform.clone().multiply(matrix);
      const base = new THREE.Vector3(0, 0, 0).applyMatrix4(projected);
      const top = new THREE.Vector3(0, place.heightMetres, 0).applyMatrix4(projected);
      const expected = MercatorCoordinate.fromLngLat([place.lng, place.lat], 0);
      close(base.x, expected.x); close(base.y, expected.y); close(base.z, 0);
      close(top.x, base.x); close(top.y, base.y);
      close((top.z - base.z) / expected.meterInMercatorCoordinateUnits(), place.heightMetres, 1e-7);
    });
  }
});

test('colocated sign heads are separated in altitude and full-area bounds include the remote road', () => {
  const academy = NEARBY_PLACES.find(p => p.id === 'cricket-academy');
  const hospital = NEARBY_PLACES.find(p => p.id === 'government-hospital');
  assert.ok(academy.heightMetres - hospital.heightMetres > UNIPOLE.frameHeight);
  const [[west, south], [east, north]] = nearbyPlacesBounds();
  assert.equal(west, NEARBY_PLACES.find(p => p.id === 'ring-road-shamli').lng);
  NEARBY_PLACES.forEach(p => assert.ok(p.lng >= west && p.lng <= east && p.lat >= south && p.lat <= north));
});

test('selection and visibility preserve every physical assembly, and 3D ray picking selects the sign', () => {
  const settings = fixture(), signs = createNearbyPlaceBanners(settings);
  assert.equal(signs.root.children.length, 20);
  const matrices = signs.root.children.map(group => group.matrixWorld.clone());
  const id = NEARBY_PLACES[0].id;
  signs.select(id); signs.setVisible(false); signs.setVisible(true);
  signs.root.updateMatrixWorld(true);
  signs.root.children.forEach((group, i) => assert.deepEqual(group.matrixWorld.elements, matrices[i].elements));
  const group = signs.root.children[0], place = NEARBY_PLACES[0];
  const origin = new THREE.Vector3(0, place.heightMetres, 80).applyMatrix4(group.matrixWorld);
  const target = new THREE.Vector3(0, place.heightMetres, 0).applyMatrix4(group.matrixWorld);
  const ray = new THREE.Raycaster(origin, target.sub(origin).normalize());
  assert.equal(signs.pick(ray), id);
  signs.setVisible(false); assert.equal(signs.pick(ray), null);
  let disposedTextures = 0;
  signs.root.traverse(object => object.material?.map?.addEventListener('dispose', () => { disposedTextures += 1; }));
  signs.dispose(); signs.dispose();
  assert.equal(settings.scene.children.length, 0);
  assert.equal(disposedTextures, 40); // two faces share each of the twenty textures
});
