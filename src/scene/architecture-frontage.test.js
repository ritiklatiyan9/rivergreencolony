import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createKit, SCALE, HEIGHTS } from './kit.js';
import { createBatch, createMaterials } from './architecture-common.js';
import { buildArch } from './architecture-arch.js';
import buildArchitecture from './architecture.js';
import { buildWall } from './architecture-wall.js';
import { buildFrontage, buildFrontageShops } from './architecture-frontage.js';
import { applyColonyMapFit } from './colonyMapFit.js';
import { createColonyFrontage, createExpandedInteriorFit, createFrontageShopPlacement } from '../data/colonyFrontage.js';
import { getColonyMapConfig, getColonySiteFit, RIVER_GREEN_FRONTAGE } from '../data/colonyLocation.js';
import { fitAssetPoint, prepareMapPlan, siteAssetFrame, siteBoundaryEdges } from '../data/colonySiteFit.js';

const plan = JSON.parse(readFileSync(new URL('../data/threePlotGeometry.json', import.meta.url)));

function fixture() {
  const kit = createKit({ capabilities: { getMaxAnisotropy: () => 1 } }, plan);
  kit.canvasTexture = () => kit.track(new THREE.Texture());
  return { THREE, plan, kit, world: kit.world, root: new THREE.Group(), mat: createMaterials(kit), SCALE, HEIGHTS };
}

test('outer entrance override rotates all portal parts as one proportional assembly', () => {
  const native = fixture(), rotated = fixture(), entrancePoint = [583.3663, 1369.2443], yaw = .39;
  for (const [ctx, entranceYaw] of [[native, 0], [rotated, yaw]]) {
    const batch = createBatch(THREE, ctx.kit, ctx.root);
    buildArch({ ...ctx, entrancePoint, entranceYaw }, batch, ctx.mat); batch.build();
  }
  const [gx, gz] = native.world(entrancePoint), c = Math.cos(yaw), s = Math.sin(yaw);
  assert.equal(native.root.children.length, rotated.root.children.length);
  native.root.children.forEach((mesh, j) => {
    const a = mesh.geometry.getAttribute('position'), b = rotated.root.children[j].geometry.getAttribute('position');
    const anchors = rotated.root.children[j].geometry.getAttribute('aColonyMapAnchor');
    const rigid = rotated.root.children[j].geometry.getAttribute('aColonyMapRigid');
    assert.equal(a.count, b.count);
    for (let i = 0; i < a.count; i += 1) {
      const dx = a.getX(i) - gx, dz = a.getZ(i) - gz;
      assert.ok(Math.abs(b.getX(i) - gx - c * dx - s * dz) < .00001);
      assert.ok(Math.abs(b.getZ(i) - gz + s * dx - c * dz) < .00001);
      assert.equal(a.getY(i), b.getY(i));
      assert.equal(rigid.getX(i), 1);
      assert.ok(Math.abs(anchors.getX(i) - gx) < .00001);
      assert.ok(Math.abs(anchors.getY(i) - gz) < .00001);
    }
  });
  native.kit.dispose(); rotated.kit.dispose();
});

test('map annex removes the obsolete inner front wall and preserves the side walls', () => {
  const ctx = fixture(), batch = createBatch(THREE, ctx.kit, ctx.root);
  buildWall({ ...ctx, frontage: {} }, batch, ctx.mat); batch.build();
  const [, frontZ] = ctx.world(plan.boundary[2]);
  const [leftX] = ctx.world([200, 0]), [rightX] = ctx.world([1000, 0]);
  let sideVertices = 0;
  for (const mesh of ctx.root.children) {
    const positions = mesh.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i), z = positions.getZ(i);
      assert.ok(!(z > frontZ - .08 && x > leftX && x < rightX), 'the interior-to-apron seam must have no transverse wall');
      if (z > frontZ - .08) sideVertices += 1;
    }
  }
  assert.ok(sideVertices > 0, 'side walls must still reach the original front corners');
  ctx.kit.dispose();
});

