// Town building facades from one instanced unit box: per-face window grids,
// floor slabs with chajja shade lines, shop shutters + signboards, exposed
// brick, parapet roofs and dark wall bases. Detail fades out with distance
// (fwidth) so the horizon never shimmers. aInfo: storey height, style, seed.
import { GLSL_NOISE } from './kit.js';

const VERTEX = `
  vec3 ctScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  ctLocal = (position + 0.5) * ctScale; ctSize = ctScale; ctN = normal; ctInfo = aInfo;`;

const FRAGMENT = `
  vec3 wall = diffuseColor.rgb; float seed = ctInfo.z, st = ctInfo.x, style = ctInfo.y;
  float grime = 0.86 + 0.22 * rgNoise(vec2(ctLocal.x + ctLocal.z, ctLocal.y * 0.6) * 9.0 + seed * 31.0);
  if (ctN.y > 0.5) {
    // Flat roof: grey slab inside a parapet of wall colour, darker just inside the parapet.
    vec2 r = ctLocal.xz, s = ctSize.xz; float e = min(min(r.x, s.x - r.x), min(r.y, s.y - r.y));
    vec3 slab = mix(vec3(0.36, 0.34, 0.31), wall, 0.3) * (0.8 + 0.35 * rgNoise(r * 7.0 + seed * 13.0));
    float pw = fwidth(e) + 1e-4;
    slab *= mix(0.7, 1.0, smoothstep(0.02, 0.08, e));
    diffuseColor.rgb = mix(slab, wall * 1.05, 1.0 - smoothstep(0.018 - pw, 0.018 + pw, e));
  } else {
    bool side = abs(ctN.x) > 0.5;
    float u = side ? ctLocal.z : ctLocal.x, fw = side ? ctSize.z : ctSize.x, y = ctLocal.y, h = ctSize.y;
    float bays = max(1.0, floor(fw / 0.15 + 0.5)), bu = u / fw * bays, fl = y / st, v = fract(fl);
    float bayId = floor(bu) + floor(fl) * 7.0 + seed * 97.0;
    float aa = clamp(1.6 - max(fwidth(bu), fwidth(fl)) * 3.0, 0.0, 1.0);
    vec2 cell = vec2(abs(fract(bu) - 0.5), abs(v - 0.55));
    float win = (1.0 - smoothstep(0.17, 0.23, cell.x)) * (1.0 - smoothstep(0.17, 0.22, cell.y));
    win *= step(0.12, rgHash(vec2(bayId, 3.1))) * step(y + 0.09, h); // some walls blind, none in the parapet
    vec3 glass = mix(vec3(0.07, 0.08, 0.09), vec3(0.16, 0.22, 0.25), step(0.75, rgHash(vec2(bayId, 5.7))));
    float slabLine = 1.0 - smoothstep(0.0, 0.07, v);           // floor slab edge
    float chajja = smoothstep(0.76, 0.8, v) * (1.0 - smoothstep(0.86, 0.9, v)); // sunshade shadow over windows
    vec3 col = wall * grime * (1.0 - 0.18 * slabLine - 0.22 * chajja);
    if (style > 1.5) { // exposed brick: courses + mortar, darker openings
      float course = rgLine(y, 0.0125, 0.0018);
      col = wall * (0.82 + 0.3 * rgHash(floor(vec2(u * 40.0, y * 80.0)))) * (1.0 - 0.25 * course * aa);
      win *= 0.8;
    }
    col = mix(col, glass, win * aa);
    if (style > 0.5 && style < 1.5 && fl < 1.0) { // shop: open shutters and a signboard band
      float open = (1.0 - smoothstep(0.38, 0.45, abs(fract(bu * 0.5) - 0.5))) * step(v, 0.66);
      vec3 sign = vec3(rgHash(vec2(bayId, 1.0)), rgHash(vec2(bayId, 2.0)), rgHash(vec2(bayId, 4.0)));
      col = mix(col, mix(vec3(0.05), vec3(0.2, 0.17, 0.14), rgHash(vec2(bayId, 8.0))), open * aa);
      col = mix(col, mix(sign, vec3(0.8), 0.25), step(0.7, v) * step(v, 0.88) * aa);
    }
    col = mix(col, wall * grime * 0.85, (1.0 - aa) * 0.5);
    col *= mix(0.55, 1.0, smoothstep(0.0, 0.07, y)) * mix(1.0, 0.85, smoothstep(h - 0.12, h, y) * rgNoise(vec2(u * 30.0, seed)));
    diffuseColor.rgb = col;
  }`;

export function buildingMaterial(kit) {
  const material = kit.material('#ffffff', { roughness: .92 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute vec3 aInfo;\nvarying vec3 ctLocal, ctSize, ctN, ctInfo;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX}`);
    shader.fragmentShader = `${GLSL_NOISE}
float rgLine(float x, float period, float w){ float d = abs(fract(x / period + 0.5) - 0.5) * period; float aa = fwidth(x) * 0.75; return (1.0 - smoothstep(w, w + aa, d)) * clamp(1.0 - fwidth(x) / (period * 0.35), 0.0, 1.0); }
varying vec3 ctLocal, ctSize, ctN, ctInfo;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT}`);
  };
  material.customProgramCacheKey = () => 'city-building';
  return material;
}
