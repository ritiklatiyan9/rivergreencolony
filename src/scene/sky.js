// Midday sky over Shamli: a gradient dome with drifting clouds and sun glow,
// matching horizon haze (fog), sky-lit environment reflections, a high
// north-west sun with soft static shadows over the colony, and sky/ground fill.
import { GLSL_NOISE } from './kit.js';

const ZENITH = '#3f7fc8', HORIZON = '#c4d8ea', HAZE = '#d3dfe6';
export const SUN_DIRECTION = [-.46, .78, -.42]; // towards the sun: high in the north-west

// The map supplies the visible sky. A small daylight panorama gives the same
// blue sky / warm ground reflections without rendering six cloud-heavy sky
// views at 256px before the colony's first frame. Its PMREM faces are 64px.
function mapEnvironment(THREE, renderer, kit, sunDirection) {
  const width = 256, height = 128, pixels = new Float32Array(width * height * 4);
  const zenith = new THREE.Color(ZENITH), horizon = new THREE.Color(HORIZON), ground = new THREE.Color('#56703a'), colour = new THREE.Color();
  for (let y = 0; y < height; y++) {
    const latitude = (y + .5) / height * Math.PI - Math.PI / 2, h = Math.sin(latitude), ring = Math.cos(latitude);
    for (let x = 0; x < width; x++) {
      const longitude = (x + .5) / width * Math.PI * 2 - Math.PI;
      colour.copy(h >= 0 ? horizon : ground).lerp(h >= 0 ? zenith : horizon, h >= 0 ? Math.pow(h, .55) : Math.exp(h * 9) * .5);
      const sun = Math.max(0, Math.cos(longitude) * ring * sunDirection.x + h * sunDirection.y + Math.sin(longitude) * ring * sunDirection.z);
      const glow = Math.pow(sun, 120) * 2 + Math.pow(sun, 12) * .12, i = (y * width + x) * 4;
      pixels[i] = colour.r + glow; pixels[i + 1] = colour.g + glow * .96; pixels[i + 2] = colour.b + glow * .88; pixels[i + 3] = 1;
    }
  }
  const panorama = kit.track(new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType));
  panorama.mapping = THREE.EquirectangularReflectionMapping; panorama.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = kit.track(pmrem.fromEquirectangular(panorama));
  pmrem.dispose(); panorama.dispose();
  return environment.texture;
}

function standaloneSky(ctx, sunDirection) {
  const { THREE, renderer, scene, kit, wind } = ctx;
  const uniforms = {
    uZenith: { value: new THREE.Color(ZENITH) }, uHorizon: { value: new THREE.Color(HORIZON) }, uHaze: { value: new THREE.Color(HAZE) },
    uSun: { value: sunDirection }, uTime: wind,
  };
  const skyMaterial = kit.track(new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
    fragmentShader: `${GLSL_NOISE}
      uniform vec3 uZenith, uHorizon, uHaze, uSun; uniform float uTime; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
        col = mix(col, uHaze, exp(-max(h, 0.0) * 9.0) * 0.85);
        // Fair-weather cumulus on a plane above the land, thinning toward the horizon.
        vec2 uv = d.xz / max(h, 0.035) * 0.9 + vec2(uTime * 0.004, uTime * 0.0015);
        float n = rgFbm(uv * 1.3) * 0.75 + rgFbm(uv * 4.1 + 3.7) * 0.25;
        float cover = smoothstep(0.52, 0.74, n) * smoothstep(0.015, 0.16, h);
        float lit = clamp(0.62 + 0.5 * (rgFbm(uv * 1.3 + uSun.xz * 0.35) - n) * 4.0, 0.55, 1.0);
        vec3 cloud = mix(vec3(0.71, 0.76, 0.84), vec3(1.0, 0.99, 0.97), lit);
        col = mix(col, cloud, cover * 0.9);
        float s = max(dot(d, uSun), 0.0);
        col += vec3(1.0, 0.96, 0.88) * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.12);
        col = mix(col, uHaze, smoothstep(0.02, -0.06, h));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const dome = new THREE.Mesh(kit.geometry(new THREE.SphereGeometry(1000, 48, 24)), skyMaterial);
  dome.frustumCulled = false; dome.renderOrder = -10;
  scene.add(dome);
  scene.background = new THREE.Color(HAZE);
  scene.fog = new THREE.FogExp2(HAZE, .0058);

  // Environment lighting rendered from the same sky (clouds frozen at t = 0).
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); const envDome = new THREE.Mesh(dome.geometry, skyMaterial); envScene.add(envDome);
  const ground = new THREE.Mesh(kit.geometry(new THREE.CircleGeometry(900, 32)), kit.track(new THREE.MeshBasicMaterial({ color: '#56703a' })));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -5; envScene.add(ground);
  const environment = kit.track(pmrem.fromScene(envScene, 0, .1, 1000));
  pmrem.dispose(); envScene.remove(envDome);
  scene.environment = environment.texture;
  return dome;
}

export default function buildSky(ctx) {
  const { THREE, renderer, scene, camera, kit, quality, mapMode } = ctx;
  const sunDirection = new THREE.Vector3(...SUN_DIRECTION).normalize();
  const dome = mapMode ? null : standaloneSky(ctx, sunDirection);
  if (mapMode) scene.environment = mapEnvironment(THREE, renderer, kit, sunDirection);
  scene.environmentIntensity = .55;

  scene.add(new THREE.HemisphereLight('#cfe2fb', '#5f6b3a', .6));
  const sun = new THREE.DirectionalLight('#fff3df', 3.4);
  sun.position.copy(sunDirection).multiplyScalar(60); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 20, far: 110 });
  sun.shadow.bias = -.0002; sun.shadow.normalBias = .012;
  scene.add(sun, sun.target); ctx.sun = sun;

  return {
    // The dome follows the camera so it always wraps the view.
    update: () => { if (!mapMode) dome.position.copy(camera.position); },
  };
}
