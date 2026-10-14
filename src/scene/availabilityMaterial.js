import { lawnMaterial } from './kit.js';

// Available surfaces use the exact park green. Other statuses retain their
// palette colour, independent of sunlight and tone mapping.
export function availabilityMaterial(kit, options = {}) {
  const material = lawnMaterial(kit);
  Object.assign(material, { vertexColors: true, ...options });
  const paintGrass = material.onBeforeCompile, grassKey = material.customProgramCacheKey();
  material.onBeforeCompile = shader => {
    paintGrass(shader);
    shader.vertexShader = 'attribute float aPlotAvailable; varying float vPlotAvailable;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlotAvailable = aPlotAvailable;');
    shader.fragmentShader = 'varying float vPlotAvailable;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('diffuseColor.rgb = grass;', 'diffuseColor.rgb = mix(vec3(1.0), grass, vPlotAvailable);');
    shader.fragmentShader = shader.fragmentShader.replace('gl_FragColor.rgb = uLawnDark;', 'gl_FragColor.rgb = mix(vColor.rgb, uLawnDark, vPlotAvailable);');
  };
  material.customProgramCacheKey = () => `${grassKey}|plot-availability-v1`;
  return material;
}
