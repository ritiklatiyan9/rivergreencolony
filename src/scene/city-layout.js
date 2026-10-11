// Shamli town footprint, shared by the town builder (JS) and the countryside
// ground shader / placement filters (GLSL + JS). Same integer hash on both
// sides, so the urban ground sits exactly under the buildings.
import { hash, unit } from './countryside-layout.js';

// Settlement blobs [x, z, radius, weight]: old town core, its body, and the
// suburbs that sprawl along and across Shamli Road. They are authored on the
// east side and mirrored across the colony's centre line (MIRROR_X): the town
// lies WEST of the colony (left in the default view), the farms east.
export const BLOBS = [[50, -72, 30, 1], [62, -58, 55, .55], [14, -100, 30, .5], [18, -150, 40, .6], [105, -130, 55, .5], [125, -30, 45, .55], [80, 35, 28, .45]];
export const ROAD_Z = 13.26; // Shamli Road centre line (countryside ROAD z0..z1)
export const WEST = [24, .17]; // inner (colony-side) edge of the town, in authored coordinates
export const MIRROR_X = -.7; // world x = MIRROR_X - authored x (the colony box is symmetric about x = -.35)

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lattice = (ix, iz) => unit(hash(((ix + 4096) * 7919) ^ (iz + 4096)));
const vnoise = (x, z) => {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = lattice(ix, iz), b = lattice(ix + 1, iz), c = lattice(ix, iz + 1), d = lattice(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

// 0 = farmland, ~.25 scattered houses, ~.5 built-up, ≥ .8 dense old town.
export function townDensity(worldX, z) {
  const x = MIRROR_X - worldX; let d = 0;
  for (const [cx, cz, r, w] of BLOBS) d += w * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));
  d += .5 * smooth(32, 48, x) * Math.exp(-(((z - ROAD_Z) / 5) ** 2)); // ribbon of shops along the road
  d *= .45 + 1.1 * (vnoise(x / 11, z / 11) * .65 + vnoise(x / 4.3 + 17, z / 4.3) * .35);
  d *= smooth(-3, 9, x - (WEST[0] + WEST[1] * z) + (vnoise(x / 6, z / 6 + 40) - .5) * 14); // farmland stays between the town and the colony (ragged edge)
  const ox = Math.max(-14 - x, 0, x - 13.3), oz = Math.max(-12.5 - z, 0, z - 12.5);
  d *= smooth(15, 23, Math.hypot(ox, oz)); // open fields around the colony
  return Math.min(d, 1.2);
}

// GLSL mirror (needs cfH / cfU from countryside LAYOUT_GLSL).
export const CITY_GLSL = `
float ctLattice(float ix, float iz){ return cfU(cfH((uint(int(ix) + 4096) * 7919u) ^ uint(int(iz) + 4096))); }
float ctNoise(vec2 p){ vec2 i = floor(p), f = p - i, u = f * f * (3.0 - 2.0 * f);
  float a = ctLattice(i.x, i.y), b = ctLattice(i.x + 1.0, i.y), c = ctLattice(i.x, i.y + 1.0), d = ctLattice(i.x + 1.0, i.y + 1.0);
  return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y; }
float ctDensity(vec2 p){
  p.x = ${MIRROR_X.toFixed(2)} - p.x;
  if (p.x < ${WEST[0].toFixed(2)} + ${WEST[1].toFixed(3)} * p.y - 10.0) return 0.0;
  float d = 0.0;
  ${BLOBS.map(([x, z, r, w]) => `d += ${w.toFixed(3)} * exp(-dot(p - vec2(${x.toFixed(1)}, ${z.toFixed(1)}), p - vec2(${x.toFixed(1)}, ${z.toFixed(1)})) / ${(r * r).toFixed(1)});`).join('\n  ')}
  d += 0.5 * smoothstep(32.0, 48.0, p.x) * exp(-pow((p.y - ${ROAD_Z.toFixed(2)}) / 5.0, 2.0));
  d *= 0.45 + 1.1 * (ctNoise(p / 11.0) * 0.65 + ctNoise(p / 4.3 + 17.0) * 0.35);
  d *= smoothstep(-3.0, 9.0, p.x - (${WEST[0].toFixed(2)} + ${WEST[1].toFixed(3)} * p.y) + (ctNoise(p / 6.0 + vec2(0.0, 40.0)) - 0.5) * 14.0);
  vec2 o = max(vec2(-14.0, -12.5) - p, max(vec2(0.0), p - vec2(13.3, 12.5)));
  d *= smoothstep(15.0, 23.0, length(o));
  return min(d, 1.2);
}
`;

// Self-check: node src/scene/city-layout.js
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('city-layout.js')) {
  const rows = []; for (let z = -200; z <= 60; z += 8) { let row = ''; for (let x = -40; x <= 200; x += 4) row += ' .:-=+*#%@'[Math.min(9, Math.floor(townDensity(MIRROR_X - x, z) * 8))]; rows.push(`${String(z).padStart(5)} ${row}`); }
  console.log(rows.join('\n'));
  console.assert(townDensity(0, 0) === 0 && townDensity(-20, 0) === 0, 'colony and its fields must stay clear');
  console.assert(townDensity(MIRROR_X - 50, -72) > .5 && townDensity(50, -72) === 0, 'the town lies west, farms east');
}
