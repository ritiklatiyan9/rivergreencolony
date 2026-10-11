import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createKit, SCALE, HEIGHTS } from './kit.js';
import buildLife from './life.js';
import { getColonyMapConfig, getColonySiteFit, RIVER_GREEN_FRONTAGE } from '../data/colonyLocation.js';
import { createColonyFrontage, createFrontageShopPlacement, createExpandedInteriorFit } from '../data/colonyFrontage.js';
import { prepareMapPlan, siteBoundaryEdges } from '../data/colonySiteFit.js';

const original = JSON.parse(readFileSync(new URL('../data/threePlotGeometry.json', import.meta.url)));

test('traffic and people stay inside the residential grid after redistributing its length', () => {
  const basePlan = prepareMapPlan(original), baseFit = getColonySiteFit(original, getColonyMapConfig());
  const frontage = createColonyFrontage(original, baseFit, RIVER_GREEN_FRONTAGE);
  const shops = createFrontageShopPlacement(basePlan, baseFit, frontage);
  const interior = createExpandedInteriorFit(basePlan, baseFit, frontage, shops);
  const kit = createKit({ capabilities: { getMaxAnisotropy: () => 1 } }, interior.plan);
  kit.canvasTexture = () => kit.track(new THREE.Texture());
  const root = new THREE.Group(), edges = siteBoundaryEdges(interior.fit.target);
  const life = buildLife({ THREE, plan: interior.plan, kit, root, world: kit.world, SCALE, HEIGHTS, siteFit: interior.fit, frontage });
  let instances = 0;
  for (const seconds of [0, 12, 31, 74]) {
    life.update(seconds);
    root.traverse(mesh => {
      const anchors = mesh.userData.colonyMapFit?.anchors;
      if (!anchors) return;
      instances += mesh.count;
      for (let i = 0; i < mesh.count; i++) {
        const [x, z] = interior.fit.point([anchors[i * 2], anchors[i * 2 + 1]]);
        edges.forEach(([nx, nz, d]) => assert.ok(nx * x + nz * z + d >= -.001, 'moving rigs must not continue past the shop/gate frontage'));
      }
    });
  }
  assert.ok(instances > 50, 'exercise the actual moving rigs and their live owner anchors');
  kit.dispose();
});