test('frontage corners and the complete relocated gate stay in the annex and face its outer edge', () => {
  const ctx = fixture(), fit = getColonySiteFit(plan, getColonyMapConfig());
  ctx.siteFit = fit; ctx.frontage = createColonyFrontage(plan, fit, RIVER_GREEN_FRONTAGE);
  const group = buildFrontage(ctx, ctx.mat), gateRoot = group.getObjectByName('Outer entrance gate');
  const beamMesh = gateRoot.children.find(mesh => mesh.material === ctx.mat.plaster);
  assert.deepEqual(group.userData.colonyMapFit.clipBoundary, ctx.frontage.targetBoundary);
  applyColonyMapFit({ root: ctx.root, ctx }, fit);
  const edges = siteBoundaryEdges(ctx.frontage.targetBoundary), gpuMatrix = fit.matrix.map(Math.fround);
  const placed = (mesh, i) => {
    const position = mesh.geometry.getAttribute('position'), rigid = mesh.geometry.getAttribute('aColonyMapRigid');
    const source = [position.getX(i), position.getY(i), position.getZ(i)];
    if (!rigid?.getX(i)) { const p = fit.point([source[0], source[2]]); return [p[0], source[1], p[1]]; }
    const anchors = mesh.geometry.getAttribute('aColonyMapAnchor'), offsets = mesh.geometry.getAttribute('aColonyMapOffset');
    const point = fitAssetPoint(source, siteAssetFrame([anchors.getX(i), anchors.getY(i)], gpuMatrix));
    return [point[0] + offsets.getX(i), point[1], point[2] + offsets.getY(i)];
  };
  let gateVertices = 0;
  group.traverse(mesh => {
    if (!mesh.geometry) return;
    const positions = mesh.geometry.getAttribute('position'), inGate = mesh.parent === gateRoot;
    for (let i = 0; i < positions.count; i += 1) {
      const [x, , z] = placed(mesh, i);
      edges.forEach(([nx, nz, d]) => assert.ok(nx * x + nz * z + d >= (inGate ? .0015 : -.00001), 'fitted wall corners and protected gate parts must stay within their frontage region'));
      if (inGate) gateVertices += 1;
    }
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>\n#include <defaultnormal_vertex>\n#include <project_vertex>\n#include <worldpos_vertex>', fragmentShader: '#include <common>\n#include <map_fragment>\nvoid main(){}' };
    mesh.material.onBeforeCompile(shader);
    shader.uniforms.uColonySiteEdges.value.forEach((edge, i) => edge.toArray().forEach((value, k) => assert.ok(Math.abs(value - edges[i][k]) < 1e-9, 'annex child must inherit the annex clipping region')));
  });
  assert.ok(gateVertices > 100, 'gate body, trim and lettering must all be checked');

  // Find the rectangular top of the portal beam and compare its long edge
  // with the outer frontage, after both rigid fitting and containment.
  const positions = beamMesh.geometry.getAttribute('position');
  let height = -Infinity; for (let i = 0; i < positions.count; i += 1) height = Math.max(height, positions.getY(i));
  const corners = [];
  for (let i = 0; i < positions.count; i += 1) {
    if (Math.abs(positions.getY(i) - height) > 1e-7) continue;
    const [x, , z] = placed(beamMesh, i);
    if (!corners.some(p => Math.hypot(p[0] - x, p[1] - z) < 1e-6)) corners.push([x, z]);
  }
  assert.equal(corners.length, 4);
  const pairs = corners.flatMap((a, i) => corners.slice(i + 1).map(b => ({ delta: [b[0] - a[0], b[1] - a[1]], length: Math.hypot(b[0] - a[0], b[1] - a[1]) }))).sort((a, b) => a.length - b.length);
  const longEdge = pairs[2].delta, heading = ctx.frontage.gateHeading;
  assert.ok(Math.abs(longEdge[0] * Math.sin(heading) - longEdge[1] * Math.cos(heading)) < 1e-6, 'portal beam must face along the actual outer front edge');
  ctx.kit.dispose();
});

