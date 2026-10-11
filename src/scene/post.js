// Post-processing: the scene renders once into a multisampled HDR target whose
// depth also feeds ground-truth ambient occlusion (no second scene pass, and
// alpha-cut foliage stays correct), then a light grade, tone mapping and sRGB.
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const AO_PIXELS = 1600 * 1000; // ponytail: AO buffer capped near 1.6 MP; raise for 4K-class GPUs.

export default function createPost(ctx) {
  const { THREE, renderer, scene, camera, quality } = ctx;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .96;
  const hdr = { type: THREE.HalfFloatType };
  const target = new THREE.WebGLRenderTarget(1, 1, { ...hdr, samples: quality.msaa, depthTexture: new THREE.DepthTexture(1, 1) });
  const aoTarget = new THREE.WebGLRenderTarget(1, 1, hdr), gradeTarget = new THREE.WebGLRenderTarget(1, 1, hdr);
  let ao = null; let aoOn = quality.ao;
  const makeAO = () => {
    // ponytail: r180 GTAOPass crashes when the depth texture is passed to its constructor; attach it after.
    ao = new GTAOPass(scene, camera, 1, 1, undefined,
      { radius: .2, distanceExponent: 1.6, thickness: .5, scale: 1.15, samples: 12, distanceFallOff: 1, screenSpaceRadius: false },
      { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
    ao.setGBuffer(target.depthTexture); ao.blendIntensity = .85;
  };
  if (aoOn) makeAO();
  // Grade in linear light: a touch of saturation and contrast, and a soft vignette.
  const grade = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, 1.05);
        c = pow(max(c, 0.0), vec3(1.04)) * 1.03;
        vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * 0.38;
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new FullScreenQuad(grade);
  const output = new OutputPass(); output.renderToScreen = true;
  const size = new THREE.Vector2();
  return {
    render: () => {
      renderer.setRenderTarget(target); renderer.render(scene, camera);
      let source = target;
      if (aoOn && ao) { ao.render(renderer, aoTarget, target); source = aoTarget; }
      grade.uniforms.tDiffuse.value = source.texture; renderer.setRenderTarget(gradeTarget); quad.render(renderer);
      output.render(renderer, null, gradeTarget);
    },
    setSize: () => {
      renderer.getDrawingBufferSize(size); const { x: w, y: h } = size;
      [target, aoTarget, gradeTarget].forEach(value => value.setSize(w, h));
      const scale = Math.min(1, Math.sqrt(AO_PIXELS / (w * h)));
      ao?.setSize(Math.round(w * scale), Math.round(h * scale)); output.setSize(w, h);
    },
    setAO: (on) => { aoOn = on && Boolean(ao); },
    dispose: () => { [target, aoTarget, gradeTarget].forEach(value => value.dispose()); target.depthTexture?.dispose(); ao?.dispose(); output.dispose(); quad.dispose(); grade.dispose(); },
  };
}
