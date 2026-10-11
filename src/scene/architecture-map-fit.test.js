import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createKit } from './kit.js';
import { createBatch, createMaterials } from './architecture-common.js';
import { buildShops } from './architecture-shops.js';
import { buildVillas } from './architecture-villas.js';
import { buildWall } from './architecture-wall.js';
import { villaSites } from './sitePlots.js';
import buildGround from './ground.js';
import { applyColonyMapFit } from './colonyMapFit.js';
import { getColonyMapConfig, getColonySiteFit } from '../data/colonyLocation.js';
import { fitAssetPoint, prepareMapPlan, siteAssetFrame, siteBoundaryEdges } from '../data/colonySiteFit.js';

const plan = JSON.parse(readFileSync(new URL('../data/threePlotGeometry.json', import.meta.url)));
const near = (a, b) => Math.abs(a - b) < 1e-5;
const hasAnchor = (points, [x, z]) => points.some(point => near(point[0], x) && near(point[1], z));

function fixture(sourcePlan = plan) {
  const kit = createKit({ capabilities: { getMaxAnisotropy: () => 1 } }, sourcePlan);
  // Geometry construction does not need pixels or a browser WebGL context.
  kit.canvasTexture = () => kit.track(new THREE.Texture());
  const root = new THREE.Group(), mat = createMaterials(kit);
  return { THREE, plan: sourcePlan, kit, world: kit.world, root, mat,
    SCALE: .02, HEIGHTS: { ground: 0, garden: .024, road: .018, label: .036, lawn: .032, forecourt: .016, shopRoof: .355 }, statusColours: {} };
}

test('merged asset parts retain one owner pivot and return to surface mode after grouping', () => {
  const ctx = fixture(), batch = createBatch(THREE, ctx.kit, ctx.root);
  batch.withAsset([4, -3], () => {
    batch.addBox(ctx.mat.plaster, [1, 2, 3], [4, 1, -3]);
    batch.addBox(ctx.mat.plaster, [.2, .1, .3], [4.8, 3, -2.7]);
  });
  batch.addBox(ctx.mat.plaster, [8, .1, .03], [0, .2, 0]);
  batch.build();
  const geometry = ctx.root.children[0].geometry, pivots = geometry.getAttribute('aColonyMapAnchor'), flags = geometry.getAttribute('aColonyMapRigid');
  assert.equal(flags.count, geometry.getAttribute('position').count);
  assert.equal(pivots.count, flags.count);
  for (let i = 0; i < flags.count; i += 1) {
    const rigid = i < 72;
    assert.equal(flags.getX(i), rigid ? 1 : 0);
    assert.equal(pivots.getX(i), rigid ? 4 : 0);
    assert.equal(pivots.getY(i), rigid ? -3 : 0);
  }
  ctx.kit.dispose();
});

test('shop roofs share their unit pivot and every villa assembly shares its house pivot', () => {
  const ctx = fixture(), batch = createBatch(THREE, ctx.kit, ctx.root);
  buildShops(ctx, batch, ctx.mat); batch.build();
  const shops = plan.plots.filter(plot => plot.number.startsWith('S')).map(plot => {
    const xs = plot.geometry.polygon.map(p => p[0]), ys = plot.geometry.polygon.map(p => p[1]);
    return ctx.world([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]);
  });
  for (const mesh of ctx.root.children) {
    const pivots = mesh.geometry.getAttribute('aColonyMapAnchor'), flags = mesh.geometry.getAttribute('aColonyMapRigid');
    for (let i = 0; i < flags.count; i += 1) {
      if (flags.getX(i)) assert.ok(hasAnchor(shops, [pivots.getX(i), pivots.getY(i)]), 'shop part uses a different pivot from its roof');
    }
  }
  const previousCount = ctx.root.children.length;
  buildVillas(ctx, ctx.mat);
  const housePivots = villaSites(plan).map(site => ctx.world(site.toPlan(0, site.villa.y0)));
  const matched = housePivots.map(() => 0);
  let surfaces = 0;
  for (const mesh of ctx.root.children.slice(previousCount)) {
    const fit = mesh.userData.colonyMapFit;
    if (fit?.mode === 'surface') { surfaces += mesh.count; continue; }
    assert.equal(fit?.mode, 'rigid');
    assert.equal(fit.anchors.length, mesh.count * 2);
    for (let i = 0; i < mesh.count; i += 1) {
      const pivot = [fit.anchors[i * 2], fit.anchors[i * 2 + 1]];
      assert.ok(pivot.every(Number.isFinite));
      housePivots.forEach((point, j) => { if (hasAnchor([point], pivot)) matched[j] += 1; });
    }
  }
  matched.forEach(count => assert.ok(count > 10, 'villa parts must share their assembly pivot'));
  assert.ok(surfaces > 0, 'compound walls and forecourts must remain site surfaces');
  ctx.kit.dispose();
});

