// Shared bits for the architecture modules: weathered materials and a
// per-material geometry batch that merges into one mesh (one draw call).
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLSL_NOISE } from './kit.js';

// World-space plaster weathering: fine mottling, faint vertical rain streaks
// and grime darkening near the ground. Works on plain and instanced meshes.
export function weather(material, { grime = .3, mottle = .08, streak = .06, key = 'plaster' } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRgWorld;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vec4 rgWorld = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        rgWorld = instanceMatrix * rgWorld;
      #endif
      vRgWorld = (modelMatrix * rgWorld).xyz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vRgWorld;\n${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 rgP = vRgWorld * 60.0;
      float rgM = rgFbm(rgP.xz + rgP.y * .7) - .5;
      float rgS = rgNoise(vec2(vRgWorld.x * 22.0 + vRgWorld.z * 17.0, vRgWorld.y * 2.5)) * smoothstep(.2, .9, rgNoise(vRgWorld.xz * 7.0 + vRgWorld.y));
      float rgG = 1.0 - smoothstep(.0, .07, vRgWorld.y) * .7 - smoothstep(.07, .3, vRgWorld.y) * .3;
      diffuseColor.rgb *= (1.0 + rgM * ${mottle.toFixed(3)}) * (1.0 - rgS * ${streak.toFixed(3)}) * (1.0 - rgG * ${grime.toFixed(3)});`);
  };
  material.customProgramCacheKey = () => `rg-arch-${key}-${grime}-${mottle}-${streak}`;
  return material;
}

export function createMaterials(kit) {
  return {
    plaster: weather(kit.material('#f1efe9', { roughness: .88 })),
    trim: weather(kit.material('#e4e0d6', { roughness: .8 }), { grime: .25, mottle: .06, streak: .03, key: 'trim' }),
    concrete: weather(kit.material('#bdb8ae', { roughness: .93 }), { grime: .2, mottle: .14, streak: .02, key: 'concrete' }),
    granite: kit.material('#3a3a3c', { roughness: .45 }),
    iron: kit.material('#1e1f22', { roughness: .5, metalness: .55 }),
    metal: kit.material('#b4b8bc', { roughness: .45, metalness: .3 }),
    glass: kit.material('#40576a', { roughness: .12, metalness: .25, envMapIntensity: 1.5 }),
    tank: kit.material('#25282a', { roughness: .6 }),
  };
}

// Collects transformed geometries per material; build() merges each list.
export function createBatch(THREE, kit, parent) {
  const lists = new Map(), dummy = new THREE.Object3D(), box = new THREE.BoxGeometry(1, 1, 1);
  let assetAnchor = null;
  // Keep each architectural assembly intact when the map fits site surfaces.
  // Store the owning assembly's pivot before primitives lose their identity in
  // the per-material merge. Ordinary site surfaces retain the default flag.
  const withAsset = (anchor, buildAsset) => {
    const previous = assetAnchor; assetAnchor = anchor;
    try { return buildAsset(); } finally { assetAnchor = previous; }
  };
  const add = (material, geometry, position = [0, 0, 0], yaw = 0, scale = [1, 1, 1]) => {
    dummy.position.set(...position); dummy.rotation.set(0, yaw, 0); dummy.scale.set(...scale); dummy.updateMatrix();
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    g.applyMatrix4(dummy.matrix);
    const count = g.getAttribute('position').count, anchors = new Float32Array(count * 2), rigid = new Float32Array(count);
    if (assetAnchor) {
      for (let i = 0; i < count; i += 1) { anchors[i * 2] = assetAnchor[0]; anchors[i * 2 + 1] = assetAnchor[1]; rigid[i] = 1; }
    }
    g.setAttribute('aColonyMapAnchor', new THREE.Float32BufferAttribute(anchors, 2));
    g.setAttribute('aColonyMapRigid', new THREE.Float32BufferAttribute(rigid, 1));
    if (!lists.has(material)) lists.set(material, []);
    lists.get(material).push(g);
  };
  // size [sx, sy, sz], position = centre, yaw about Y.
  const addBox = (material, size, position, yaw = 0) => add(material, box, position, yaw, size);
  const build = ({ cast = true, receive = true } = {}) => {
    const meshes = [];
    lists.forEach((geometries, material) => {
      const merged = kit.geometry(mergeGeometries(geometries)); geometries.forEach(g => g.dispose());
      meshes.push(kit.mesh(merged, material, parent, { cast: cast && !material.userData.noCast, receive }));
    });
    lists.clear(); box.dispose(); return meshes;
  };
  return { add, addBox, build, withAsset };
}
