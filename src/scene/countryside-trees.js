// Tree belts along field bunds (poplar/eucalyptus rows and mixed rounded
// trees), mango groves, and tree clumps fading out toward the horizon.
// Three levels of detail by distance from the colony; one instanced mesh per
// shape, plus soft ground-shadow decals so far trees sit on the land.
import { hash, unit, fieldsAround } from './countryside-layout.js';
import { patchMaterial } from './countryside-fields.js';
import { townDensity } from './city-layout.js';

// Leafy canopy: world-space clumps and gaps that fade out with distance.
const LEAVES = `
  vec3 wp = cfWorld * 16.0; float fa = cfFade(wp.x, 1.0);
  float leaf = mix(0.5, rgNoise(wp.xz + wp.y * 1.7) * 0.6 + rgNoise(wp.zy * 2.3 + 3.0) * 0.4, fa);
  diffuseColor.rgb *= 0.68 + 0.64 * leaf;
  float cfHeight = leaf * 0.035;
`;

// Unit tree (height 1): lumpy blobs with smooth ellipsoid normals, darker
// underneath and mottled into leaf clumps; optional trunk. Non-indexed.
function treeGeometry(THREE, { detail, blobs, slim, trunk }) {
  const [rx, ry, cy] = slim ? [.12, .36, .64] : [.44, .34, .62];
  const positions = [], normals = [], colours = [];
  blobs.forEach(([bx, by, bz, bs]) => {
    const blob = detail < 0 ? new THREE.OctahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, detail), p = blob.getAttribute('position');
    for (let i = 0; i < p.count; i += 1) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), lump = .78 + .42 * Math.abs(Math.sin(x * 5.1 + y * 3.7 + bx * 9) * Math.cos(z * 4.3 - y * 2.3));
      positions.push(bx + x * rx * bs * lump, cy + by + y * ry * bs * lump, bz + z * rx * bs * lump);
      const n = new THREE.Vector3(x / rx, y / ry * .7, z / rx).normalize(); normals.push(n.x, n.y, n.z);
      const mottle = .78 + .44 * Math.abs(Math.sin(x * 12.9 + y * 7.3 + z * 4.1 + bz * 5)), shade = (.45 + .55 * (y + 1) / 2) * mottle; colours.push(shade, shade, shade);
    }
    blob.dispose();
  });
  if (trunk) {
    const stem = new THREE.CylinderGeometry(.025, .045, cy, trunk, 1, true).toNonIndexed(); stem.translate(0, cy / 2, 0);
    const p = stem.getAttribute('position'), n = stem.getAttribute('normal');
    for (let i = 0; i < p.count; i += 1) { positions.push(p.getX(i), p.getY(i), p.getZ(i)); normals.push(n.getX(i), n.getY(i), n.getZ(i)); const shade = .2 + .25 * p.getY(i) / cy; colours.push(shade, shade * .9, shade * .75); }
    stem.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  return geometry;
}
const CLUSTER = [[0, 0, 0, 1], [.13, -.06, .09, .72], [-.11, .08, -.07, .68]];

const KEEP = .15; // share of the countryside trees kept: open farmland, not woodland

