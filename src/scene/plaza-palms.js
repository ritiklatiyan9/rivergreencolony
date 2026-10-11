import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Coconut palms: arching fronds of alpha-cut leaflets on ringed, tapered
// trunks, with a cluster of coconuts under each crown. Three InstancedMeshes
// for any number of palms; the crowns sway and flutter with the wind clock.
export function buildPalms(ctx, spots, parent) {
  const { THREE, kit, wind } = ctx;
  const random = kit.rng(6161);
  // Frond texture: a rachis with tapering leaflets swept toward the tip.
  const frondMap = kit.canvasTexture(128, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.lineCap = 'round';
    for (let y = h - 14; y > 8; y -= 5) {
      const t = 1 - y / h, reach = Math.sin(Math.min(1, t * 1.25) * Math.PI) * 0.92 * (w / 2) * (t > .9 ? (1 - t) * 10 : 1);
      for (const side of [-1, 1]) {
        const green = 70 + Math.round(random() * 50), tone = `rgb(${46 + green * .3 | 0},${green + 40},${28 + random() * 20 | 0})`;
        c.strokeStyle = tone; c.lineWidth = 2.6 - t * 1.2;
        c.beginPath(); c.moveTo(w / 2, y); c.quadraticCurveTo(w / 2 + side * reach * .55, y - 10, w / 2 + side * reach, y - 24 - random() * 8); c.stroke();
      }
    }
    c.strokeStyle = '#7d7a3e'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, h); c.lineTo(w / 2, 4); c.stroke();
  }, { wrap: false });
  const barkMap = kit.canvasTexture(64, 256, (c, w, h) => {
    c.fillStyle = '#8a7a63'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 7) { c.fillStyle = `rgba(52,42,30,${.35 + random() * .25})`; c.fillRect(0, y, w, 2); c.fillStyle = 'rgba(214,200,170,.25)'; c.fillRect(0, y + 2, w, 1); }
  });
  // One crown: 15 fronds on two tiers, each a V-folded ribbon that arches and droops.
  const positions = [], uvs = [], colours = [], indices = [];
  for (let f = 0; f < 15; f += 1) {
    const upper = f >= 10, angle = (f / (upper ? 5 : 10)) * Math.PI * 2 + (upper ? .3 : 0) + random() * .25;
    const length = upper ? .2 + random() * .04 : .3 + random() * .06, rise = upper ? .13 : .08, droop = upper ? .05 : .2, width = .07;
    const tint = new THREE.Color().setHSL(.2 + random() * .05, .45, upper ? .66 : .56 + random() * .08, THREE.SRGBColorSpace);
    const base = positions.length / 3, steps = 10;
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps, r = length * t, y = rise * Math.sin(t * Math.PI * .8) - droop * t * t, half = width * Math.pow(Math.sin(Math.min(t * 1.15, 1) * Math.PI * .5 + .1), .7) * (1 - t * .55);
      const cx = Math.cos(angle) * r, cz = Math.sin(angle) * r, px = -Math.sin(angle), pz = Math.cos(angle);
      [[-1, 0], [0, .5], [1, 1]].forEach(([side, u]) => {
        positions.push(cx + px * half * side, y + (side ? half * .35 : 0), cz + pz * half * side); uvs.push(u, t); colours.push(tint.r, tint.g, tint.b);
      });
      if (s < steps) { const a = base + s * 3; indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
    }
  }
  const crown = kit.geometry(new THREE.BufferGeometry());
  crown.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); crown.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  crown.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3)); crown.setIndex(indices); crown.computeVertexNormals();
  // Soften the shading: bend normals toward "up and out" like a canopy.
  const n = crown.getAttribute('normal'), p = crown.getAttribute('position');
  for (let i = 0; i < n.count; i += 1) { const v = new THREE.Vector3(p.getX(i), .25, p.getZ(i)).normalize(); n.setXYZ(i, v.x, Math.abs(v.y), v.z); }
  const crownMaterial = kit.material('#ffffff', { map: frondMap, vertexColors: true, alphaTest: .45, side: THREE.DoubleSide, roughness: .85 });
  crownMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 anchor = instanceMatrix[3].xyz; float reach = length(position.xz);
      float gust = sin(uTime * 1.2 + anchor.x * .5 + anchor.z * .3) * .6 + sin(uTime * 2.7 + anchor.z) * .3 + .4;
      transformed.x += gust * .03 * reach; transformed.z += gust * .012 * reach;
      transformed.y += sin(uTime * 4.0 + anchor.x * 3.0 + reach * 20.0) * .012 * reach * 3.0;`);
  };
  const depth = kit.track(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: frondMap, alphaTest: .45, side: THREE.DoubleSide }));
  const trunk = kit.geometry(new THREE.CylinderGeometry(.6, 1, 1, 9, 5, true)); trunk.translate(0, .5, 0);
  const trunks = new THREE.InstancedMesh(trunk, kit.material('#ffffff', { map: barkMap, roughness: .95 }), spots.length);
  const crowns = new THREE.InstancedMesh(crown, crownMaterial, spots.length); crowns.customDepthMaterial = depth;
  const dummy = new THREE.Object3D(), top = new THREE.Vector3();
  spots.forEach(({ x, z, y = 0, height, lean = 0, turn = 0, girth = .018 }, i) => {
    dummy.position.set(x, y, z); dummy.rotation.set(Math.sin(turn) * lean, 0, Math.cos(turn) * lean); dummy.scale.set(girth, height, girth); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    top.set(0, 1, 0).applyEuler(dummy.rotation).multiplyScalar(height).add(dummy.position);
    dummy.position.copy(top); dummy.rotation.set(0, turn * 3.1, 0); dummy.scale.setScalar(height / .7); dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
  });
  // Coconuts: a cluster of six nuts hanging just under each crown (crown space, so they ride with it).
  const nuts = [];
  for (let k = 0; k < 6; k += 1) {
    const a = k / 6 * Math.PI * 2 + random() * .4, nut = new THREE.IcosahedronGeometry(.0125, 1).translate(Math.cos(a) * .022, -.016 - (k % 2) * .01, Math.sin(a) * .022);
    const tint = new THREE.Color(k % 3 === 2 ? '#7a5a2e' : '#5f7d2a'), count = nut.getAttribute('position').count;
    nut.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: count * 3 }, (_, i) => [tint.r, tint.g, tint.b][i % 3]), 3)); nuts.push(nut);
  }
  const cluster = kit.geometry(mergeGeometries(nuts)); nuts.forEach(nut => nut.dispose());
  const coconuts = new THREE.InstancedMesh(cluster, kit.material('#ffffff', { vertexColors: true, roughness: .6 }), spots.length);
  for (let i = 0; i < spots.length; i += 1) { crowns.getMatrixAt(i, dummy.matrix); coconuts.setMatrixAt(i, dummy.matrix); }
  // The leaning crown is offset from its trunk's origin. Every part of a palm
  // must use the same ground anchor when placed on the satellite footprint.
  const anchors = new Float32Array(spots.flatMap(({ x, z }) => [x, z]));
  [trunks, crowns, coconuts].forEach(mesh => {
    mesh.userData.colonyMapFit = { mode: 'rigid', anchors };
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.instanceMatrix.needsUpdate = true; parent.add(mesh);
  });
  return { trunks, crowns };
}
