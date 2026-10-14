// The Chakroad: the village road along the colony's north edge, as on the
// printed plan. The boulevard runs straight onto it (no wall or gate on this
// side) and a row of mango and neem trees lines its far side (planted by
// vegetation.js from chakroadLayout). Plan units: +offset is outward (north).
import { proceduralMaterial, uniform } from './kit.js';

// inner: road edge offset from the boundary line (inside, clear of every plot
// by ~5 and overlapping the boulevard's end); width/shoulder: carriageway and
// gravel verges; overrun: how far the road continues past both corners.
export const CHAKROAD = { inner: -7, width: 30, shoulder: 6, treeOffset: 47, treeSpacing: 56, overrun: 640 };

export function chakroadLayout(plan) {
  const [a, b] = [plan.boundary[0], plan.boundary[1]], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const d = [(b[0] - a[0]) / length, (b[1] - a[1]) / length], n = [d[1], -d[0]];
  const at = (t, offset) => [a[0] + d[0] * t + n[0] * offset, a[1] + d[1] * t + n[1] * offset];
  const trees = [];
  for (let t = -CHAKROAD.overrun + 30, i = 0; t < length + CHAKROAD.overrun - 30; t += CHAKROAD.treeSpacing, i += 1) trees.push({ point: at(t, CHAKROAD.treeOffset), radius: 22, kind: i % 2 });
  return { length, at, trees, centre: CHAKROAD.inner + CHAKROAD.width / 2 };
}

export default function buildChakroad(ctx) {
  const { THREE, plan, kit, world, SCALE, root } = ctx;
  const { length, at, centre } = chakroadLayout(plan), half = CHAKROAD.width / 2, outer = half + CHAKROAD.shoulder;
  // One ribbon: gravel verge | asphalt | gravel verge, with the across offset per vertex.
  const across = [-outer, -half, half, outer], positions = [], offsets = [], index = [];
  const t0 = -CHAKROAD.overrun, t1 = length + CHAKROAD.overrun, steps = Math.ceil((t1 - t0) / 40);
  for (let s = 0; s <= steps; s += 1) {
    const t = t0 + (t1 - t0) * s / steps;
    across.forEach((offset) => { const [x, z] = world(at(t, centre + offset)); positions.push(x, 0, z); offsets.push(offset * SCALE); });
    if (s < steps) for (let k = 0; k < 3; k += 1) { const i = s * 4 + k; index.push(i, i + 4, i + 1, i + 1, i + 4, i + 5); }
  }
  const geometry = kit.geometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('aAcross', new THREE.Float32BufferAttribute(offsets, 1));
  geometry.setIndex(index); geometry.computeVertexNormals();
  const material = proceduralMaterial(kit, {
    uniforms: { uAsphalt: uniform('vec3', new THREE.Color('#202326')), uGravel: uniform('vec3', new THREE.Color('#a59a83')), uHalf: uniform('float', half * SCALE) },
    attributes: 'attribute float aAcross;', varyings: 'varying float vAcross;', vertex: 'vAcross = aAcross;',
    surface: `
      vec2 p = vWorld.xz; float e = abs(vAcross) - uHalf + (rgFbm(p * 9.0) - 0.5) * 0.05;
      vec3 asphalt = uAsphalt * (0.86 + 0.2 * rgFbm(p * 3.0)) * (0.92 + 0.12 * rgFine(p * 110.0));
      asphalt = mix(asphalt, asphalt * 1.22, smoothstep(0.05, 0.0, abs(abs(vAcross) - uHalf * 0.45)) * 0.6);
      asphalt *= 1.0 - 0.18 * smoothstep(0.62, 0.8, rgFbm(p * 1.4 + 5.0));
      vec3 gravel = uGravel * (0.8 + 0.3 * rgFine(p * 140.0)) * (0.9 + 0.15 * rgFbm(p * 6.0));
      diffuseColor.rgb = mix(asphalt, gravel, smoothstep(-0.01, 0.01, e));`,
    roughness: .95,
  });
  kit.mesh(geometry, material, root, { cast: false }).position.y = .012;
  return {};
}