export default function buildTrees(ctx, planes, extra = []) {
  const { THREE, kit, scene, quality } = ctx;
  const random = kit.rng(8080), trees = [...extra];
  const clear = (x, z, margin) => planes.some(([nx, nz, offset]) => nx * x + nz * z > offset + margin) && (z < 12.1 || z > 14.3);
  const plant = (x, z, slim, size, stretch = 1, yaw) => { if (clear(x, z, .45) && townDensity(x, z) < .12) trees.push([x, z, slim, size, stretch, yaw]); };
  // Belts along chosen field edges; groves fill some fallow fields.
  fieldsAround(150, 1.1).forEach((field) => {
    const d = Math.hypot(...field.center), keep = d < 70 ? 1 : d < 140 ? .75 : 0; if (!keep) return;
    const [x0, x1, z0, z1] = field.rect;
    [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]].forEach(([ua, va, ub, vb], edge) => {
      const h = hash(field.id + edge * 977); if (unit(h) > .05 * keep) return;
      const slim = unit(h >>> 16) < .4, step = slim ? .3 : .42, [ax, az] = field.toWorld(ua, va), [bx, bz] = field.toWorld(ub, vb);
      const len = Math.hypot(bx - ax, bz - az), gaps = unit(h >>> 8) < .5;
      for (let s = random() * step; s < len; s += step * (.8 + random() * .5)) {
        if (gaps && unit(hash(h + (s * 10 | 0))) < .25) continue;
        const t = s / len; plant(ax + (bx - ax) * t + (random() - .5) * .08, az + (bz - az) * t + (random() - .5) * .08, slim, slim ? .85 + random() * .4 : .48 + random() * .27);
      }
    });
    if (field.crop === 'fallow' && unit(field.id >>> 24) < .16 && d < 90) {
      const [sx, sz] = field.size, cols = Math.max(1, Math.floor(sx / .7)), rows = Math.max(1, Math.floor(sz / .7));
      for (let i = 0; i < cols; i += 1) for (let j = 0; j < rows; j += 1) if (random() < .9) {
        const [x, z] = field.toWorld(x0 + (x1 - x0) * (i + .5) / cols, z0 + (z1 - z0) * (j + .5) / rows);
        plant(x + (random() - .5) * .1, z + (random() - .5) * .1, false, .5 + random() * .2);
      }
    }
  });
  // Far tree belts toward the horizon: a few long, low, overlapping masses each.
  for (let i = 0; i < 700; i += 1) {
    const a = random() * Math.PI * 2, r = 120 + random() * 190, yaw = (random() < .5 ? 0 : Math.PI / 2) + .13 + (random() - .5) * .3, n = 2 + random() * 4 | 0;
    for (let k = 0; k < n; k += 1) { const s = (k - n / 2) * 2.6; plant(Math.cos(a) * r + Math.cos(yaw) * s, Math.sin(a) * r - Math.sin(yaw) * s, false, 1 + random() * .6, 2 + random() * 2, yaw); }
  }

  // Thin (the client wants few trees outside the colony) and by density; split by
  // level of detail (far masses sit on the ground: no trunk).
  const lods = [[24, 1, 6, CLUSTER.slice(0, 2)], [75, 0, 3, CLUSTER.slice(0, 1)], [1e9, 0, 0, [[0, -.2, 0, 1.15]]]];
  const buckets = new Map(), colour = new THREE.Color(), dummy = new THREE.Object3D(), shadows = [];
  trees.forEach((tree) => { const d = Math.hypot(tree[0], tree[1]); if (random() > quality.density * KEEP) return; const lod = lods.findIndex(([r]) => d < r); const key = `${lod}${tree[2] && lod < 2 ? 's' : 'r'}`; if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(tree); });
  const material = patchMaterial(kit.material('#ffffff', { vertexColors: true, roughness: .9 }), LEAVES);
  buckets.forEach((list, key) => {
    const [, detail, trunk, blobs] = lods[Number(key[0])], slim = key[1] === 's';
    const mesh = new THREE.InstancedMesh(kit.geometry(treeGeometry(THREE, { detail, blobs: slim ? blobs.slice(0, 1) : blobs, slim, trunk })), material, list.length);
    list.forEach(([x, z, , size, stretch, yaw], i) => {
      const w = slim ? size * (.65 + random() * .35) : size * (.85 + random() * .5);
      dummy.position.set(x, -.004, z); dummy.rotation.set(0, yaw ?? random() * 6.28, 0); dummy.scale.set(w * stretch, size, w); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, colour.setHSL(slim ? .2 + random() * .05 : .22 + random() * .08, slim ? .3 + random() * .15 : .38 + random() * .2, slim ? .3 + random() * .08 : .2 + random() * .09));
      if (Number(key[0]) > 0) shadows.push([x, z, size, w]);
    });
    mesh.castShadow = Number(key[0]) === 0; mesh.receiveShadow = false; scene.add(mesh);
  });
  return { trees: Object.fromEntries([...buckets].map(([k, l]) => [k, l.length])), shadows };
}
