// Shared helpers for the 3D colony modules. Every geometry, material and
// texture made through the kit is disposed with the scene.
import * as THREE from 'three';

export const SCALE = 0.02; // world units per plan unit
export const M = 1 / 12; // world units per metre (nominal: 1 world unit ≈ 12 m)

// Fixed surface heights (world units) shared by every module.
export const HEIGHTS = {
  ground: 0, // colony base and surrounding land
  forecourt: 0.016, // shop frontage paving
  road: 0.018, // carriageways and the roundabout
  garden: 0.024, // landscaped garden pockets and parks
  lawn: 0.032, // raised residential plot surface
  label: 0.036, // plot numbers above the surface
  shopRoof: 0.355, // flat roof of the shop rows
};

// Deterministic generator so the colony looks the same on every visit.
export const rng = (seed = 1) => { let s = seed % 2147483647 || 1; return () => { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; };

// Value noise and fBm for canvas textures (period-wrapped so tiles stay seamless).
export function makeNoise(seed = 7, period = 256) {
  const random = rng(seed), table = new Float32Array(period * period).map(() => random());
  const at = (x, y) => table[((y % period) + period) % period * period + ((x % period) + period) % period];
  const value = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, octaves = 4) => { let sum = 0, amp = .5, freq = 1, norm = 0; for (let o = 0; o < octaves; o += 1) { sum += value(x * freq, y * freq) * amp; norm += amp; amp *= .5; freq *= 2; } return sum / norm; };
  return { value, fbm };
}

// GLSL: hash, value noise and fBm in world space, for shader patches.
export const GLSL_NOISE = `
float rgHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float rgNoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(rgHash(i), rgHash(i + vec2(1.0, 0.0)), u.x), mix(rgHash(i + vec2(0.0, 1.0)), rgHash(i + vec2(1.0, 1.0)), u.x), u.y); }
float rgFbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * rgNoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.97; }
`;

export function createKit(renderer, plan) {
  const disposables = new Set();
  const track = (value) => { disposables.add(value); return value; };
  const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const world = ([x, y]) => [(x - plan.width / 2) * SCALE, (y - plan.height / 2) * SCALE];
  const geometry = track;
  const material = (color, options = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: .8, ...options }));
  const canvasTexture = (width, height, draw, { repeat, srgb = true, wrap = true, anisotropy = maxAnisotropy } = {}) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = track(new THREE.CanvasTexture(canvas));
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    if (wrap) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    if (repeat) texture.repeat.set(...[repeat].flat().concat(repeat).slice(0, 2));
    texture.anisotropy = anisotropy;
    return texture;
  };
  const mesh = (shape, finish, parent, { cast = true, receive = true } = {}) => {
    const value = new THREE.Mesh(shape, finish); value.castShadow = cast; value.receiveShadow = receive; parent?.add(value); return value;
  };
  const box = geometry(new THREE.BoxGeometry(1, 1, 1));
  const dummy = new THREE.Object3D();
  // transforms: [[sx, sy, sz], [x, y, z], yaw?]
  const boxes = (finish, transforms, parent, shape = box) => {
    const value = new THREE.InstancedMesh(shape, finish, Math.max(transforms.length, 1));
    value.count = transforms.length;
    transforms.forEach(([size, position, yaw = 0], index) => {
      dummy.scale.set(...size); dummy.position.set(...position); dummy.rotation.set(0, yaw, 0); dummy.updateMatrix(); value.setMatrixAt(index, dummy.matrix);
    });
    value.castShadow = true; value.receiveShadow = true; value.instanceMatrix.needsUpdate = true; parent?.add(value); return value;
  };
  const makeBox = (finish, size, position, parent) => { const value = mesh(box, finish, parent); value.scale.set(...size); value.position.set(...position); return value; };
  // Plan polygon -> THREE.Shape in the XZ plane (use with rotateX(-PI/2)).
  const shapeFromPolygon = (polygon) => {
    const shape = new THREE.Shape(); polygon.forEach((point, index) => { const [x, z] = world(point); if (index) shape.lineTo(x, -z); else shape.moveTo(x, -z); }); shape.closePath(); return shape;
  };
  const flatPolygon = (polygon, finish, height, parent) => {
    const shape = geometry(new THREE.ShapeGeometry(shapeFromPolygon(polygon))); shape.rotateX(-Math.PI / 2);
    const value = mesh(shape, finish, parent, { cast: false }); value.position.y = height; return value;
  };
  // Soft blobs drawn on every tiling neighbour so repeated textures stay seamless.
  const blobs = (ctx, size, count, colours, minRadius, maxRadius, random) => {
    for (let i = 0; i < count; i += 1) {
      const x = random() * size, y = random() * size, r = minRadius + random() * (maxRadius - minRadius), colour = colours[i % colours.length];
      for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); g.addColorStop(0, colour); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  };
  const speckle = (ctx, size, count, colours, random, w = 1, h = 1) => { for (let i = 0; i < count; i += 1) { ctx.fillStyle = colours[i % colours.length]; ctx.fillRect(random() * size, random() * size, w, h + random() * h); } };
  const dispose = () => { disposables.forEach((value) => value.dispose?.()); disposables.clear(); };
  return { THREE, track, geometry, material, canvasTexture, mesh, box, dummy, boxes, makeBox, shapeFromPolygon, flatPolygon, blobs, speckle, world, rng, makeNoise, maxAnisotropy, dispose };
}

