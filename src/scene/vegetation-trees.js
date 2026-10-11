// Procedural plant geometry, normalised to height 1 (instances scale it).
// Leaves are alpha-cut cards on lumpy clump volumes; their normals are bent
// outward from the crown so the canopy shades like a soft dome, and vertex
// colours darken the inside and underside. `aLeaf` = 1 on foliage (tinted per
// instance, flutters in the wind), 0 on bark.
import * as THREE from 'three';
import { rng } from './kit.js';
import { TILE, tileRect } from './vegetation-textures.js';

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function builder() {
  const position = [], normal = [], uv = [], color = [], leaf = [], index = [];
  const vertex = (p, n, [u, v], c, l) => { position.push(p.x, p.y, p.z); normal.push(n.x, n.y, n.z); uv.push(u, v); color.push(c, c, c); leaf.push(l); return position.length / 3 - 1; };
  return {
    vertex, count: () => position.length / 3,
    tri: (a, b, c) => index.push(a, b, c),
    quad: (a, b, c, d) => index.push(a, b, c, a, c, d),
    // A leaf card: centre, half-axes, tile, per-corner shade/normal callbacks.
    card(center, right, up, tile, shadeAt, normalAt) {
      const [u0, v0, u1, v1] = tileRect(tile), corners = [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]];
      const ids = corners.map(([sx, sy, u, v]) => { const p = center.clone().addScaledVector(right, sx).addScaledVector(up, sy); return vertex(p, normalAt(p), [u, v], shadeAt(p), 1); });
      index.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
    },
    // Tapered tube through points (bark tile), `sides` around.
    tube(points, radii, sides, tile, shadeAt = () => 1, leafy = 0) {
      const [u0, v0, u1, v1] = tileRect(tile), base = position.length / 3, axis = v3(), side = v3(), other = v3(), n = v3();
      points.forEach((p, i) => {
        axis.subVectors(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]).normalize();
        side.set(1, 0, 0).cross(axis); if (side.lengthSq() < .01) side.set(0, 0, 1).cross(axis); side.normalize(); other.crossVectors(axis, side);
        for (let s = 0; s <= sides; s += 1) {
          const a = s / sides * Math.PI * 2; n.copy(side).multiplyScalar(Math.cos(a)).addScaledVector(other, Math.sin(a));
          vertex(p.clone().addScaledVector(n, radii[i]), n, [u0 + (u1 - u0) * s / sides, v0 + (v1 - v0) * i / (points.length - 1)], shadeAt(p), leafy);
        }
      });
      for (let i = 0; i < points.length - 1; i += 1) for (let s = 0; s < sides; s += 1) { const a = base + i * (sides + 1) + s, b = a + sides + 1; index.push(a, b, a + 1, a + 1, b, b + 1); }
    },
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
      g.setAttribute('aLeaf', new THREE.Float32BufferAttribute(leaf, 1)); g.setIndex(index); g.computeBoundingSphere(); return g;
    },
  };
}

