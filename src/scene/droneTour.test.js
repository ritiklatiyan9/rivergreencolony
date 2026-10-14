import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createDroneTourRoute, createDroneTourPlayer, droneTourLandmarks, droneOrbitDistance } from './droneTour.js';
import { pointInPolygon } from '../data/sceneLandscape.js';

const plan = JSON.parse(fs.readFileSync(new URL('../data/threePlotGeometry.json', import.meta.url)));
const overview = { center: [730, 685], zoom: 17, pitch: 50, bearing: -90 };
const route = () => createDroneTourRoute({ plan, project: p => [...p], overview, heading: 0 });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('panorama fitting keeps every perimeter corner inside desktop and portrait views through all bearings', () => {
  for (const aspect of [.55, 1, 1.7, 2.4]) {
    const radius = 22, fov = 36.87, pitch = 50, elevation = (90 - pitch) * Math.PI / 180;
    const distance = droneOrbitDistance({ radius, aspect, fov, pitch });
    const camera = new THREE.PerspectiveCamera(fov, aspect, .01, 1000);
    for (let bearing = 0; bearing < 360; bearing += 15) {
      const angle = bearing * Math.PI / 180;
      camera.position.set(Math.sin(angle) * Math.cos(elevation) * distance, Math.sin(elevation) * distance, Math.cos(angle) * Math.cos(elevation) * distance);
      camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
      for (let corner = 0; corner < 360; corner += 5) {
        const theta = corner * Math.PI / 180;
        const p = new THREE.Vector3(radius * Math.cos(theta), 0, radius * Math.sin(theta)).project(camera);
        assert.ok(Math.abs(p.x) < .82 && Math.abs(p.y) < .82, `${aspect}/${bearing}/${corner}: ${p.x}, ${p.y}`);
      }
    }
  }
});

test('the first shot turns a full 360 degrees while framing the entire colony', () => {
  const tour = route(), orbit = tour.segments[0];
  close(orbit.to.bearing - orbit.from.bearing, 360);
  for (const time of [0, 7, 14, 21, 27.999]) {
    const camera = tour.sample(time).camera;
    assert.deepEqual(camera.center, overview.center);
    close(camera.zoom, overview.zoom);
    close(camera.pitch, overview.pitch);
  }
  close(tour.sample(14).camera.bearing, overview.bearing + 180);
});

test('street flights use road centres and return through their boulevard junctions', () => {
  const landmarks = droneTourLandmarks(plan);
  for (const key of ['entry', 'avenue', 'west', 'westJunction', 'east', 'eastJunction', 'rear']) {
    assert.ok(plan.roads.some(road => pointInPolygon(landmarks[key], road.polygon)), key);
  }
  const shots = route().segments;
  for (const id of ['streets-west', 'streets-east']) {
    const legs = shots.filter(value => value.id === id).slice(1);
    for (const leg of legs) {
      for (const t of [.1, .5, .9]) {
        const point = leg.from.center.map((p, i) => p + (leg.to.center[i] - p) * t);
        assert.ok(plan.roads.some(road => pointInPolygon(point, road.polygon)), `${id}: ${point}`);
      }
    }
  }
});

test('fountain, gardens and frontage are included without mutating plot geometry', () => {
  const before = JSON.stringify(plan);
  const tour = createDroneTourRoute({ plan, project: p => [...p], overview,
    forecourt: { center: [670, 1340], zoom: 19, pitch: 58, bearing: 35 } });
  assert.ok(tour.stops.some(stop => stop.id === 'frontage'));
  assert.ok(tour.segments.some(stop => stop.id === 'fountain' && stop.to.center.every((p, i) => p === plan.roundabout.center[i])));
  assert.ok(tour.stops.some(stop => stop.id === 'parks'));
  assert.equal(JSON.stringify(plan), before);
});

test('shot joins and loop joins keep the camera continuous, without sudden turns', () => {
  const tour = route();
  for (const segment of tour.segments.slice(1)) {
    const before = tour.sample(segment.start - 1e-5).camera, after = tour.sample(segment.start + 1e-5).camera;
    before.center.forEach((p, i) => close(p, after.center[i]));
    for (const key of ['zoom', 'pitch', 'bearing']) close(before[key], after[key]);
    assert.ok(Math.abs(segment.to.bearing - segment.from.bearing) <= 180);
  }
  const end = tour.sample(tour.duration - 1e-5).camera, start = tour.sample(0).camera;
  end.center.forEach((p, i) => close(p, start.center[i]));
  close(end.zoom, start.zoom); close(end.pitch, start.pitch);
  close(((end.bearing - start.bearing) % 360 + 360) % 360, 0);
});

test('pausing or leaving the viewport freezes the flight clock; resume eases from manual position', () => {
  const events = [], player = createDroneTourPlayer(route(), state => events.push(state));
  player.start();
  player.tick(0);
  for (let time = 100; time <= 2000; time += 100) player.tick(time);
  const first = player.tick(2100);
  player.suspend();
  assert.deepEqual(player.tick(80000), first);
  player.pause(); assert.equal(player.tick(81000), null);
  const manual = { center: [650, 1000], zoom: 20, pitch: 65, bearing: 12 };
  player.resume(manual);
  assert.deepEqual(player.tick(90000), manual);
  assert.equal(events.at(-1).running, true);
  player.stop(); assert.equal(player.active, false); assert.equal(player.tick(100000), null);
});

test('reduced motion keeps every stop accessible without starting an automatic flight', () => {
  let state;
  const tour = route(), player = createDroneTourPlayer(tour, next => { state = next; });
  player.start(overview, true);
  assert.equal(player.running, false); assert.equal(player.tick(0), null);
  const entry = player.next();
  assert.equal(state.label, 'Entrance & shops');
  entry.center.forEach((p, i) => close(p, tour.stops[1].to.center[i]));
  for (let i = 0; i < tour.stops.length - 1; i += 1) player.next();
  assert.equal(state.index, 0);
});
