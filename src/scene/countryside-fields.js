// Farmland ground to the horizon: one world-space procedural shader paints the
// field patchwork (crop colours, row striping, raised bunds, dirt tracks), the
// grass verge outside the wall, Shamli Road and the entrance approach.
// Detail fades with screen-space derivatives so nothing tiles or aliases.
import { GLSL_NOISE } from './kit.js';
import { LAYOUT_GLSL, ROAD, APPROACH, ROT, BX, BZ } from './countryside-layout.js';
import { CITY_GLSL } from './city-layout.js';

export const CF_HELPERS = `
uniform vec2 cfB[4]; varying vec3 cfWorld;
vec3 cfC(vec3 s){ return pow(s, vec3(2.2)); }
float cfFade(float x, float period){ return clamp(1.6 - fwidth(x) / period * 4.0, 0.0, 1.0); }
float cfDistB(vec2 p){ float d = 1e9; for (int i = 0; i < 4; i++){ vec2 a = cfB[i], b = cfB[(i + 1) % 4], pa = p - a, ba = b - a; d = min(d, length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0))); } return d; }
vec3 cfPerturb(vec3 pos, vec3 n, float hgt){
  vec3 sx = dFdx(pos), sy = dFdy(pos), r1 = cross(sy, n), r2 = cross(n, sx); float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(hgt) * r1 + dFdy(hgt) * r2); return normalize(abs(det) * n - grad);
}`;

const SURFACE = `
  vec2 p = cfWorld.xz; CfField f = cfField(p);
  float ty = cfU(f.id >> 4u), v = cfU(f.id >> 12u), w = cfU(f.id >> 9u);
  vec3 col; float period = 0.0;
  if (ty < 0.34) { col = mix(cfC(vec3(.50,.64,.30)), cfC(vec3(.60,.70,.36)), v); period = 0.11; }
  else if (ty < 0.52) { col = mix(cfC(vec3(.55,.62,.32)), cfC(vec3(.66,.66,.40)), v); period = 0.035; }
  else if (ty < 0.68) { col = mix(cfC(vec3(.40,.55,.27)), cfC(vec3(.50,.62,.30)), v); period = 0.045; }
  else if (ty < 0.76) { col = mix(cfC(vec3(.53,.47,.37)), cfC(vec3(.62,.56,.45)), v); period = 0.06; }
  else { col = mix(cfC(vec3(.47,.54,.31)), cfC(vec3(.56,.59,.38)), v); }
  // Pull every crop toward a shared hazy green so the patchwork reads as one landscape.
  col = mix(col, cfC(vec3(.52,.61,.33)), 0.3);
  float big = rgFbm(p * 0.35 + w * 9.0), mid = rgFbm(p * 1.6), fine = mix(0.5, rgNoise(p * 14.0), cfFade(p.x * 14.0, 1.0));
  // Patchy growth inside each field: uneven stands, wetter and drier streaks.
  col *= 0.8 + 0.3 * big + 0.22 * (mid - 0.5) + 0.2 * (fine - 0.5);
  col = mix(col, col * vec3(1.08, 1.04, 0.86), smoothstep(0.55, 0.8, rgFbm(p * 0.9 + 4.0)) * 0.6);
  float hgt = (fine - 0.5) * 0.004;
  if (period > 0.0) {
    float wave = 0.5 + 0.5 * cos(f.row / period * 6.2832), amp = cfFade(f.row, period);
    col *= 1.0 - 0.2 * wave * amp; hgt += wave * amp * 0.006;
  }
  // Raised bunds: grassy earth ridges along every field edge.
  float bund = 1.0 - smoothstep(0.035, 0.075, f.edge);
  vec3 bundCol = mix(cfC(vec3(.55,.53,.36)), cfC(vec3(.42,.52,.25)), rgNoise(p * 6.0));
  col = mix(col, bundCol, bund); hgt += bund * 0.022;
  // Dirt farm tracks with darker tyre ruts.
  vec3 dirt = cfC(vec3(.70,.62,.47)) * (0.88 + 0.2 * rgNoise(p * 5.0));
  col = mix(col, dirt, f.track); hgt -= f.track * 0.01;
  // Shamli town (city-layout.js): dusty ground, paved lanes on the old bunds, asphalt on the block edges.
  float town = smoothstep(0.14, 0.34, ctDensity(p));
  if (town > 0.0) {
    vec2 q = vec2(cos(${ROT}) * p.x - sin(${ROT}) * p.y, sin(${ROT}) * p.x + cos(${ROT}) * p.y);
    float qb = floor(q.y / ${BZ.toFixed(1)}), lz = fract(q.y / ${BZ.toFixed(1)}), lx = fract((q.x + cfU(cfH(uint(int(qb) + 32768))) * ${BX.toFixed(1)}) / ${BX.toFixed(1)});
    float ctMain = min(min(lx, 1.0 - lx) * ${BX.toFixed(1)}, min(lz, 1.0 - lz) * ${BZ.toFixed(1)});
    vec3 dust = cfC(vec3(.58,.54,.47)) * (0.8 + 0.3 * big + 0.2 * (fine - 0.5));
    dust = mix(dust, cfC(vec3(.44,.47,.32)), smoothstep(0.6, 0.85, rgFbm(p * 0.7 + 9.0)) * 0.55);
    vec3 paved = cfC(vec3(.6,.59,.56)) * (0.88 + 0.2 * fine), tarmac = cfC(vec3(.32,.32,.33)) * (0.88 + 0.2 * mid);
    vec3 urban = mix(dust, paved, 1.0 - smoothstep(0.1, 0.13, f.edge));
    urban = mix(urban, paved * 0.92, 1.0 - smoothstep(0.26, 0.29, ctMain));
    urban = mix(urban, tarmac, 1.0 - smoothstep(0.18, 0.21, ctMain));
    col = mix(col, urban, town); hgt = mix(hgt, (fine - 0.5) * 0.002, town);
  }
  // Clear grass/dirt verge just outside the compound wall.
  float verge = 1.0 - smoothstep(0.5, 0.65, cfDistB(p));
  vec3 vergeCol = mix(cfC(vec3(.47,.58,.27)), cfC(vec3(.62,.57,.42)), smoothstep(0.45, 0.7, rgFbm(p * 1.7)));
  col = mix(col, vergeCol * (0.9 + 0.2 * fine), verge); hgt = mix(hgt, (fine - 0.5) * 0.003, verge);
  // Shamli Road: gravel shoulders, asphalt carriageway, edge lines and a dashed centre line.
  float rz = p.y, outer = step(${(ROAD.z0 - ROAD.shoulder).toFixed(3)}, rz) * step(rz, ${(ROAD.z1 + ROAD.shoulder).toFixed(3)});
  float lane = step(${ROAD.z0.toFixed(3)}, rz) * step(rz, ${ROAD.z1.toFixed(3)});
  vec3 gravel = cfC(vec3(.66,.61,.52)) * (0.85 + 0.25 * fine);
  vec3 tar = cfC(vec3(.25,.25,.26)) * (0.85 + 0.25 * rgFbm(p * 3.0) + 0.1 * (fine - 0.5));
  tar = mix(tar, cfC(vec3(.2,.2,.21)), smoothstep(0.1, 0.02, abs(abs(rz - ${((ROAD.z0 + ROAD.z1) / 2).toFixed(3)}) - 0.15)) * 0.4);
  float lines = smoothstep(0.012, 0.006, abs(rz - ${(ROAD.z0 + .03).toFixed(3)})) + smoothstep(0.012, 0.006, abs(rz - ${(ROAD.z1 - .03).toFixed(3)}));
  lines += smoothstep(0.01, 0.005, abs(rz - ${((ROAD.z0 + ROAD.z1) / 2).toFixed(3)})) * step(0.5, fract(p.x / 0.6));
  tar = mix(tar, cfC(vec3(.9,.9,.86)), clamp(lines, 0.0, 1.0) * 0.85);
  col = mix(col, gravel, outer); col = mix(col, tar, lane); hgt = mix(hgt, 0.0, outer);
  // Paved approach from the entrance to the road.
  float app = step(${APPROACH.x0.toFixed(3)}, p.x) * step(p.x, ${APPROACH.x1.toFixed(3)}) * step(${APPROACH.z0.toFixed(3)}, rz) * step(rz, ${ROAD.z0.toFixed(3)});
  vec3 concrete = cfC(vec3(.84,.83,.80)) * (0.92 + 0.12 * fine);
  col = mix(col, concrete, app); hgt = mix(hgt, 0.0, app);
  diffuseColor.rgb *= col;
  float cfHeight = hgt;
`;

