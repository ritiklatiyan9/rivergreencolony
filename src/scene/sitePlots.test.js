// node --test src/scene/sitePlots.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pointInPolygon } from '../data/sceneLandscape.js';
import { villaSites, VILLA_SITES, WALL_INSET } from './sitePlots.js';
import { getColonyMapConfig, getColonySiteFit, RIVER_GREEN_FRONTAGE } from '../data/colonyLocation.js';
import { createColonyFrontage, createFrontageShopPlacement, createExpandedInteriorFit } from '../data/colonyFrontage.js';
import { prepareMapPlan } from '../data/colonySiteFit.js';

const plan = JSON.parse(readFileSync(new URL('../data/threePlotGeometry.json', import.meta.url)));
const sites = villaSites(plan);
const carRect = ({ x, y, length, width }) => ({ x0: x - width / 2, x1: x + width / 2, y0: y - length / 2, y1: y + length / 2 });
const gap = (a, b) => Math.max(a.x0 - b.x1, b.x0 - a.x1, a.y0 - b.y1, b.y0 - a.y1); // > 0: apart
const reach = (r, { x, y }) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.y0 - y, 0, y - r.y1));
const corners = (r) => [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]];

test('every surveyed plot gets a villa, each pair one villa across both plots', () => {
  assert.deepEqual(VILLA_SITES, [['A-15'], ['A-47'], ['B-58'], ['B-38'], ['B-24'], ['A-55'], ['B-44'], ['B-1'], ['B-14'], ['A-34'], ['B-61', 'B-62'], ['A-41', 'A-42'], ['C-9']], 'house plots must match the handwritten survey note');
  assert.equal(sites.length, 13);
  assert.deepEqual(sites.flatMap(site => site.numbers).sort(), VILLA_SITES.flat().sort());
  assert.equal(sites.flatMap(site => site.labels).length, 15);
  for (const site of sites) assert.ok(site.cars.length >= 1 && site.cars.length <= 3);
  assert.ok(sites.some(site => site.cars.length === 3) && sites.flatMap(site => site.cars).some(car => car.model === 'scorpio'));
});

test('parked cars stay on the paving, clear of the house, steps, garden and each other', () => {
  for (const site of sites) {
    const rects = site.cars.map(carRect), name = site.numbers.join('+');
    rects.forEach((r, i) => {
      assert.ok(r.x0 >= site.pad.x0 + .01 && r.x1 <= site.pad.x1 - .01 && r.y0 >= site.pad.y0 + .01 && r.y1 <= site.pad.y1 - .01, `${name}: car ${i} leaves the paving`);
      assert.ok(gap(r, site.steps) > .02, `${name}: car ${i} touches the entrance steps`);
      assert.ok(gap(r, site.villa) > .02, `${name}: car ${i} touches the villa`);
      rects.forEach((other, j) => { if (j > i) assert.ok(gap(r, other) >= .05, `${name}: cars ${i} and ${j} collide`); });
      for (const plant of [...site.trees, ...site.shrubs]) assert.ok(reach(r, plant) > plant.radius + .01, `${name}: car ${i} runs into a plant`);
      assert.ok(site.gate.x0 <= r.x0 && site.gate.x1 >= r.x1, `${name}: car ${i} cannot pass the gate`);
    });
  }
});

test('garden plants stay on lawn inside the walls, and everything stays inside its plots', () => {
  for (const site of sites) {
    const name = site.numbers.join('+'), inside = ([x, y]) => site.plots.some(plot => pointInPolygon(site.toPlan(x, y), plot.geometry.polygon));
    for (const plant of [...site.trees, ...site.shrubs]) {
      assert.ok(reach(site.pad, plant) > plant.radius, `${name}: plant on the paving`);
      assert.ok(reach(site.villa, plant) > plant.radius * .5, `${name}: plant inside the villa`);
      assert.ok(Math.abs(plant.x) + plant.radius < site.W / 2 - WALL_INSET + .005 && plant.y - plant.radius > WALL_INSET && plant.y + plant.radius < site.D - WALL_INSET + .005, `${name}: plant crosses the wall`);
    }
    for (const r of [site.pad, site.villa, ...site.cars.map(carRect)]) for (const point of corners(r)) assert.ok(inside(point), `${name}: ${point} lies outside the plots`);
    assert.ok(site.pad.y1 <= site.villa.y0 + 1e-9, `${name}: paving runs under the villa`);
  }
});

// The plan the 3D + surroundings view builds (colonyMapScene.js), whose east bank is widened into trapezoids.
function mapPlan() {
  const fit = getColonySiteFit(plan, getColonyMapConfig({})), base = prepareMapPlan(plan);
  const frontage = createColonyFrontage(plan, fit, RIVER_GREEN_FRONTAGE), placement = createFrontageShopPlacement(base, fit, frontage);
  return createExpandedInteriorFit(base, fit, frontage, placement).plan;
}

test('compound walls stay inside their own plots, on the printed plan and the widened map plan', () => {
  for (const drawing of [plan, mapPlan()]) for (const site of villaSites(drawing)) {
    const x = site.W / 2 - WALL_INSET + .016, y0 = WALL_INSET - .016, y1 = site.D - WALL_INSET + .016; // .016 = half a pillar cap
    for (const point of [[-x, y0], [x, y0], [x, y1], [-x, y1]]) assert.ok(site.plots.some(plot => pointInPolygon(site.toPlan(...point), plot.geometry.polygon)),
      `${site.numbers.join('+')}: wall corner ${point} crosses into a neighbouring plot`);
  }
});