test('changing the interior fit leaves the marked frontage and gate on their base fit', () => {
  const ctx = fixture(), base = getColonySiteFit(plan, getColonyMapConfig());
  ctx.baseSiteFit = base; ctx.siteFit = { ...base, matrix: base.matrix.map((value, i) => i === 2 ? value + 4 : value) };
  ctx.frontage = createColonyFrontage(plan, base, RIVER_GREEN_FRONTAGE);
  const frontage = buildFrontage(ctx, ctx.mat);
  assert.equal(frontage.userData.colonyMapFit.siteFit, base);
  applyColonyMapFit({ root: ctx.root, ctx }, ctx.siteFit);
  const expected = new THREE.Matrix3().set(...base.matrix).toArray();
  frontage.traverse(mesh => {
    if (!mesh.geometry) return;
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>\n#include <defaultnormal_vertex>\n#include <project_vertex>\n#include <worldpos_vertex>', fragmentShader: '#include <common>\n#include <map_fragment>\nvoid main(){}' };
    mesh.material.onBeforeCompile(shader);
    assert.deepEqual(shader.uniforms.uColonySite.value.toArray(), expected, 'interior registration must not shift the existing marked gate or front corners');
  });
  ctx.kit.dispose();
});

test('expanded interior keeps fixed perimeter walls and a clear straight gate approach', () => {
  const ctx = fixture(), base = getColonySiteFit(plan, getColonyMapConfig());
  ctx.baseSiteFit = base; ctx.basePlan = prepareMapPlan(plan); ctx.statusColours = {};
  ctx.frontage = createColonyFrontage(plan, base, RIVER_GREEN_FRONTAGE);
  const placement = createFrontageShopPlacement(ctx.basePlan, base, ctx.frontage);
  const expanded = createExpandedInteriorFit(ctx.basePlan, base, ctx.frontage, placement);
  ctx.plan = expanded.plan; ctx.siteFit = expanded.fit;
  Object.assign(ctx.frontage, { shopRows: placement.rows, shopBoundary: placement.targetBoundary, shopGateFront: placement.gateFront, approach: expanded.approach, entry: expanded.entry, gardens: expanded.frontageGardens, forecourtBoundary: expanded.forecourtBoundary, forecourtTargetBoundary: expanded.forecourtTargetBoundary });
  buildArchitecture(ctx);
  const walls = ctx.root.getObjectByName('Fixed colony perimeter'), road = ctx.root.getObjectByName('Outer gate approach');
  assert.ok(walls, 'interior expansion must not rebuild perimeter walls at the cropped plot edge');
  assert.equal(walls.userData.colonyMapFit.siteFit, base);
  assert.deepEqual(road.userData.colonyMapFit.clipBoundary, placement.targetBoundary);
  const forecourt = ctx.root.getObjectByName('Entrance forecourt');
  assert.deepEqual(forecourt.parent.userData.colonyMapFit.clipBoundary, expanded.forecourtTargetBoundary);
  const forecourtPositions = forecourt.geometry.getAttribute('position');
  for (let j = 0; j < forecourtPositions.count; j += 1) {
    const point = base.point([forecourtPositions.getX(j), forecourtPositions.getZ(j)]);
    assert.ok(expanded.forecourtTargetBoundary.some(corner => Math.hypot(point[0] - corner[0], point[1] - corner[1]) < 1e-5), 'front paving must join the actual residential edge to both outer corners');
  }
  const roadPositions = road.geometry.getAttribute('position');
  for (let i = 0; i < roadPositions.count; i += 1) {
    const target = base.point([roadPositions.getX(i), roadPositions.getZ(i)]);
    assert.ok(expanded.targetApproach.some(point => Math.hypot(point[0] - target[0], point[1] - target[1]) < 1e-5), 'rendered road must use the short four-corner approach rather than the old diagonal');
  }
  const park = ctx.root.getObjectByName('Frontage corner garden 1');
  assert.ok(park, 'the original corner park must move with the commercial frontage');
  assert.equal(park.children.filter(child => child.name === 'Garden tree').length, 2);
  ctx.root.updateMatrixWorld(true);
  const parkEdges = siteBoundaryEdges(expanded.frontageGardens[0].targetPolygon), vertex = new THREE.Vector3();
  park.traverse(mesh => {
    if (!mesh.geometry) return;
    const positions = mesh.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i += 1) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      const point = fitAssetPoint(vertex.toArray(), expanded.frontageGardens[0].fit.asset(park.userData.colonyMapFit.anchor));
      parkEdges.forEach(([nx, nz, d]) => assert.ok(nx * point[0] + nz * point[2] + d >= -.00001, 'corner park borders, benches and entire tree canopies must fit within the lawn'));
    }
  });
  const original = fixture(), originalBatch = createBatch(THREE, original.kit, original.root);
  buildWall({ ...original, plan: ctx.basePlan, frontage: ctx.frontage }, originalBatch, original.mat); originalBatch.build();
  assert.equal(walls.children.length, original.root.children.length);
  walls.children.forEach((mesh, j) => assert.deepEqual(mesh.geometry.getAttribute('position').array, original.root.children[j].geometry.getAttribute('position').array, 'real side-wall geometry and front corners must remain unchanged'));
  applyColonyMapFit({ root: ctx.root, ctx }, expanded.fit);
  const expected = new THREE.Matrix3().set(...base.matrix).toArray();
  [...walls.children, road].forEach(mesh => {
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>\n#include <defaultnormal_vertex>\n#include <project_vertex>\n#include <worldpos_vertex>', fragmentShader: '#include <common>\n#include <map_fragment>\nvoid main(){}' };
    mesh.material.onBeforeCompile(shader);
    assert.deepEqual(shader.uniforms.uColonySite.value.toArray(), expected);
  });
  original.kit.dispose(); ctx.kit.dispose();
});

