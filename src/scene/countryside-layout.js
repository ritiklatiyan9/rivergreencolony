// Field layout shared by the ground shader (GLSL) and the placement code (JS).
// Both use the same integer hash, so a cane block or a tree belt built in JS
// sits exactly on the field the shader paints. Fields: blocks of BX × BZ world
// units on a grid rotated by ROT, each row of blocks shifted, each block split
// once and then cut into 1–3 strips -> irregular rectangles of varied size.
export const ROT = .13, BX = 7, BZ = 5;
export const ROAD = { z0: 12.95, z1: 13.57, shoulder: .12 }; // Shamli Road carriageway (world z)
export const APPROACH = { x0: -1.8, x1: -.6, z0: 12.3 }; // paved link from the south entrance

const H = (x) => { x >>>= 0; x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16; return x >>> 0; };
const U = (h) => (h & 0xffff) / 65535;
export const hash = H, unit = U;

// Crop kinds by id: share of fields -> kind (also used by the shader thresholds).
export const cropOf = (id) => { const t = U(id >>> 4); return t < .34 ? 'cane' : t < .52 ? 'paddy' : t < .68 ? 'fodder' : t < .82 ? 'ploughed' : 'fallow'; };

export function fieldAt(x, z) {
  const c = Math.cos(ROT), s = Math.sin(ROT);
  const qx = c * x - s * z, qz = s * x + c * z;
  const bz = Math.floor(qz / BZ), hz = H(bz + 32768), shift = U(hz) * BX;
  const sx = qx + shift, bx = Math.floor(sx / BX);
  const lx = sx / BX - bx, lz = qz / BZ - bz;
  const h = H((bx + 32768) ^ hz), ax = (h & 1) === 1, t = .3 + .4 * U(h >>> 16);
  const along = ax ? lz : lx, across = ax ? lx : lz, part = along < t ? 0 : 1;
  const a0 = part ? t : 0, a1 = part ? 1 : t;
  const h2 = H(h + part + 1), n = 1 + h2 % 3, k = Math.min(Math.floor(across * n), n - 1);
  const c0 = k / n, c1 = (k + 1) / n;
  const [x0, x1, z0, z1] = ax ? [c0, c1, a0, a1] : [a0, a1, c0, c1];
  const id = H(h2 + k + 101);
  // Rectangle corners back in world space (q-space -> world).
  const toWorld = (u, v) => { const px = (bx + u) * BX - shift, pz = (bz + v) * BZ; return [c * px + s * pz, -s * px + c * pz]; };
  const key = `${bx},${bz},${part},${k}`;
  return { id, key, crop: cropOf(id), corners: [toWorld(x0, z0), toWorld(x1, z0), toWorld(x1, z1), toWorld(x0, z1)], size: [(x1 - x0) * BX, (z1 - z0) * BZ], toWorld, rect: [x0, x1, z0, z1], long: (x1 - x0) * BX > (z1 - z0) * BZ ? 'x' : 'z' };
}

