import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createKit, HEIGHTS } from './kit.js';
import { createMaterials } from './architecture-common.js';
import { buildHShops } from './architecture-h-shops.js';
import { applyColonyMapFit } from './colonyMapFit.js';

function fixture() {
  const plan = { width: 1460, height: 1370 }, kit = createKit({ capabilities: { getMaxAnisotropy: () => 1 } }, plan);
  const drawnLabels = [];
  kit.canvasTexture = (width, height, draw) => {
    draw({ fillRect() {}, strokeText() {}, fillText(text) { drawnLabels.push(text); } }, width, height);
    return kit.track(new THREE.Texture());
  };
  const transform = ([x, z]) => [x * Math.cos(.38) - z * Math.sin(.38) + 2, x * Math.sin(.38) + z * Math.cos(.38) + 1];
  const shops = Array.from({ length: 12 }, (_, i) => {
    const x = i * .7, depth = 1.8 - i * .09;
    const polygon = [[x, 0], [x + .7, .025], [x + .62, depth], [x + .06, depth + .05]].map(transform);
    const center = [0, 1].map(axis => polygon.reduce((sum, p) => sum + p[axis] / 4, 0));
    return { number: `H${12 - i}`, polygon, center, facade: polygon.slice(0, 2) };
  });
  const targetBoundary = [[-3, -3], [18, -3], [18, 8], [-3, 8]];
  const ctx = { THREE, kit, plan, root: new THREE.Group(), HEIGHTS, frontage: { gateScale: .8, commercialApron: { shops, targetBoundary } } };
  return { ctx, shops, drawnLabels, mat: createMaterials(kit) };
}

test('all twelve H shop bodies and roofs retain their exact tapered reference footprints', () => {
  const { ctx, shops, drawnLabels, mat } = fixture(), before = JSON.stringify(shops);
  const group = buildHShops(ctx, mat);
  assert.equal(group.children.filter(item => item.userData.shopNumber).length, 12);
  assert.deepEqual(drawnLabels, shops.map(shop => shop.number));
  assert.equal(JSON.stringify(shops), before);
  for (const shop of shops) {
    for (const suffix of ['polygon body', 'neutral roof']) {
      const mesh = group.getObjectByName(`${shop.number} ${suffix}`), positions = mesh.geometry.getAttribute('position');
      assert.ok(mesh);
      for (let i = 0; i < positions.count; i++) {
        assert.ok(shop.polygon.some(([x, z]) => Math.hypot(x - positions.getX(i), z - positions.getZ(i)) < 1e-6), 'extruded vertices must preserve fitted polygon coordinates');
      }
      mesh.geometry.computeBoundingBox();
      if (suffix === 'neutral roof') assert.ok(Math.abs(mesh.geometry.boundingBox.max.y - HEIGHTS.shopRoof * ctx.frontage.gateScale) < 1e-7);
      else assert.ok(Math.abs(mesh.geometry.boundingBox.min.y - HEIGHTS.forecourt) < 1e-7);
    }
    const roof = group.getObjectByName(`${shop.number} neutral roof`);
    assert.equal(roof.material.color.getHexString(), 'dfddd4');
    assert.ok(group.getObjectByName(`${shop.number} roof label`));
    assert.ok(group.getObjectByName(`${shop.number} sign label`));
  }
  assert.ok(group.children.some(mesh => mesh.material?.color?.getHexString() === '111111'), 'roof outlines use thin black material');
  ctx.kit.dispose();
});

test('shutters follow the actual angled facade and face away from the shop interior', () => {
  const { ctx, shops, mat } = fixture(), group = buildHShops(ctx, mat);
  for (const shop of shops) {
    const shutter = group.getObjectByName(`${shop.number} apron-facing shutter`), [a, b] = shop.facade;
    const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], outward = shutter.userData.outward;
    assert.ok(outward[0] * (shop.center[0] - midpoint[0]) + outward[1] * (shop.center[1] - midpoint[1]) < 0);
    const normal = new THREE.Vector3(0, 0, 1).applyEuler(shutter.rotation);
    assert.ok(normal.x * outward[0] + normal.z * outward[1] > .999999);
    const tangent = new THREE.Vector3(1, 0, 0).applyEuler(shutter.rotation);
    const facade = new THREE.Vector3(b[0] - a[0], 0, b[1] - a[1]).normalize();
    assert.ok(Math.abs(tangent.dot(facade)) > .999999, 'panel width follows the edge, regardless of map rotation');
    assert.ok((shutter.position.x - midpoint[0]) * outward[0] + (shutter.position.z - midpoint[1]) * outward[1] > 0, 'panel sits just outside the body facing the apron');
  }
  ctx.kit.dispose();
});

test('outer commercial geometry keeps its identity registration when the interior is fitted again', () => {
  const { ctx, mat } = fixture(), group = buildHShops(ctx, mat);
  const interiorFit = { matrix: [2, 0, 50, 0, 3, -20, 0, 0, 1], target: [[-100, -100], [100, -100], [100, 100], [-100, 100]],
    point: ([x, z]) => [2 * x + 50, 3 * z - 20], asset: source => ({ source, target: [2 * source[0] + 50, 3 * source[1] - 20], scale: 2, angle: 0 }) };
  const body = group.getObjectByName('H12 polygon body'), originalPositions = [...body.geometry.getAttribute('position').array];
  applyColonyMapFit({ root: ctx.root, ctx }, interiorFit);
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  body.material.onBeforeCompile(shader);
  assert.deepEqual(shader.uniforms.uColonySite.value.toArray(), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.equal(shader.uniforms.uColonySiteEdges.value.length, 4);
  assert.deepEqual([...body.geometry.getAttribute('position').array], originalPositions);
  ctx.kit.dispose();
});