test('attached commercial rows keep bodies, parapets, roofs and numbers together without unit offsets', () => {
  const ctx = fixture(), fit = getColonySiteFit(plan, getColonyMapConfig());
  ctx.plan = prepareMapPlan(plan); ctx.siteFit = fit; ctx.statusColours = { AVAILABLE: '#10b981' };
  ctx.frontage = createColonyFrontage(plan, fit, RIVER_GREEN_FRONTAGE);
  const placement = createFrontageShopPlacement(ctx.plan, fit, ctx.frontage);
  ctx.frontage.shopRows = placement.rows;
  const paint = buildFrontageShops(ctx, ctx.mat); buildFrontage(ctx, ctx.mat);
  const rows = placement.rows.map(row => ctx.root.getObjectByName(`${row.side} frontage shops`));
  const expectedShops = ctx.plan.plots.filter(plot => plot.number.startsWith('S'));
  assert.equal(placement.rows.reduce((count, row) => count + row.plots.length, 0), expectedShops.length);
  rows.forEach((group, j) => {
    assert.equal(group.getObjectByName('Shop roof numbers').geometry.getAttribute('position').count, placement.rows[j].plots.length * 4);
    assert.equal(group.userData.colonyMapFit.siteFit, placement.rows[j].fit);
    assert.deepEqual(group.userData.colonyMapFit.anchor, placement.rows[j].sourceFront);
  });
  paint(new Map(expectedShops.map(plot => [plot.number, 'AVAILABLE'])));
  rows.forEach(group => {
    const roof = group.children.find(mesh => mesh.material.vertexColors), colours = roof.geometry.getAttribute('color'), expected = new THREE.Color(ctx.statusColours.AVAILABLE);
    let live = 0; for (let i = 0; i < colours.count; i += 1) if (Math.abs(colours.getX(i) - expected.r) < 1e-6) live += 1;
    assert.ok(live > 0, 'relocated roofs must retain availability paint');
  });
  applyColonyMapFit({ root: ctx.root, ctx }, fit);
  rows.forEach((group, j) => {
    const rowFit = placement.rows[j].fit, edges = siteBoundaryEdges(placement.targetBoundary), gpuMatrix = rowFit.matrix.map(Math.fround);
    group.traverse(mesh => {
      if (!mesh.geometry) return;
      const positions = mesh.geometry.getAttribute('position'), anchors = mesh.geometry.getAttribute('aColonyMapAnchor');
      const rigid = mesh.geometry.getAttribute('aColonyMapRigid'), offsets = mesh.geometry.getAttribute('aColonyMapOffset');
      for (let i = 0; i < positions.count; i += 1) {
        const source = [positions.getX(i), positions.getY(i), positions.getZ(i)];
        const p = fitAssetPoint(source, siteAssetFrame(placement.rows[j].sourceFront, gpuMatrix));
        assert.ok(Math.abs(p[1] - source[1] * placement.rows[j].scale) < 1e-6, 'body, roof and shared parapet heights must use the same row scale');
        if (rigid?.getX(i)) {
          assert.ok(Math.hypot(offsets.getX(i), offsets.getY(i)) < 1e-5, 'a contained row must not shift individual shop bodies away from shared parapets');
          p[0] += offsets.getX(i); p[2] += offsets.getY(i);
          const coherent = rowFit.point([source[0], source[2]]);
          assert.ok(Math.hypot(p[0] - coherent[0], p[2] - coherent[1]) < 1e-5, 'shop parts must all follow one row similarity transform');
        }
        edges.forEach(([nx, nz, d]) => assert.ok(nx * p[0] + nz * p[2] + d >= -.00001, 'whole shop row must remain inside the frontage corners'));
      }
      const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>\n#include <defaultnormal_vertex>\n#include <project_vertex>\n#include <worldpos_vertex>', fragmentShader: '#include <common>\n#include <map_fragment>\nvoid main(){}' };
      mesh.material.onBeforeCompile(shader);
      assert.deepEqual(shader.uniforms.uColonyMapAnchor.value.toArray(), placement.rows[j].sourceFront, 'all row materials, including unbatched parapets, must use the same XYZ anchor');
      assert.ok(!shader.vertexShader.includes('attribute float aColonyMapRigid;'), 'row parapets and unit parts must use one uniform placement mode');
    });
  });
  const frontage = ctx.root.getObjectByName('Entrance frontage'), gate = frontage.getObjectByName('Outer entrance gate');
  assert.deepEqual(gate.userData.colonyMapFit.clipBoundary, placement.targetBoundary);
  const gateGeometry = gate.children[0].geometry, gateAnchors = gateGeometry.getAttribute('aColonyMapAnchor'), gateOffset = gateGeometry.getAttribute('aColonyMapOffset');
  const gateCentre = fit.point([gateAnchors.getX(0), gateAnchors.getY(0)]).map((value, i) => value + (i ? gateOffset.getY(0) : gateOffset.getX(0)));
  assert.ok(Math.hypot(gateCentre[0] - placement.gateFront[0], gateCentre[1] - placement.gateFront[1]) < 1e-5, 'rendered portal and attached shop corners must share the same contained frontage line');
  // Front runs are a low curb, while side walls retain their original height.
  const frontEdge = [ctx.frontage.targetBoundary[1], ctx.frontage.targetBoundary[2]], edges = siteBoundaryEdges(ctx.frontage.targetBoundary);
  const frontPlane = edges[1]; let curbVertices = 0;
  frontage.children.filter(mesh => mesh.geometry?.getAttribute('aColonyMapRigid')).forEach(mesh => {
    const positions = mesh.geometry.getAttribute('position'), rigid = mesh.geometry.getAttribute('aColonyMapRigid');
    for (let i = 0; i < positions.count; i += 1) {
      if (rigid.getX(i)) continue;
      const p = fit.point([positions.getX(i), positions.getZ(i)]);
      const clearance = frontPlane[0] * p[0] + frontPlane[1] * p[1] + frontPlane[2];
      // Exclude corner wall ends; the commercial frontage between corners is open.
      const t = ((p[0] - frontEdge[0][0]) * (frontEdge[1][0] - frontEdge[0][0]) + (p[1] - frontEdge[0][1]) * (frontEdge[1][1] - frontEdge[0][1])) / Math.hypot(frontEdge[1][0] - frontEdge[0][0], frontEdge[1][1] - frontEdge[0][1]) ** 2;
      if (clearance < .06 && t > .02 && t < .98) {
        assert.ok(positions.getY(i) <= HEIGHTS.forecourt + .019, 'shop shutters must have a low front curb rather than a compound wall');
        curbVertices += 1;
      }
    }
  });
  assert.ok(curbVertices > 0);
  ctx.kit.dispose();
});
