// Shamli landmarks, merged into one vertex-coloured mesh: the municipal
// overhead water tank on columns, lattice mobile towers, a temple shikhara
// with a saffron flag and a white mosque with minarets.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MIRROR_X } from './city-layout.js';

// [x, z] sites; planTown keeps houses off them (radius = last value).
const AUTHORED = { tanks: [[30, -55, 1], [72, -27, 1]], temple: [38, -78, 1.2], mosque: [24, -88, 1.3], mill: [9, -117, 2.6], towers: [[44, -32, .45], [64, -96, .45], [97, -21, .45], [31, -128, .45], [86, -62, .45]] };
// Mirrored with the town (city-layout.js MIRROR_X): world x = MIRROR_X - authored x.
const west = ([x, ...rest]) => [MIRROR_X - x, ...rest];
export const SITES = { tanks: AUTHORED.tanks.map(west), temple: west(AUTHORED.temple), mosque: west(AUTHORED.mosque), mill: west(AUTHORED.mill), towers: AUTHORED.towers.map(west) };
export const CLEAR = [...SITES.tanks, SITES.temple, SITES.mosque, SITES.mill, ...SITES.towers];

export function buildLandmarks(THREE) {
  const parts = [], up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const add = (geometry, hex, x = 0, y = 0, z = 0, ry = 0) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry; g.deleteAttribute('uv'); g.rotateY(ry); g.translate(x, y, z);
    const c = new THREE.Color(hex), n = g.getAttribute('position').count, rgb = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) rgb.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3)); parts.push(g);
  };
  const beam = (a, b, t, hex) => { // thin box from a to b
    const d = new THREE.Vector3().subVectors(b, a), g = new THREE.BoxGeometry(t, d.length(), t);
    g.applyMatrix4(m.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(.5), q.setFromUnitVectors(up, d.normalize()), new THREE.Vector3(1, 1, 1))); add(g, hex);
  };
  const shadows = [];

  // Intze overhead tank: eight columns, two bracing rings, conical bottom, drum and shallow dome.
  for (const [x, z] of SITES.tanks) { const col = '#bdb6a8';
    for (let i = 0; i < 8; i += 1) { const a = i / 8 * Math.PI * 2; add(new THREE.BoxGeometry(.055, 1.55, .055), col, x + Math.cos(a) * .3, .775, z + Math.sin(a) * .3, -a); }
    for (const y of [.55, 1.05]) add(new THREE.TorusGeometry(.3, .022, 3, 8).rotateX(Math.PI / 2), col, x, y, z);
    add(new THREE.CylinderGeometry(.47, .3, .22, 16), '#c9c2b3', x, 1.66, z);
    add(new THREE.CylinderGeometry(.48, .48, .34, 16), '#dcd6c8', x, 1.94, z);
    add(new THREE.SphereGeometry(.48, 16, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .3, 1), '#cfc8ba', x, 2.11, z);
    shadows.push([x, z, .95, .95, 1.95, 'lifted'], [x, z, .1, 0, 1.6, 'pole']); }

  // Mobile towers: tapered four-leg lattice, red/white aviation bands up top, panel antennas and dishes.
  SITES.towers.forEach(([x, z], k) => {
    const H = 3 + k * .3, seg = Math.round(H / .42), corner = (i, y) => { const s = .22 - .15 * y / H, a = i * Math.PI / 2 + Math.PI / 4; return new THREE.Vector3(x + Math.cos(a) * s * 1.41, y, z + Math.sin(a) * s * 1.41); };
    for (let s = 0; s < seg; s += 1) {
      const y0 = s * H / seg, y1 = (s + 1) * H / seg, hex = s >= seg / 2 ? (s % 2 ? '#e9e6e0' : '#b5483b') : '#8e9398';
      for (let i = 0; i < 4; i += 1) { beam(corner(i, y0), corner(i, y1), .03, hex); beam(corner(i, y0), corner((i + 1) % 4, y1), .012, hex); beam(corner((i + 1) % 4, y0), corner(i, y1), .012, hex); }
    }
    for (let i = 0; i < 3; i += 1) { const a = i * Math.PI * 2 / 3; add(new THREE.BoxGeometry(.05, .3, .11), '#e4e2dc', x + Math.cos(a) * .12, H - .1, z + Math.sin(a) * .12, -a); }
    for (const [a, y] of [[.6, H - .55], [2.6, H - .75]]) add(new THREE.CylinderGeometry(.07, .07, .035, 10).rotateZ(Math.PI / 2), '#dedbd3', x + Math.cos(a) * .13, y, z + Math.sin(a) * .13, -a);
    beam(new THREE.Vector3(x, H, z), new THREE.Vector3(x, H + .35, z), .012, '#8e9398');
  });

  // Temple: plinth, sanctum and porch, curvilinear shikhara, amalaka, kalash and a saffron flag.
  { const [x, z] = SITES.temple, cream = '#ece0c6';
    add(new THREE.BoxGeometry(1.15, .12, 1.25), '#cdbb99', x, .06, z);
    add(new THREE.BoxGeometry(.58, .32, .58), cream, x, .28, z - .2);
    add(new THREE.BoxGeometry(.6, .26, .5), '#e4d3b2', x, .25, z + .32);
    add(new THREE.ConeGeometry(.44, .26, 4).rotateY(Math.PI / 4), '#e09a52', x, .51, z + .32);
    const profile = []; for (let i = 0; i <= 10; i += 1) { const t = i / 10; profile.push(new THREE.Vector2(.33 * Math.pow(1 - t, .55) * (1 + .06 * Math.sin(t * 31)) + .045, t * 1.1)); }
    add(new THREE.LatheGeometry(profile, 8).rotateY(Math.PI / 8), cream, x, .44, z - .2);
    add(new THREE.CylinderGeometry(.11, .11, .05, 12), '#e7d6b4', x, 1.57, z - .2);
    add(new THREE.ConeGeometry(.035, .13, 6), '#d5a43a', x, 1.66, z - .2);
    beam(new THREE.Vector3(x, 1.6, z - .2), new THREE.Vector3(x, 2.05, z - .2), .012, '#6b5a45');
    const [f0, f1, f2] = [[0, 0, 0], [.3, -.07, 0], [0, -.15, 0]].map(p => new THREE.Vector3(...p));
    for (const tri of [[f0, f1, f2], [f0, f2, f1]]) { const flag = new THREE.BufferGeometry().setFromPoints(tri); flag.computeVertexNormals(); add(flag, '#f08a1c', x, 2.04, z - .2, .5); } // both faces
    shadows.push([x, z - .2, .6, .6, 1.6], [x, z, 1.15, 1.25, .12]); }

  // Mosque: white prayer hall, drum and dome, two minarets with balconies and cupolas.
  { const [x, z] = SITES.mosque, white = '#efede6';
    add(new THREE.BoxGeometry(1.35, .44, .85), white, x, .22, z);
    add(new THREE.CylinderGeometry(.3, .3, .12, 16), white, x, .5, z);
    add(new THREE.SphereGeometry(.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.2, 1), '#f4f2ec', x, .56, z);
    add(new THREE.ConeGeometry(.025, .16, 6), '#3d8a5a', x, 1.0, z);
    for (const s of [-1, 1]) {
      add(new THREE.CylinderGeometry(.05, .065, 1.55, 8), white, x + s * .6, .775, z + .45);
      add(new THREE.CylinderGeometry(.095, .08, .05, 8), '#dedbd2', x + s * .6, 1.15, z + .45);
      add(new THREE.SphereGeometry(.075, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#f4f2ec', x + s * .6, 1.55, z + .45);
    }
    shadows.push([x, z, 1.35, .85, .44], [x, z, .64, .64, .95], [x - .6, z + .45, .1, 0, 1.6, 'pole'], [x + .6, z + .45, .1, 0, 1.6, 'pole']); }

  // Sugar mill on the town edge: long crushing sheds, a tall brick chimney, molasses tanks and a bagasse heap.
  { const [x, z] = SITES.mill;
    for (const [dx, dz, w, h, d, hex] of [[0, 0, 2.6, .75, 1.1, '#b9b4aa'], [.2, 1.25, 1.8, .55, .9, '#c8c1b2'], [-1.5, .3, .7, 1.1, .7, '#a9a397']]) {
      add(new THREE.BoxGeometry(w, h, d), hex, x + dx, h / 2, z + dz); add(new THREE.BoxGeometry(w + .04, .05, d + .04), '#7d8288', x + dx, h + .02, z + dz);
      shadows.push([x + dx, z + dz, w, d, h]);
    }
    add(new THREE.CylinderGeometry(.11, .19, 4.2, 12), '#a3573f', x + 1.6, 2.1, z - .6); add(new THREE.CylinderGeometry(.115, .115, .25, 12), '#3b3633', x + 1.6, 4.1, z - .6);
    for (const dx of [-.4, .1]) add(new THREE.CylinderGeometry(.22, .22, .4, 12), '#6e5a4a', x + dx, .2, z - 1.05);
    add(new THREE.SphereGeometry(.9, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.4, .45, 1), '#cbb98a', x - .4, 0, z + 2.3);
    shadows.push([x + 1.6, z - .6, .3, 0, 4.2, 'pole']); }

  const geometry = mergeGeometries(parts); parts.forEach(g => g.dispose());
  return { geometry, shadows };
}
