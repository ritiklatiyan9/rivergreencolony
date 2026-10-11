// Shamli town plan: every field block inside the town footprint becomes an
// urban block (old field bunds -> lanes, block edges -> streets) lined with
// rows of attached houses; a ribbon of shops lines Shamli Road. Pure JS.
import { fieldAt, ROT, BX, BZ } from './countryside-layout.js';
import { townDensity, ROAD_Z, MIRROR_X } from './city-layout.js';

export const MAIN = .28, LANE = .13; // street half-widths (world units): block edges / old bunds
export const CORRIDOR = [12.3, 14.25]; // Shamli Road + shoulders + footpaths: no buildings
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// house: { x, z, yaw, w, d, n (storeys), st (storey height), style (0 house, 1 shop front, 2 brick), D }
export function planTown(random, density = 1, LOD = 50, clear = []) {
  const houses = [], trees = [], seen = new Set();
  const blocked = (x, z, pad = .4) => clear.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < (r + pad) ** 2);
  const keep = (p) => random() < p * density;
  const add = (frame, a, b, w, d, D, style = 0) => {
    const [x, z] = frame(a + w / 2, b + d / 2);
    const band = x > 28 ? 1.1 : 0; // the shop ribbon owns the road frontage in town
    if ((z + d * .75 > CORRIDOR[0] - band && z - d * .75 < CORRIDOR[1] + band) || blocked(x, z)) return; // never on Shamli Road or a landmark
    const tall = D > .75 && random() < .025, n = tall ? 5 + (random() < .4) : 1 + Math.floor(random() * (1.3 + 2.4 * Math.min(D, 1)) + .3 * D);
    houses.push({ x, z, yaw: frame.yaw, w: tall ? w * 1.6 : w, d: tall ? Math.max(d, .8) : d, n, st: .23 + random() * .04, style: style || (random() < .03 + .07 * (1 - D) ? 2 : 0), D });
  };
  // Row of attached houses along one block edge, from a0 to a1 (local a), front at b0 facing -b (dir 1) or +b (dir -1).
  const row = (frame, a0, a1, b0, dir, depth, D, k, style) => {
    const skip = .05 + .75 * (1 - smooth(.12, .6, D));
    for (let a = a0; a < a1 - .22;) {
      const w = Math.min((.26 + random() * (.3 + .2 * (1 - D))) * k, a1 - a), d = depth * (.65 + random() * .35);
      if (random() > skip) add(frame, a, dir > 0 ? b0 : b0 - d, w, d, D, style);
      else if (random() < .75) trees.push(at(frame, a + w / 2, b0 + dir * d / 2, .35 + random() * .3));
      a += w + (random() < .12 ? .05 + random() * .2 : 0);
    }
  };
  const at = (frame, a, b, s) => { const [x, z] = frame(a, b); return { x, z, s }; };
  for (let x = -12; x <= 200; x += 1) for (let z = -215; z <= 75; z += 1) {
    const field = fieldAt(x, z); if (seen.has(field.key)) continue; seen.add(field.key);
    const [x0, x1, z0, z1] = field.rect, [ox, oz] = field.toWorld(x0, z0), c = Math.cos(ROT), s = Math.sin(ROT);
    const frame = (a, b) => [ox + a * c + b * s, oz - a * s + b * c]; frame.yaw = ROT;
    const [W, H] = field.size, [cx, cz] = frame(W / 2, H / 2), D = townDensity(cx, cz);
    // ponytail: lots coarsen with distance (k) -- a 5 m house is 2 px wide on the horizon.
    const far = Math.hypot(cx, cz), k = Math.max(1, far / LOD) * (1 + Math.max(0, far - 110) / 120);
    if (far > 195) continue; // lost in the haze
    if (D < .05 || !keep(1)) continue;
    // Street insets: wide on the old 7 × 5 block edges, narrow lanes on the field splits.
    const ia0 = x0 < 1e-6 ? MAIN : LANE, ia1 = x1 > 1 - 1e-6 ? MAIN : LANE, ib0 = z0 < 1e-6 ? MAIN : LANE, ib1 = z1 > 1 - 1e-6 ? MAIN : LANE;
    const A0 = ia0, A1 = W - ia1, B0 = ib0, B1 = H - ib1;
    if (A1 - A0 < .5 || B1 - B0 < .5) continue;
    if (D < .22) { // farmland with a few scattered houses and their trees
      for (let k = Math.floor(random() * D * 14); k > 0; k -= 1) {
        const a = A0 + random() * (A1 - A0 - .6), b = B0 + random() * (B1 - B0 - .6);
        add(frame, a, b, .3 + random() * .3, .3 + random() * .35, D * .5);
        if (random() < .7) trees.push(at(frame, a + .7, b + .2, .4 + random() * .3));
      }
      continue;
    }
    const depth = Math.min((.55 + random() * .4) * Math.sqrt(k), (B1 - B0) / 2);
    const bazaar = (inset) => (inset === MAIN && D > .45 && random() < .7 ? 1 : 0); // shop fronts on the main streets
    row(frame, A0, A1, B0, 1, depth, D, k, bazaar(ib0));
    row(frame, A0, A1, B1, -1, depth, D, k, bazaar(ib1));
    const side = Math.min((.5 + random() * .3) * Math.sqrt(k), (A1 - A0) / 2);
    if (B1 - B0 > depth * 2 + .4 && k < 3) {
      const sideFrame = (a, b) => frame(b, a); sideFrame.yaw = ROT; // swap axes: rows along the short edges
      rowSide(sideFrame, B0 + depth, B1 - depth, A0, A1, side, D, k);
    }
    // Interior: courtyard houses when dense, otherwise trees and open ground.
    const ix0 = A0 + side + .1, ix1 = A1 - side - .1, iz0 = B0 + depth + .1, iz1 = B1 - depth - .1;
    if (k < 2.5) for (let a = ix0; a < ix1 - .3; a += (.45 + random() * .25) * k) for (let b = iz0; b < iz1 - .3; b += (.45 + random() * .25) * k) {
      if (D > .55 && random() < .7) add(frame, a, b, (.35 + random() * .2) * k, (.35 + random() * .2) * k, D * .8);
      else if (random() < .7) trees.push(at(frame, a + .2, b + .2, .35 + random() * .35));
    }
    if (k >= 2.5 && ix1 - ix0 > .3 && iz1 - iz0 > .3 && random() < .6) trees.push(at(frame, (ix0 + ix1) / 2, (iz0 + iz1) / 2, .5 + random() * .4));
  }
  // Ribbon of road-facing shops (ground-floor shutters) on both sides of Shamli Road into town.
  // The town lies west (city-layout.js MIRROR_X), so the ribbon runs westward from s = 30.
  for (const [front, dir] of [[CORRIDOR[0] + .1, -1], [CORRIDOR[1] - .25, 1]]) for (let s = 30; s < 190;) {
    const x = MIRROR_X - s, D = townDensity(x, front + dir), w = (.28 + random() * .3) * Math.max(1, s / LOD), d = .55 + random() * .4;
    if (random() < .15 + 1.6 * D && random() < density) {
      const z = front + dir * d / 2, n = 1 + Math.floor(random() * (1.4 + 2.2 * Math.min(D, 1)));
      if (!blocked(x - w / 2, z)) houses.push({ x: x - w / 2, z, yaw: 0, w, d, n, st: .25 + random() * .03, style: 1, D });
    }
    s += w + (random() < .1 ? .2 + random() * .5 : 0);
  }
  // ponytail: a third of the street trees — the client asked for few trees outside the colony.
  return { houses, trees: trees.filter((t, i) => !blocked(t.x, t.z, .1) && i % 3 === 0) };

  function rowSide(sideFrame, a0, a1, b0, b1, depth, D, k) {
    // Short edges: houses face outward along -a / +a; reuse row() with swapped axes and swapped sizes.
    const swapped = (a, b) => sideFrame(a, b); swapped.yaw = ROT;
    for (const [front, dir] of [[b0, 1], [b1, -1]]) for (let a = a0; a < a1 - .22;) {
      const w = Math.min((.26 + random() * .35) * k, a1 - a), d = depth * (.65 + random() * .35);
      if (random() > .05 + .75 * (1 - smooth(.12, .6, D))) {
        const b = dir > 0 ? front : front - d, [x, z] = sideFrame(a + w / 2, b + d / 2);
        if (!(z + d > CORRIDOR[0] && z - d < CORRIDOR[1]) && !blocked(x, z)) houses.push({ x, z, yaw: ROT, w: d, d: w, n: 1 + Math.floor(random() * (1.3 + 2.4 * Math.min(D, 1))), st: .23 + random() * .04, style: random() < .05 ? 2 : 0, D });
      }
      a += w;
    }
  }
}

// Self-check: node src/scene/city-blocks.js
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('city-blocks.js')) {
  import('./kit.js').then(({ rng }) => {
  const { houses } = planTown(rng(4242), 1, 30);
  const gap = ({ x, z }) => Math.hypot(Math.max(-14 - x, 0, x - 13.3), Math.max(-12.5 - z, 0, z - 12.5));
  console.assert(houses.every(h => gap(h) >= 15), 'houses keep 15 units of fields around the colony');
  console.assert(houses.every(h => h.z + h.d / 2 < 12.83 || h.z - h.d / 2 > 13.69), 'nothing on the Shamli Road carriageway');
  console.assert(planTown(rng(4242), 1, 30).houses.length === houses.length, 'deterministic');
  console.log('city-blocks ok:', houses.length, 'houses, nearest to colony', Math.min(...houses.map(gap)).toFixed(1));
  });
}