export default function buildFields(ctx) {
  const { THREE, kit, plan, world, scene } = ctx;
  const shape = new THREE.Shape(); shape.absarc(0, 0, 900, 0, Math.PI * 2, false);
  shape.holes.push(new THREE.Path(kit.shapeFromPolygon(plan.boundary).getPoints()));
  const geometry = kit.geometry(new THREE.ShapeGeometry(shape, 96)); geometry.rotateX(-Math.PI / 2);
  const material = kit.material('#ffffff', { roughness: .97 });
  const boundary = plan.boundary.map(point => new THREE.Vector2(...world(point)));
  patchMaterial(material, SURFACE, { cfB: { value: boundary } });
  const ground = kit.mesh(geometry, material, scene, { cast: false, receive: true });
  ground.position.y = -.004;
  return ground;
}

// Patches a standard material: `surface` (GLSL, sees cfWorld) multiplies diffuseColor and sets cfHeight for bump shading.
export function patchMaterial(material, surface, uniforms = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying vec3 cfWorld;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 cfW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
      cfW = instanceMatrix * cfW;
      #endif
      cfWorld = (modelMatrix * cfW).xyz;`);
    shader.fragmentShader = `${GLSL_NOISE}\n${LAYOUT_GLSL}\n${CITY_GLSL}\n${CF_HELPERS}\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>\n${surface}`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = cfPerturb(-vViewPosition, normal, cfHeight);');
  };
  return material;
}