export const LAYOUT_GLSL = `
uint cfH(uint x){ x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
float cfU(uint h){ return float(h & 0xffffu) / 65535.0; }
struct CfField { uint id; float edge; float row; float along; float track; vec2 size; };
CfField cfField(vec2 p){
  float c = cos(${ROT}), s = sin(${ROT});
  vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  float bz = floor(q.y / ${BZ.toFixed(1)}); uint hz = cfH(uint(int(bz) + 32768));
  float sx = q.x + cfU(hz) * ${BX.toFixed(1)}, bx = floor(sx / ${BX.toFixed(1)});
  float lx = sx / ${BX.toFixed(1)} - bx, lz = q.y / ${BZ.toFixed(1)} - bz;
  uint hb = uint(int(bx) + 32768); uint h = cfH(hb ^ hz); uint hx = cfH(hb ^ 0x5bd1e995u);
  bool ax = (h & 1u) == 1u; float t = 0.3 + 0.4 * cfU(h >> 16u);
  float along = ax ? lz : lx, across = ax ? lx : lz;
  uint part = along < t ? 0u : 1u; float a0 = part == 1u ? t : 0.0, a1 = part == 1u ? 1.0 : t;
  uint h2 = cfH(h + part + 1u); float n = float(1u + h2 % 3u);
  float k = min(floor(across * n), n - 1.0);
  vec4 r = ax ? vec4(k / n, (k + 1.0) / n, a0, a1) : vec4(a0, a1, k / n, (k + 1.0) / n);
  CfField f; f.id = cfH(h2 + uint(k) + 101u);
  f.size = vec2((r.y - r.x) * ${BX.toFixed(1)}, (r.w - r.z) * ${BZ.toFixed(1)});
  f.edge = min(min(lx - r.x, r.y - lx) * ${BX.toFixed(1)}, min(lz - r.z, r.w - lz) * ${BZ.toFixed(1)});
  f.row = f.size.x > f.size.y ? lz * ${BZ.toFixed(1)} : lx * ${BX.toFixed(1)};
  f.along = f.size.x > f.size.y ? lx * ${BX.toFixed(1)} : lz * ${BZ.toFixed(1)};
  float tz = ((hz >> 20u) & 7u) < 3u ? 1.0 - smoothstep(0.3, 0.38, lz * ${BZ.toFixed(1)}) : 0.0;
  float tx = ((hx >> 20u) & 7u) == 0u ? 1.0 - smoothstep(0.26, 0.34, lx * ${BX.toFixed(1)}) : 0.0;
  f.track = max(tz, tx);
  return f;
}
`;
// JS mirror of the track test (placements keep clear of tracks).
export function onTrack(x, z, margin = .45) {
  const c = Math.cos(ROT), s = Math.sin(ROT), qx = c * x - s * z, qz = s * x + c * z;
  const bz = Math.floor(qz / BZ), hz = H(bz + 32768), sx = qx + U(hz) * BX, bx = Math.floor(sx / BX);
  const lz = (qz / BZ - bz) * BZ, lx = (sx / BX - bx) * BX;
  return (((hz >>> 20) & 7) < 3 && lz < margin) || (((H((bx + 32768) ^ 0x5bd1e995) >>> 20) & 7) === 0 && lx < margin);
}

// Every field touched by a sample grid around the colony (deduplicated), with its centre.
export function fieldsAround(radius, step = .8) {
  const found = new Map();
  for (let x = -radius; x <= radius; x += step) for (let z = -radius; z <= radius; z += step) {
    if (x * x + z * z > radius * radius) continue;
    const field = fieldAt(x, z); if (found.has(field.key)) continue;
    const [cx, cz] = field.toWorld((field.rect[0] + field.rect[1]) / 2, (field.rect[2] + field.rect[3]) / 2);
    found.set(field.key, { ...field, center: [cx, cz] });
  }
  return [...found.values()];
}

// Keep-out: the colony (boundary grown by `margin`) and the Shamli Road corridor.
// Half-planes of a convex polygon, each as [nx, nz, offset]: inside when nx*x + nz*z < offset.
export function colonyHalfPlanes(points, margin) {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length, cz = points.reduce((s, p) => s + p[1], 0) / points.length;
  return points.map((a, i) => {
    const b = points[(i + 1) % points.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len;
    if (nx * (cx - a[0]) + nz * (cz - a[1]) > 0) { nx = -nx; nz = -nz; }
    return [nx, nz, nx * a[0] + nz * a[1] + margin];
  });
}
// Sutherland–Hodgman: keep the part of convex `poly` where nx*x + nz*z <= offset (sign = 1) or >= (sign = -1).
export function clip(poly, [nx, nz, offset], sign = 1) {
  const out = [], side = ([x, z]) => sign * (offset - (nx * x + nz * z));
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) { const t = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  });
  return out;
}
// Convex pieces of `poly` lying outside the colony half-planes and off the road corridor.
export function outsidePieces(poly, planes, corridor = [12.2, 14.1]) {
  const pieces = [];
  planes.forEach((plane, i) => {
    let piece = clip(poly, plane, -1);
    for (let j = 0; j < i && piece.length > 2; j += 1) piece = clip(piece, planes[j], 1);
    if (piece.length > 2) pieces.push(piece);
  });
  return pieces.flatMap(piece => [clip(piece, [0, 1, corridor[0]], 1), clip(piece, [0, 1, corridor[1]], -1)]).filter(piece => piece.length > 2);
}
