import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { updateMapCamera } from './colonyMapCamera.js';

const close = (actual, expected, message, tolerance = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${message}: ${actual} ≠ ${expected}`);
};
const matrixClose = (actual, expected, message) => actual.elements.forEach((value, index) => close(value, expected.elements[index], `${message} [${index}]`));
const vectorClose = (actual, expected, message) => ['x', 'y', 'z'].forEach(axis => close(actual[axis], expected[axis], `${message}.${axis}`));
const identity = new THREE.Matrix4();

// Use a small colony in normalized Mercator coordinates and a pixel-space
// map view, including the map's flipped Y axis, pitch, and georeference scale.
function fixture(eyeOffset = [.000025, .000045, .000035]) {
  const anchor = new THREE.Vector3(.71471, .41427, 0);
  const eye = anchor.clone().add(new THREE.Vector3(...eyeOffset));
  const mapCamera = new THREE.PerspectiveCamera(47, 1.6, 8, 8000);
  mapCamera.up.set(0, 0, 1);
  mapCamera.position.copy(eye); mapCamera.lookAt(anchor); mapCamera.updateMatrixWorld();
  const worldSize = 2 ** 27;
  const mapView = new THREE.Matrix4().makeScale(worldSize, -worldSize, worldSize).multiply(mapCamera.matrixWorldInverse);
  const projection = mapCamera.projectionMatrix.clone();
  projection.elements[8] = -.12; projection.elements[9] = .07; // map padding shifts the optical centre
  const main = projection.clone().multiply(mapView);
  const scale = 3.45e-7;
  const transform = new THREE.Matrix4().makeTranslation(...anchor.toArray())
    .multiply(new THREE.Matrix4().makeScale(scale, -scale, scale))
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
    .multiply(new THREE.Matrix4().makeRotationY(-.37))
    .multiply(new THREE.Matrix4().makeScale(.575, 1, .82))
    .multiply(new THREE.Matrix4().makeTranslation(-1.4, 0, -12.8));
  return { eye, projection, main, transform, args: { projectionMatrix: projection.toArray(), defaultProjectionData: { mainMatrix: main.toArray() } } };
}

test('separating the map camera preserves the complete georeferenced projection', () => {
  const { projection, main, transform, args } = fixture();
  const camera = new THREE.PerspectiveCamera();
  updateMapCamera(camera, args, transform);
  matrixClose(camera.projectionMatrix, projection, 'perspective projection');
  matrixClose(camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse), main.clone().multiply(transform), 'combined map projection');
  matrixClose(camera.projectionMatrix.clone().multiply(camera.projectionMatrixInverse), identity, 'inverse projection');
  matrixClose(camera.matrixWorld.clone().multiply(camera.matrixWorldInverse), identity, 'inverse view');
  for (const matrix of [camera.projectionMatrix, camera.projectionMatrixInverse, camera.matrixWorld, camera.matrixWorldInverse]) assert.ok(matrix.elements.every(Number.isFinite));
  assert.equal(camera.matrixAutoUpdate, false);
  assert.equal(camera.matrixWorldAutoUpdate, false);
  const view = camera.matrixWorldInverse.clone();
  camera.updateMatrixWorld(true); // Three must not replace the imported view during a render.
  matrixClose(camera.matrixWorldInverse, view, 'view survives Three matrix updates');
});

test('the camera eye follows map movement in the original colony coordinate system', () => {
  const camera = new THREE.PerspectiveCamera();
  const first = fixture();
  updateMapCamera(camera, first.args, first.transform);
  vectorClose(camera.position, first.eye.clone().applyMatrix4(first.transform.clone().invert()), 'first colony eye');
  const firstPosition = camera.position.clone();
  const second = fixture([-.000035, .000065, .000018]);
  updateMapCamera(camera, second.args, second.transform);
  vectorClose(camera.position, second.eye.clone().applyMatrix4(second.transform.clone().invert()), 'moved colony eye');
  assert.ok(camera.position.distanceTo(firstPosition) > 10, 'view-dependent lighting sees the moved eye');
  vectorClose(new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld), camera.position, 'matrix and shader eye agree');
});

test('object transforms remain local while the camera applies georeferencing in the correct order', () => {
  const { args, main, transform } = fixture();
  const root = new THREE.Group(), object = new THREE.Object3D();
  object.position.set(3.1, .24, -4.2); object.rotation.y = .6; object.scale.set(.8, 1.2, .7);
  root.add(object); root.updateMatrixWorld(true);
  const objectMatrix = object.matrixWorld.clone(), transformBefore = transform.clone();
  const argsBefore = structuredClone(args);
  const camera = new THREE.PerspectiveCamera();
  updateMapCamera(camera, args, transform);
  root.updateMatrixWorld(true);
  matrixClose(root.matrixWorld, identity, 'colony root remains local');
  matrixClose(object.matrixWorld, objectMatrix, 'procedural world coordinates remain local');
  assert.deepEqual(transform.elements, transformBefore.elements);
  assert.deepEqual(args, argsBefore);
  const point = new THREE.Vector3(.3, .2, -.7);
  const actual = point.clone().applyMatrix4(object.matrixWorld).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  const expected = point.clone().applyMatrix4(main.clone().multiply(transform).multiply(objectMatrix));
  vectorClose(actual, expected, 'object clip-space projection');
});
