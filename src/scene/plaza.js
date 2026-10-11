// The fountain plaza from the official printed plan: the tiered fountain from
// the project photograph fills the round island in the middle of the circular
// roundabout; clipped hedges line the corner gardens' straight edges; lamp
// posts and a paved walk follow their arcs; coconut palms line both sides of
// the boulevard.
import { proceduralMaterial, uniform } from './kit.js';
import { plazaLayout } from './plazaLayout.js';
import { buildPalms } from './plaza-palms.js';
import { buildFountain } from './plaza-fountain.js';

export default function buildPlaza(ctx) {
  const { THREE, plan, kit, world, SCALE, HEIGHTS, root } = ctx;
  const layout = plazaLayout(plan, ctx.siteFit), random = kit.rng(2727);
  const [fx, fz] = world(layout.island.centre), R = layout.island.radius * SCALE;
  const stone = proceduralMaterial(kit, {
    uniforms: { uStone: uniform('vec3', new THREE.Color('#ece8de')) },
    surface: 'vec2 p = vWorld.xz + vWorld.y; diffuseColor.rgb = uStone * (0.9 + 0.1 * rgFbm(p * 9.0)) * (0.95 + 0.07 * rgFine(p * 80.0));',
    roughness: .62,
  });

  // Clipped shrubs: lumpy spheres with a dense small-leaf surface, darker below.
  const ball = kit.geometry(new THREE.IcosahedronGeometry(1, 3)), bp = ball.getAttribute('position'), v = new THREE.Vector3();
  for (let i = 0; i < bp.count; i += 1) { v.fromBufferAttribute(bp, i); v.multiplyScalar(.92 + .1 * Math.sin(v.x * 7.1 + v.y * 5.3) * Math.cos(v.z * 6.7 - v.y * 3.1)); bp.setXYZ(i, v.x, Math.max(v.y, -.55), v.z); }
  ball.computeVertexNormals();
  const leafy = proceduralMaterial(kit, {
    uniforms: { uDark: uniform('vec3', new THREE.Color('#24461a')), uLight: uniform('vec3', new THREE.Color('#4f7d2c')) },
    varyings: 'varying float vLocalY;', vertex: 'vLocalY = position.y;',
    surface: `vec3 p = vWorld * 260.0; float leaf = rgNoise(p.xz + p.y) * 0.6 + rgNoise(p.zy * 0.5) * 0.4;
      diffuseColor.rgb = mix(uDark, uLight, leaf) * (0.55 + 0.45 * smoothstep(-0.6, 0.8, vLocalY));`,
    roughness: .9,
  });
  const shrubs = [];
  layout.gardens.forEach(garden => garden.hedges.forEach(point => { const [x, z] = world(point); shrubs.push([x, HEIGHTS.garden, z, .07 + random() * .008]); }));
  const balls = new THREE.InstancedMesh(ball, leafy, shrubs.length), dummy = new THREE.Object3D();
  shrubs.forEach(([x, y, z, r], i) => {
    dummy.position.set(x, y + r * .55, z); dummy.rotation.set(0, random() * 6, 0); dummy.scale.set(r, r * .9, r); dummy.updateMatrix(); balls.setMatrixAt(i, dummy.matrix);
    balls.setColorAt(i, new THREE.Color().setHSL(0, 0, .85 + random() * .3));
  });
  balls.castShadow = true; balls.receiveShadow = true; root.add(balls);

  // Garden arcs: a paved walk just inside each arc, lamp posts along its edge.
  const walkMaterial = proceduralMaterial(kit, {
    uniforms: { uPaver: uniform('vec3', new THREE.Color('#d3cbbb')) },
    surface: 'vec2 q = vWorld.xz / vec2(0.02, 0.02); float id = rgHash(floor(q)); diffuseColor.rgb = uPaver * (0.86 + 0.14 * id) * (1.0 - 0.28 * max(rgLine(q.x, 1.0, 0.05), rgLine(q.y, 1.0, 0.05)));',
    roughness: .92,
  });
  const { rx } = layout.ellipse, walkPositions = [], walkIndex = [];
  layout.gardens.forEach(({ arc: [a0, a1] }) => {
    const start = walkPositions.length / 3;
    for (let s = 0; s <= 32; s += 1) {
      const a = a0 + (a1 - a0) * s / 32;
      for (const grow of [3.5, 13]) { const [x, z] = world(layout.arcPoint(a, grow)); walkPositions.push(x, HEIGHTS.garden + .0015, z); }
      if (s < 32) { const k = start + s * 2; walkIndex.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
  });
  const walkGeometry = kit.geometry(new THREE.BufferGeometry()); walkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(walkPositions, 3)); walkGeometry.setIndex(walkIndex); walkGeometry.computeVertexNormals();
  const walk = kit.mesh(walkGeometry, walkMaterial, root, { cast: false }); walk.material.side = THREE.DoubleSide;
  // Steel pipe railings along each garden's arc, as round the real plaza.
  const steel = kit.material('#c3c7cb', { roughness: .35, metalness: .8 }), rail = [];
  layout.gardens.forEach(({ arc: [a0, a1] }) => {
    const steps = Math.max(2, Math.round((a1 - a0) * (rx + 2) * SCALE / .2)), point = (a) => world(layout.arcPoint(a, 1.6));
    for (let i = 0; i <= steps; i += 1) {
      const [x, z] = point(a0 + (a1 - a0) * i / steps); rail.push([[.006, .085, .006], [x, HEIGHTS.garden + .0425, z]]);
      if (i === steps) continue;
      const [nx, nz] = point(a0 + (a1 - a0) * (i + 1) / steps), length = Math.hypot(nx - x, nz - z), yaw = -Math.atan2(nz - z, nx - x);
      for (const y of [.045, .085]) rail.push([[length, .005, .005], [(x + nx) / 2, HEIGHTS.garden + y, (z + nz) / 2], yaw]);
    }
  });
  const railings = kit.boxes(steel, rail, root); railings.userData.colonyMapFit = { mode: 'surface' };
  const lamps = layout.gardens.flatMap(garden => garden.lamps);
  const iron = kit.material('#1d1f22', { roughness: .45, metalness: .6 });
  const posts = [], heads = [];
  lamps.forEach(point => { const [x, z] = world(point); posts.push([[.012, .2, .012], [x, HEIGHTS.garden + .1, z]], [[.03, .012, .03], [x, HEIGHTS.garden + .006, z]]); heads.push([[.03, .036, .03], [x, HEIGHTS.garden + .216, z]]); });
  kit.boxes(iron, posts, root); kit.boxes(kit.material('#fff3d6', { emissive: '#ffd9a0', emissiveIntensity: 1.1, roughness: .3 }), heads, root, kit.geometry(new THREE.CylinderGeometry(.5, .32, 1, 12)));

  // Coconut palms along both sides of the boulevard, each in a small kerbed ring on the plot edge.
  const spots = layout.roadsidePalms.map((point, i) => { const [x, z] = world(point); return { x, z, y: HEIGHTS.lawn, height: .62 + random() * .16, lean: .03 + random() * .05, turn: random() * 6 + i, girth: .017 }; });
  buildPalms(ctx, spots, root);
  const planterKerb = new THREE.InstancedMesh(kit.geometry(new THREE.CylinderGeometry(.04, .042, .012, 24)), stone, Math.max(spots.length, 1));
  spots.forEach(({ x, z }, i) => { dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.position.set(x, HEIGHTS.lawn + .004, z); dummy.updateMatrix(); planterKerb.setMatrixAt(i, dummy.matrix); });
  planterKerb.count = spots.length; planterKerb.castShadow = true; planterKerb.receiveShadow = true; root.add(planterKerb);

  const fountain = buildFountain(ctx, [fx, HEIGHTS.road + .004, fz], R, root, leafy);
  return { update: (seconds) => fountain.update(seconds) };
}
