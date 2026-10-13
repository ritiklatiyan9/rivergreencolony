import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createColonyMapFrame } from './colonyMapFrame.js';

function fixture() {
  const identity = new THREE.Matrix4(), updates = [], draws = [], viewports = [];
  const model = { camera: new THREE.PerspectiveCamera(), scene: new THREE.Scene(), update: (...args) => updates.push(args) };
  const renderer = { resetState() {}, setViewport: (...args) => viewports.push(args), render: (...args) => draws.push(args) };
  const draw = createColonyMapFrame(identity);
  return { model, draws, updates, viewports, frame: (time, options = {}) => draw({ model, renderer, time,
    canvas: { width: 1200, height: 800 }, args: { projectionMatrix: identity.toArray(), defaultProjectionData: { mainMatrix: identity.toArray() } }, ...options }) };
}

test('tile repaints keep the colony visible throughout a page scroll', () => {
  const f = fixture();
  f.frame(1000); f.frame(1033);
  const beforeScroll = f.updates.at(-1)[0];
  for (let i = 0; i < 10; i++) f.frame(1066 + i * 33, { paused: true });
  assert.equal(f.draws.length, 12, 'each cleared map frame must draw the colony');
  assert.ok(f.draws.every(([scene, camera]) => scene === f.model.scene && camera === f.model.camera));
  assert.ok(f.updates.slice(2).every(([seconds, delta]) => seconds === beforeScroll && delta === 0));
  f.frame(1500);
  assert.ok(f.updates.at(-1)[1] <= .05, 'resuming must not jump the simulation');
});

test('reduced motion still draws on every map repaint without animating', () => {
  const f = fixture();
  f.frame(1000, { reducedMotion: true }); f.frame(2000, { reducedMotion: true });
  assert.equal(f.draws.length, 2);
  assert.deepEqual(f.updates, [[0, 0], [0, 0]]);
  assert.deepEqual(f.viewports, [[0, 0, 1200, 800], [0, 0, 1200, 800]]);
});