const randomDir = (r, minY = -1) => { const y = minY + (1 - minY) * r(), a = r() * Math.PI * 2, s = Math.sqrt(1 - y * y); return v3(Math.cos(a) * s, y, Math.sin(a) * s); };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Broadleaf tree / sapling / shrub. o: { seed, tile, trunk (crown base), rx, ry, clumps, cards, card, trunkRadius, branches }
export function broadleaf(o) {
  const r = rng(o.seed), b = builder(), top = 1 - (o.lift ?? 0), centre = v3(0, top - o.ry, 0), radii = v3(o.rx, o.ry, o.rx);
  const clumps = [{ c: centre.clone(), r: Math.min(o.rx, o.ry) * .72 }];
  for (let i = 0; i < o.clumps; i += 1) { const d = randomDir(r, -.35), s = (.16 + r() * .08) / .2 * Math.min(o.rx, o.ry) * .5; clumps.push({ c: centre.clone().add(d.multiply(radii).multiplyScalar(.58)), r: s }); }
  const depth = (p) => p.clone().sub(centre).divide(radii).length();
  const shadeAt = (p) => (.42 + .58 * smooth(.3, 1.05, depth(p))) * (.66 + .34 * smooth(centre.y - o.ry, top, p.y)) * (o.shade ?? 1);
  // Trunk with root flare, then branches reaching into the clumps.
  if (o.trunkRadius) {
    const lean = v3((r() - .5) * .06, 0, (r() - .5) * .06), crown = centre.y - o.ry * .55;
    const points = [0, .05, .4, .75, 1].map(t => v3(lean.x * t * t + Math.sin(t * 5 + o.seed) * .012, crown * t, lean.z * t * t));
    b.tube(points, [o.trunkRadius * 1.5, o.trunkRadius * 1.08, o.trunkRadius, o.trunkRadius * .85, o.trunkRadius * .7], 7, TILE.bark, () => .85);
    clumps.slice(1, 1 + (o.branches ?? 4)).forEach(({ c }) => {
      const from = points[3 + Math.floor(r() * 2)], to = from.clone().lerp(c, .8), mid = from.clone().lerp(to, .5).add(v3(0, .03, 0));
      b.tube([from, mid, to], [o.trunkRadius * .55, o.trunkRadius * .38, o.trunkRadius * .18], 5, TILE.bark, () => .75);
    });
  }
  // Opaque inner mass so the canopy never looks see-through from afar.
  const core = new THREE.IcosahedronGeometry(1, o.coreDetail ?? 1), cp = core.getAttribute('position'), [u0, v0, u1, v1] = tileRect(TILE.mat);
  clumps.forEach(({ c, r: s }) => {
    const base = b.count();
    for (let i = 0; i < cp.count; i += 1) {
      const n = v3().fromBufferAttribute(cp, i), p = c.clone().addScaledVector(n, s * .74 * (.9 + .2 * Math.sin(n.x * 7 + n.z * 5 + o.seed)));
      b.vertex(p, n.clone().add(p.clone().sub(centre).normalize()).normalize(), [u0 + (u1 - u0) * (.5 + n.x * .45), v0 + (v1 - v0) * (.5 + n.y * .45)], shadeAt(p) * .8, 1);
    }
    for (let i = 0; i < cp.count; i += 3) b.tri(base + i, base + i + 1, base + i + 2);
  });
  core.dispose();
  // Leaf cards scattered over the clump surfaces (skipping buried ones).
  const total = clumps.reduce((sum, { r: s }) => sum + s * s, 0);
  clumps.forEach(({ c, r: s }) => {
    const count = Math.round(o.cards * s * s / total);
    for (let k = 0, tries = 0; k < count && tries < count * 4; tries += 1) {
      const d = randomDir(r, -.6), p = c.clone().addScaledVector(d, s * (.72 + r() * .38));
      if (clumps.some(other => other.c !== c && p.distanceTo(other.c) < other.r * .7)) continue;
      k += 1;
      const facing = d.clone().add(randomDir(r).multiplyScalar(.9)).normalize(), size = o.card * (.8 + r() * .4);
      const right = v3(0, 1, 0).cross(facing); if (right.lengthSq() < .01) right.set(1, 0, 0); right.normalize();
      const up = facing.clone().cross(right).normalize(), spin = r() * Math.PI * 2;
      const rr = right.clone().multiplyScalar(Math.cos(spin)).addScaledVector(up, Math.sin(spin)).multiplyScalar(size), uu = facing.clone().cross(rr);
      const tile = o.tiles ? o.tiles[Math.floor(r() * o.tiles.length)] : o.tile;
      b.card(p, rr, uu, tile, shadeAt, (q) => q.clone().sub(c).normalize().add(q.clone().sub(centre).divide(radii).normalize()).add(v3(0, .25, 0)).normalize());
    }
  });
  return b.build();
}