test('perimeter wall faces and pillar caps remain inside the original boundary', () => {
  const ctx = fixture(), batch = createBatch(THREE, ctx.kit, ctx.root);
  buildWall(ctx, batch, ctx.mat); batch.build();
  const boundary = plan.boundary.map(ctx.world);
  for (const mesh of ctx.root.children) {
    const positions = mesh.geometry.getAttribute('position');
    for (let j = 0; j < positions.count; j += 1) {
      const x = positions.getX(j), z = positions.getZ(j);
      boundary.forEach((a, i) => {
        const b = boundary[(i + 1) % boundary.length], dx = b[0] - a[0], dz = b[1] - a[1];
        const clearance = (dx * (z - a[1]) - dz * (x - a[0])) / Math.hypot(dx, dz);
        assert.ok(clearance >= 0, 'wall thickness must not project outside the site');
      });
    }
  }
  ctx.kit.dispose();
});

test('tapered eastern shop stays inside the site without separating its body, roof or label', () => {
  const ctx = fixture(prepareMapPlan(plan)), fit = getColonySiteFit(plan, getColonyMapConfig());
  const batch = createBatch(THREE, ctx.kit, ctx.root);
  buildShops(ctx, batch, ctx.mat); batch.build(); buildGround(ctx);
  const shop = ctx.plan.plots.find(plot => plot.number === 'S1');
  const xs = shop.geometry.polygon.map(point => point[0]), ys = shop.geometry.polygon.map(point => point[1]);
  const sourceAnchor = ctx.world([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]).map(Math.fround);
  const shopIndex = ctx.plan.plots.findIndex(plot => plot.number === 'S1');
  const labels = ctx.root.children.find(mesh => mesh.material.isMeshBasicMaterial && mesh.geometry.getAttribute('aColonyMapRigid'));
  const labelAnchor = labels.geometry.getAttribute('aColonyMapAnchor');
  assert.ok(near(labelAnchor.getX(shopIndex * 4), sourceAnchor[0]));
  assert.ok(near(labelAnchor.getY(shopIndex * 4), sourceAnchor[1]));

  applyColonyMapFit({ root: ctx.root, ctx }, fit);
  // WebGL uploads matrices, original positions and containment offsets as
  // float32 values. Include that precision in the containment regression.
  const gpuMatrix = fit.matrix.map(Math.fround), edges = siteBoundaryEdges(fit.target);
  const offsets = [], owners = new Set();
  let originalMinimum = Infinity, fittedMinimum = Infinity;
  for (const mesh of ctx.root.children) {
    const rigid = mesh.geometry.getAttribute('aColonyMapRigid'), anchors = mesh.geometry.getAttribute('aColonyMapAnchor');
    if (!rigid || !anchors) continue;
    const positions = mesh.geometry.getAttribute('position'), placement = mesh.geometry.getAttribute('aColonyMapOffset');
    assert.equal(placement.count, positions.count);
    for (let i = 0; i < positions.count; i += 1) {
      if (!rigid.getX(i)) continue;
      const anchor = [anchors.getX(i), anchors.getY(i)];
      const point = fitAssetPoint([positions.getX(i), positions.getY(i), positions.getZ(i)], siteAssetFrame(anchor, gpuMatrix));
      const offset = [placement.getX(i), placement.getY(i)];
      const isEasternShop = hasAnchor([sourceAnchor], anchor);
      if (isEasternShop) { offsets.push(offset); owners.add(mesh); }
      edges.forEach(([nx, nz, d]) => {
        const before = nx * point[0] + nz * point[2] + d;
        const after = nx * (point[0] + offset[0]) + nz * (point[2] + offset[1]) + d;
        if (isEasternShop) { originalMinimum = Math.min(originalMinimum, before); fittedMinimum = Math.min(fittedMinimum, after); }
        assert.ok(after >= -.00001, 'a protected shop part must remain inside the satellite perimeter');
      });
    }
  }
  assert.ok(originalMinimum < -.01, 'the regression fixture must exercise the tapered end-unit overhang');
  assert.ok(fittedMinimum >= .0015, 'float32 placement must retain the containment margin');
  assert.ok(owners.has(labels) && owners.size >= 3, 'the containment group must include the label, roof and body');
  assert.ok(Math.hypot(...offsets[0]) > .01, 'the end unit requires a shared inward translation');
  offsets.forEach(offset => assert.deepEqual(offset, offsets[0], 'the complete unit must move by one translation'));
  ctx.kit.dispose();
});
