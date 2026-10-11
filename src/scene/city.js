// Shamli town on the eastern / north-eastern horizon: rows of 1–4 storey
// flat-roof houses (whitewash, pastels, bare brick, grey concrete) with
// rooftop water tanks and stair rooms, street trees, fake sun shadows (the
// real shadow map only covers the colony), landmarks and the road sign.
import { planTown } from './city-blocks.js';
import { buildingMaterial } from './city-material.js';
import { buildLandmarks, CLEAR } from './city-landmarks.js';
import { buildSign } from './city-sign.js';
import { SUN_DIRECTION } from './sky.js';

// Whitewash and limewash dominate; faded pastels, raw grey concrete, a little bare brick.
const WALLS = [['#e4dfd3', 7], ['#d6cfbf', 5], ['#e0d0ab', 3], ['#dcb9ab', 1.6], ['#dfca8f', 1.6], ['#b5c6cc', 1], ['#bdcab0', .7], ['#aaa69c', 3.5], ['#8f8b84', 1.5], ['#cdb49a', 1.2]];
const BRICK = ['#a5654c', '#9a5c45', '#ad7158'];
const TOTAL = WALLS.reduce((s, [, w]) => s + w, 0);

export default function build(ctx) {
  const { THREE, scene, kit, quality } = ctx;
  const random = kit.rng(4242), colour = new THREE.Color(), dummy = new THREE.Object3D();
  const group = new THREE.Group(); group.name = 'city'; scene.add(group);
  const { houses, trees } = planTown(random, quality?.density ?? 1, 30, CLEAR);
  const landmarks = buildLandmarks(THREE);
  const wallColour = () => { let t = random() * TOTAL; for (const [hex, w] of WALLS) { t -= w; if (t <= 0) return hex; } return WALLS[0][0]; };

  // Buildings + rooftop clutter + shadow decals, all from the same plan.
  const blocks = [], roof = [], shade = [];
  const sun = new THREE.Vector3(...SUN_DIRECTION).normalize(), sx = -sun.x / sun.y, sz = -sun.z / sun.y; // shadow offset per unit height
  houses.forEach((house) => {
    const { x, z, yaw, w, d, n, st, style } = house, h = n * st + .07, far = Math.hypot(x, z);
    const hex = style === 2 ? BRICK[Math.floor(random() * 3)] : wallColour();
    blocks.push([[w, h, d], [x, h / 2, z], yaw, colour.set(hex).multiplyScalar(.85 + random() * .2).getHex(), [st, style, random()]]);
    const c = Math.cos(yaw), s = Math.sin(yaw), place = (ox, oz) => [x + ox * c + oz * s, z - ox * s + oz * c];
    // Shadow: footprint ∪ footprint shifted along the sun, as one soft rectangle in the house frame.
    const lx = (sx * c - sz * s) * h, lz = (sx * s + sz * c) * h, [cx, cz] = place(lx / 2, lz / 2);
    if (far < 115) shade.push([[w + Math.abs(lx) + .06, 1, d + Math.abs(lz) + .06], [cx, .006 + far * .0002, cz], yaw]); // grazing view beyond: unseen
    if (far > 85) return; // a 1 m tank is sub-pixel beyond this
    const corner = () => [(random() < .5 ? -1 : 1) * (w / 2 - .07), (random() < .5 ? -1 : 1) * (d / 2 - .07)];
    if (n > 1 && random() < .4) {
      const [ox, oz] = corner(), [px, pz] = place(ox, oz), mh = .19;
      roof.push([[.16, mh, .17], [px, h + mh / 2 - .03, pz], yaw, colour.set(hex).multiplyScalar(.9).getHex()]);
      if (random() < .55) roof.push([[.08, .09, .08], [px, h + mh + .015, pz], yaw, 0x1b1c1e]);
    }
    if (random() < .65) { const [px, pz] = place(...corner()); roof.push([[.085, .09, .085], [px, h + .03, pz], yaw + random(), random() < .85 ? 0x1b1c1e : 0xd8d4c8]); }
    if (style !== 2 && random() < .1) { // unfinished brick storey on top
      const bw = w * (.5 + random() * .4), bd = d * (.5 + random() * .4), bh = .08 + random() * .16, [px, pz] = place((w - bw) / 2 * (random() - .5), (d - bd) / 2 * (random() - .5));
      blocks.push([[bw, bh, bd], [px, h + bh / 2 - .02, pz], yaw, colour.set(BRICK[Math.floor(random() * 3)]).getHex(), [st, 2, random()]]);
    }
  });

  landmarks.shadows.forEach(([x, z, w, d, h, kind]) => {
    const y = .008 + Math.hypot(x, z) * .0002, lx = sx * h, lz = sz * h;
    if (kind === 'pole') shade.push([[Math.hypot(lx, lz), 1, w], [x + lx / 2, y, z + lz / 2], Math.atan2(-lz, lx)]); // thin strip along the sun
    else if (kind === 'lifted') shade.push([[w, 1, d], [x + lx, y, z + lz], 0]); // raised tank: only its own shadow
    else shade.push([[w + lx + .1, 1, d + lz + .1], [x + lx / 2, y, z + lz / 2], 0]);
  });
  kit.mesh(kit.geometry(landmarks.geometry), kit.material('#ffffff', { vertexColors: true, roughness: .8 }), group, { cast: false, receive: false });

  // One draw call each. Bottom faces dropped (never seen).
  const box = kit.geometry(new THREE.BoxGeometry(1, 1, 1)); box.setIndex(Array.from(box.index.array).filter((_, i) => Math.floor(i / 6) !== 3)); box.clearGroups();
  const instanced = (geometry, material, list, { info = false, cast = false } = {}) => {
    const mesh = kit.track(new THREE.InstancedMesh(geometry, material, Math.max(1, list.length))); mesh.count = list.length;
    const extra = info ? new Float32Array(list.length * 3) : null;
    list.forEach(([size, position, yaw, hex, data], i) => {
      dummy.scale.set(...size); dummy.position.set(...position); dummy.rotation.set(0, yaw, 0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      if (hex !== undefined) mesh.setColorAt(i, colour.setHex(hex));
      if (extra) extra.set(data, i * 3);
    });
    if (extra) geometry.setAttribute('aInfo', new THREE.InstancedBufferAttribute(extra, 3));
    mesh.castShadow = cast; mesh.receiveShadow = false; group.add(mesh); return mesh;
  };
  instanced(kit.geometry(box.clone()), buildingMaterial(kit), blocks, { info: true });
  instanced(box, kit.material('#ffffff', { roughness: .75 }), roof);
  const plane = kit.geometry(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  // Multiplied onto the ground (dst × tint), fading to 1 in the haze; overlaps simply darken a bit more.
  const shadowMaterial = kit.track(new THREE.MeshBasicMaterial({ color: '#a3adbf', transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor }));
  shadowMaterial.onBeforeCompile = (shader) => { // soft edges from the quad's own position
    shader.vertexShader = `varying vec2 ctQ;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nctQ = position.xz + 0.5;');
    shader.fragmentShader = `varying vec2 ctQ;\n${shader.fragmentShader}`
      .replace('#include <opaque_fragment>', 'vec2 ctE = clamp(min(ctQ, 1.0 - ctQ) / 0.2, 0.0, 1.0);\ngl_FragColor = vec4(mix(vec3(1.0), outgoingLight, ctE.x * ctE.y), 1.0);')
      .replace('#include <fog_fragment>', '#ifdef USE_FOG\ngl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth));\n#endif');
  };
  instanced(plane, shadowMaterial, shade).renderOrder = 1;

  // Street and courtyard trees: one lumpy canopy on a short trunk.
  const crown = new THREE.IcosahedronGeometry(1, 0).scale(.5, .36, .5).translate(0, .62, 0), stem = new THREE.CylinderGeometry(.04, .06, .3, 3, 1, true).translate(0, .15, 0);
  const treeGeometry = kit.geometry(new THREE.BufferGeometry()), pos = [], nor = [], col = [];
  [crown, stem.toNonIndexed()].forEach((g, k) => { const p = g.getAttribute('position'); for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = k ? .35 : .55 + .45 * (y - .26) / .72, n = k ? [x, 0, z] : [x / .5, (y - .62) / .36, z / .5], l = Math.hypot(...n) || 1;
    pos.push(x, y, z); nor.push(n[0] / l, n[1] / l, n[2] / l); col.push(t, k ? t * .8 : t, k ? t * .6 : t); } g.dispose(); });
  stem.dispose();
  treeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); treeGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); treeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const treeList = trees.map(({ x, z, s }) => [[s * (.9 + random() * .3), s * (.85 + random() * .3), s * (.9 + random() * .3)], [x, -.004, z], random() * 6.28, colour.setHSL(.2 + random() * .08, .35 + random() * .2, .18 + random() * .08).getHex()]);
  instanced(treeGeometry, kit.material('#ffffff', { vertexColors: true, roughness: .9 }), treeList);

  buildSign(ctx, group);

  // Dev-only cost report: open the page with ?cstats.
  if (import.meta.env?.DEV && /[?&]cstats/.test(window.location.search)) {
    let triangles = 0, calls = 0;
    group.traverse((o) => { if (!o.isMesh) return; const g = o.geometry; triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3 * (o.isInstancedMesh ? o.count : 1); calls += 1; });
    console.warn('[city] stats', JSON.stringify({ triangles: Math.round(triangles), calls, houses: houses.length, blocks: blocks.length, roof: roof.length, shade: shade.length, trees: trees.length }));
  }
  return { dispose() { scene.remove(group); } };
}
