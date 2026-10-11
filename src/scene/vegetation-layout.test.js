// node --test src/scene/vegetation-layout.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLandscape, distanceToPolygon, pointInPolygon, roadPolygons } from '../data/sceneLandscape.js';
import { layoutVegetation, parkLayout } from './vegetation-layout.js';

const plan = JSON.parse(readFileSync(new URL('../data/threePlotGeometry.json', import.meta.url)));

test('new planting clears roads, the roundabout, shops and the plaza gardens', () => {
  const roads = roadPolygons(plan), layout = layoutVegetation(plan, buildLandscape(plan));
  const shops = plan.plots.filter(plot => plot.number.startsWith('S')).map(plot => plot.geometry.polygon);
  const plazas = plan.landscaping.map(({ polygon }) => polygon).filter(polygon => parkLayout(plan, polygon).plaza);
  assert.ok(layout.saplings.length > 250 && layout.groves.length >= 6 && layout.blooms.length >= 10);
  for (const [kind, plants] of Object.entries(layout)) for (const { point, radius } of plants) {
    assert.ok(pointInPolygon(point, plan.boundary), `${kind} at ${point} is outside the colony`);
    for (const road of roads) assert.ok(distanceToPolygon(point, road) > radius + 3, `${kind} at ${point} blocks a road`);
    for (const shop of shops) assert.ok(distanceToPolygon(point, shop) > radius, `${kind} at ${point} is on a shop`);
    for (const plaza of plazas) assert.ok(!pointInPolygon(point, plaza), `${kind} at ${point} is in a plaza garden`);
  }
});

test('no young fruit tree is planted on a villa plot', async () => {
  const { builtPlotNumbers } = await import('./sitePlots.js');
  const villas = plan.plots.filter(plot => builtPlotNumbers.has(plot.number)).map(plot => plot.geometry.polygon);
  const { saplings } = layoutVegetation(plan, buildLandscape(plan));
  for (const { point } of saplings) assert.ok(villas.every(polygon => !pointInPolygon(point, polygon)), `sapling at ${point} is on a villa plot`);
});