// Procedural surfaces: patches a MeshStandardMaterial so a GLSL `surface`
// snippet sets diffuseColor from the world position (vWorld).
const SHADER_COMMON = `${GLSL_NOISE}
varying vec3 vWorld;
// Noise whose detail fades out before it can alias at a distance.
float rgFine(vec2 p){ vec2 w = fwidth(p); return mix(0.5, rgNoise(p), clamp(1.4 - max(w.x, w.y) * 1.6, 0.0, 1.0)); }
// Anti-aliased line mask: 1 on a line of half-width w around coordinate 0 of a period.
float rgLine(float x, float period, float w){ float d = abs(fract(x / period + 0.5) - 0.5) * period; float aa = fwidth(x) * 0.75; return (1.0 - smoothstep(w, w + aa, d)) * clamp(1.0 - fwidth(x) / (period * 0.35), 0.0, 1.0); }
float rgTri(float x){ return abs(fract(x) - 0.5) * 2.0; }
`;

// Patches a MeshStandardMaterial so `surface` (GLSL) sets diffuseColor.rgb and roughnessFactor from vWorld.
export function proceduralMaterial(kit, { uniforms = {}, attributes = '', varyings = '', vertex = '', surface, defines = {}, ...options }) {
  const material = kit.material('#ffffff', { roughness: 1, ...options });
  material.defines = { ...material.defines, ...defines };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying vec3 vWorld;\n${attributes}\n${varyings}\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 rgWorld = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
      rgWorld = instanceMatrix * rgWorld;
      #endif
      vWorld = (modelMatrix * rgWorld).xyz;
      ${vertex}`);
    shader.fragmentShader = `${SHADER_COMMON}\n${Object.keys(uniforms).map(name => `uniform ${uniforms[name].type} ${name};`).join('\n')}\n${varyings}\n${shader.fragmentShader}`
      .replace('#include <map_fragment>', `#include <map_fragment>\n{ ${surface} }`);
  };
  material.customProgramCacheKey = () => surface;
  return material;
}
export const uniform = (type, value) => ({ type, value });

// Green landscaping for parks, garden pockets and the fountain island.
export function lawnMaterial(kit) {
  // Lawn: sunny yellow-green with mown patches, drier tufts and fine blade detail.
  // Tuned to the reference photo's olive-tinged lawns (about sRGB 150,148,75 in sun).
  const lawnUniforms = { uLawnDark: uniform('vec3', new THREE.Color('#5e752d')), uLawnLight: uniform('vec3', new THREE.Color('#a1ab4e')), uLawnDry: uniform('vec3', new THREE.Color('#b2a95a')) };
  const lawnSurface = `
    vec2 p = vWorld.xz;
    float macro = rgFbm(p * 0.33), mid = rgFbm(p * 2.1 + 7.3);
    vec3 grass = mix(uLawnDark, uLawnLight, smoothstep(0.2, 0.8, macro * 0.5 + mid * 0.5));
    grass = mix(grass, uLawnDry, smoothstep(0.58, 0.8, rgFbm(p * 0.8 + 3.1)) * 0.5);
    float clumps = rgFine(p * 9.0) * 0.5 + rgFine(p * 19.0 + 4.0) * 0.5;
    float blades = rgFine(p * 52.0) * 0.5 + rgFine(p * vec2(150.0, 124.0)) * 0.5;
    grass *= (0.78 + 0.34 * clumps) * (0.84 + 0.3 * blades);
    diffuseColor.rgb = grass;`;
  return proceduralMaterial(kit, { uniforms: lawnUniforms, surface: lawnSurface });
}

// Undeveloped plots are compacted earth, separate from the landscaped parks.
// Broad dry patches and small grains stay in source world coordinates; no
// image download or large repeating texture is needed for the soil surface.
export function soilMaterial(kit) {
  return proceduralMaterial(kit, {
    uniforms: {
      uSoilDark: uniform('vec3', new THREE.Color('#94714d')),
      uSoilLight: uniform('vec3', new THREE.Color('#c5a277')),
      uSoilDry: uniform('vec3', new THREE.Color('#d7bb92')),
    },
    surface: `
      vec2 p = vWorld.xz;
      float broad = rgFbm(p * 0.47 + 5.0), compact = rgFbm(p * 2.8 + 14.0);
      vec3 earth = mix(uSoilDark, uSoilLight, smoothstep(0.18, 0.82, broad * 0.7 + compact * 0.3));
      float dry = smoothstep(0.52, 0.8, rgFbm(p * 0.9 + 22.0));
      earth = mix(earth, uSoilDry, dry * 0.42);
      earth *= 0.91 + 0.14 * rgFine(p * 68.0);
      float grains = smoothstep(0.82, 0.98, rgFine(p * 34.0 + 9.0));
      diffuseColor.rgb = mix(earth, uSoilDry * 0.92, grains * 0.28);`,
    roughness: .96,
  });
}
