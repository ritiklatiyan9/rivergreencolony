// Sugarcane as real volumes on the cane fields near the colony: a leafy
// alpha-tested wall around each block, a shaded top with row lines, and
// instanced leaf tufts that break the top into an uneven, fluffy silhouette.
import { unit } from './countryside-layout.js';
import { townDensity } from './city-layout.js';
import { patchMaterial } from './countryside-fields.js';
import { leafTexture, tuftTexture, caneTopTexture, CANE_TILE } from './countryside-textures.js';
import { ROT } from './countryside-layout.js';

const TOP = `
  vec2 p = cfWorld.xz;
  float lum = dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1));
  diffuseColor.rgb *= (0.85 + 0.3 * rgFbm(p * 0.9)) * mix(vec3(1.0), vec3(1.08, 1.05, 0.8), smoothstep(0.5, 0.8, rgFbm(p * 0.5 + 7.0)));
  float cfHeight = lum * 0.06;
`;

export default function buildCane(ctx, fields, planes, outsidePieces) {
  const { THREE, kit, scene, quality } = ctx;
  const random = kit.rng(5150);
  const top = [], topUV = [], side = [], tufts = [];
  let area = 0;
  fields.filter(field => field.crop === 'cane' && Math.hypot(...field.center) < 40 && ![field.center, ...field.corners].some(p => townDensity(...p) > .04)).forEach((field) => {
    const young = unit(field.id >>> 20) < .2, height = young ? .08 + unit(field.id >>> 7) * .06 : .25 + unit(field.id >>> 7) * .1;
    // Inset the field from its bunds.
    const [x0, x1, z0, z1] = field.rect, iu = .07 / field.size[0] * (x1 - x0), iv = .07 / field.size[1] * (z1 - z0);
    const rect = [[x0 + iu, z0 + iv], [x1 - iu, z0 + iv], [x1 - iu, z1 - iv], [x0 + iu, z1 - iv]].map(([u, v]) => field.toWorld(u, v));
    outsidePieces(rect, planes).forEach((piece) => {
      const cx = piece.reduce((s, p) => s + p[0], 0) / piece.length, cz = piece.reduce((s, p) => s + p[1], 0) / piece.length;
      for (let i = 1; i < piece.length - 1; i += 1) for (const q of [piece[0], piece[i + 1], piece[i]]) {
        // Canopy texture runs along the field's rows (its long side).
        const u = (Math.cos(ROT) * q[0] - Math.sin(ROT) * q[1]) / CANE_TILE, v = (Math.sin(ROT) * q[0] + Math.cos(ROT) * q[1]) / CANE_TILE;
        top.push(q[0], height, q[1]); topUV.push(...(field.long === 'x' ? [u, v] : [v, u]));
      }
      let run = random() * 4;
      piece.forEach((a, i) => {
        const b = piece[(i + 1) % piece.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < .01) return;
        let nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len; if (nx * (cx - a[0]) + nz * (cz - a[1]) > 0) { nx = -nx; nz = -nz; }
        const h = height / .67, u0 = run, u1 = run + len / (young ? .35 : .6); run = u1;
        side.push([a, b, h, u0, u1, nx, nz]);
      });
      // Leaf tufts scattered over the top (fewer on young cane).
      const pieceArea = Math.abs(piece.reduce((s, p, i) => { const q = piece[(i + 1) % piece.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
      area += pieceArea;
      const count = Math.round(pieceArea * (young ? 6 : 16) * quality.density);
      for (let t = 0; t < count; t += 1) {
        // Uniform point in a convex polygon: random triangle of the fan weighted roughly by chance.
        const k = 1 + Math.floor(random() * (piece.length - 2)); let r1 = random(), r2 = random(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
        const x = piece[0][0] + (piece[k][0] - piece[0][0]) * r1 + (piece[k + 1][0] - piece[0][0]) * r2, z = piece[0][1] + (piece[k][1] - piece[0][1]) * r1 + (piece[k + 1][1] - piece[0][1]) * r2;
        tufts.push([x, height - .05, z, (young ? .08 : .16) + random() * .12, random() * Math.PI]);
      }
    });
  });

  // Top surface.
  const topGeometry = kit.geometry(new THREE.BufferGeometry());
  topGeometry.setAttribute('position', new THREE.Float32BufferAttribute(top, 3)); topGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(topUV, 2)); topGeometry.computeVertexNormals();
  const topMaterial = kit.material('#ffffff', { map: caneTopTexture(kit), roughness: .9 });
  patchMaterial(topMaterial, TOP);
  kit.mesh(topGeometry, topMaterial, scene);

  // Leafy walls.
  const positions = [], normals = [], uvs = [];
  side.forEach(([a, b, h, u0, u1, nx, nz]) => {
    positions.push(a[0], 0, a[1], b[0], 0, b[1], b[0], h, b[1], a[0], 0, a[1], b[0], h, b[1], a[0], h, a[1]);
    for (let i = 0; i < 6; i += 1) normals.push(nx * .8, .6, nz * .8);
    uvs.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
  });
  const sideGeometry = kit.geometry(new THREE.BufferGeometry());
  sideGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); sideGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); sideGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const leaves = leafTexture(kit);
  const sideMaterial = upright(kit.material('#ffffff', { map: leaves, alphaTest: .45, side: THREE.DoubleSide, roughness: .85 }));
  const walls = kit.mesh(sideGeometry, sideMaterial, scene);
  walls.customDepthMaterial = kit.track(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leaves, alphaTest: .45 }));

  // Instanced leaf tufts (two crossed cards each).
  const card = new THREE.PlaneGeometry(1, 1); card.translate(0, .5, 0);
  const cross = card.clone().rotateY(Math.PI / 2);
  const cardGeometry = kit.geometry(new THREE.BufferGeometry());
  ['position', 'normal', 'uv'].forEach(name => { const a = card.getAttribute(name), b = cross.getAttribute(name); cardGeometry.setAttribute(name, new THREE.Float32BufferAttribute([...a.array, ...b.array], a.itemSize)); });
  cardGeometry.setIndex([...card.index.array, ...cross.index.array.map(i => i + 4)]); card.dispose(); cross.dispose();
  // Point card normals up so tufts light like the canopy top, not like walls.
  const n = cardGeometry.getAttribute('normal'); for (let i = 0; i < n.count; i += 1) n.setXYZ(i, 0, 1, 0);
  const tuftMaterial = upright(kit.material('#ffffff', { map: tuftTexture(kit), alphaTest: .5, side: THREE.DoubleSide, roughness: .8 }));
  const instances = new THREE.InstancedMesh(cardGeometry, tuftMaterial, Math.max(tufts.length, 1)); instances.count = tufts.length;
  const dummy = new THREE.Object3D(), colour = new THREE.Color();
  tufts.forEach(([x, y, z, s, yaw], i) => {
    dummy.position.set(x, y, z); dummy.rotation.set((random() - .5) * .5, yaw, (random() - .5) * .5); dummy.scale.set(s * 1.3, s, s * 1.3); dummy.updateMatrix(); instances.setMatrixAt(i, dummy.matrix);
    instances.setColorAt(i, colour.setHSL(.18 + random() * .07, .5, .7 + random() * .2));
  });
  instances.castShadow = false; instances.receiveShadow = true; scene.add(instances);
  return { area, tufts: tufts.length };
}

// Double-sided foliage keeps its authored normal on back faces (no flip into darkness).
function upright(material) {
  material.onBeforeCompile = (shader) => { shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal); nonPerturbedNormal = normal;'); };
  return material;
}
