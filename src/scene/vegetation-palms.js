// Palms (ringed trunk + crown of leaflet fronds) and clipped hedges.
import * as THREE from 'three';
import { rng } from './kit.js';
import { TILE, tileRect } from './vegetation-textures.js';
import { builder } from './vegetation-trees.js';

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// o: { seed, trunk (crown height, 0..1), fronds, length, droop, width, tile, curve }
export function palm(o) {
  const r = rng(o.seed), b = builder(), bend = v3((r() - .5) * .08 + (o.curve ?? .05), 0, (r() - .5) * .08);
  const spine = [0, .2, .45, .7, .9, 1].map(t => v3(bend.x * t * t, o.trunk * t, bend.z * t * t));
  b.tube(spine, spine.map((_, i) => .028 - i * .0025 + (i === 0 ? .012 : 0)), 8, TILE.palmBark, () => .9);
  const crown = spine.at(-1), [u0, v0, u1, v1] = tileRect(o.tile), steps = 9;
  for (let f = 0; f < o.fronds; f += 1) {
    const angle = f * 2.39996 + r() * .3, ring = f / o.fronds, rise = .95 - ring * 1.25 + (r() - .5) * .2;
    const dir = v3(Math.cos(angle) * Math.cos(rise), Math.sin(rise), Math.sin(angle) * Math.cos(rise)), side = v3(-Math.sin(angle), 0, Math.cos(angle));
    const length = o.length * (.8 + r() * .3) * (ring > .8 ? .8 : 1), droop = o.droop * (.7 + ring * .8);
    const rows = [];
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps, p = crown.clone().addScaledVector(dir, length * t).add(v3(0, -droop * t * t * length, 0));
      const width = o.width * length * Math.sin(Math.PI * Math.min(1, .12 + t * .95)), lift = v3(0, width * .32, 0);
      const out = p.clone().sub(crown).setY(Math.max(p.y - crown.y, 0) + .15).normalize(), shade = .8 + .2 * Math.min(1, t * 1.6);
      const u = u0 + (u1 - u0) * (.02 + t * .96);
      rows.push([-1, 0, 1].map(k => b.vertex(p.clone().addScaledVector(side, k * width).add(k ? lift : v3()), out, [u, v0 + (v1 - v0) * (.5 + k * .5)], shade, 1)));
    }
    for (let s = 0; s < steps; s += 1) for (let k = 0; k < 2; k += 1) b.quad(rows[s][k], rows[s + 1][k], rows[s + 1][k + 1], rows[s][k + 1]);
  }
  return b.build();
}

// A clipped hedge as one rounded, slightly lumpy box at its real size, with
// a darker base; `noise` is kit.makeNoise. Returns plain arrays for merging.
export function hedgeBox(length, width, height, round, noise, seed) {
  const g = new THREE.BoxGeometry(length, height, width, Math.max(2, Math.round(length / .02)), 4, Math.max(2, Math.round(width / .02)));
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), q = v3(), inner = v3(length / 2 - round, height / 2 - round, width / 2 - round), shade = [];
  for (let i = 0; i < p.count; i += 1) {
    q.fromBufferAttribute(p, i); const c = q.clone().clamp(inner.clone().negate(), inner), d = q.clone().sub(c);
    if (d.lengthSq() > 1e-8) { d.normalize(); q.copy(c).addScaledVector(d, round); n.setXYZ(i, d.x, d.y, d.z); }
    const bump = (noise.fbm(q.x * 60 + seed, q.z * 60 + q.y * 40, 3) - .5) * .012;
    q.addScaledVector(v3().fromBufferAttribute(n, i), bump);
    p.setXYZ(i, q.x, q.y + height / 2, q.z);
    const s = .42 + .58 * Math.pow((q.y + height / 2) / height, .8); shade.push(s, s, s);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3)); g.deleteAttribute('uv');
  return g;
}
