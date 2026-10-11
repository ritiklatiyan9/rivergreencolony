// River Green's central fountain, after the project photographs on
// defencegarden.com: a low round pool wall in polished black granite tiles
// (with a red-brown granite panel where each red paver stripe meets it), a
// blue-and-white mosaic pool, a broad dome of stacked dark slate with a misty
// central plume, and a ring of foaming jets around the dome's foot.
import { GLSL_NOISE, proceduralMaterial, uniform } from './kit.js';

export function buildFountain(ctx, [fx, base, fz], R, parent) {
  const { THREE, kit, renderer, camera, mapMode } = ctx;
  const random = kit.rng(3131), time = { value: 0 };
  const size = new THREE.Vector2(1, 1);
  const group = new THREE.Group(); group.userData.colonyMapFit = { mode: 'rigid', anchor: [fx, fz] }; group.position.set(fx, base, fz); parent.add(group);
  const centre = uniform('vec2', new THREE.Vector2(fx, fz));
  const lathe = (profile, finish, segments = 160) => kit.mesh(kit.geometry(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments)), finish, group);
  const granite = proceduralMaterial(kit, {
    uniforms: { uGranite: uniform('vec3', new THREE.Color('#121416')), uCentre: centre },
    surface: `vec2 d = vWorld.xz - uCentre; float a = atan(d.y, d.x) * length(d) / 0.034;
      float tile = rgHash(vec2(floor(a), 7.0)), seam = rgLine(a, 1.0, 0.025);
      diffuseColor.rgb = uGranite * (0.8 + 0.4 * tile) * (0.9 + 0.2 * rgNoise(vWorld.xz * 400.0 + vWorld.y * 300.0)) + vec3(0.05) * seam;`,
    roughness: .14, metalness: .15, envMapIntensity: 1.6,
  });
  const mosaic = proceduralMaterial(kit, {
    uniforms: {},
    surface: `vec2 q = (vWorld.xz + vec2(vWorld.y)) / 0.0075; float h = rgHash(floor(q));
      vec3 c = h < 0.5 ? vec3(0.86, 0.91, 0.96) : h < 0.8 ? vec3(0.2, 0.42, 0.78) : vec3(0.07, 0.2, 0.52);
      diffuseColor.rgb = c * (1.0 - 0.35 * max(rgLine(q.x, 1.0, 0.06), rgLine(q.y, 1.0, 0.06)));`,
    roughness: .25, envMapIntensity: 1.2,
  });
  const slate = proceduralMaterial(kit, {
    uniforms: { uA: uniform('vec3', new THREE.Color('#2b2b2d')), uB: uniform('vec3', new THREE.Color('#5a554e')), uC: uniform('vec3', new THREE.Color('#5c4637')), uCentre: centre },
    surface: `vec2 d = vWorld.xz - uCentre; float row = vWorld.y / 0.0048, a = atan(d.y, d.x) * length(d) / 0.05 + rgHash(vec2(floor(row), 2.0)) * 5.0;
      float id = rgHash(vec2(floor(row), floor(a))), f = fract(row);
      vec3 c = mix(uA, uB, id); c = mix(c, uC, step(0.86, rgHash(vec2(floor(a), floor(row) + 9.0))) * 0.7);
      diffuseColor.rgb = c * (0.75 + 0.35 * smoothstep(0.55, 0.95, f)) * (1.0 - 0.5 * step(f, 0.12)) * (0.9 + 0.2 * rgNoise(vWorld.xz * 600.0));`,
    roughness: .8,
  });
  const rim = R - .04, wallTop = .05, waterY = .038, dome = R * .71;
  // Pool wall: tiled outer face, flat dark coping with a small lip, mosaic inside.
  lathe([[rim, 0], [R, 0], [R, wallTop - .004], [R + .004, wallTop], [rim - .002, wallTop], [rim, wallTop - .006]], granite);
  lathe([[rim - .001, wallTop - .006], [rim - .001, .008], [0.001, .008]], mosaic);
  // A red-brown granite panel in the wall wherever a red paver stripe arrives (north and south).
  for (const z of [-1, 1]) {
    const panel = kit.mesh(kit.box, kit.material('#5c2b21', { roughness: .2, metalness: .1, envMapIntensity: 1.4 }), group);
    panel.scale.set(.11, wallTop - .006, .012); panel.position.set(0, (wallTop - .006) / 2, z * (R + .001));
  }
  // The slate dome: a mosaic-tiled foot at the waterline, then stacked slate to a small cap.
  lathe([[dome + .012, .008], [dome + .012, waterY + .012], [dome, waterY + .014]], mosaic);
  const profile = [[dome, waterY + .012], [dome * .93, .08], [dome * .82, .125], [dome * .68, .17], [dome * .52, .21], [dome * .36, .238], [dome * .2, .256], [dome * .1, .262], [.02, .264]];
  lathe(profile, slate);
  // Water: a tinted, rippling surface over the mosaic.
  const water = kit.material('#3e95bd', { roughness: .03, metalness: 0, envMapIntensity: 1.6, transparent: true, opacity: .55, depthWrite: false });
  water.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = 'varying vec3 vWorld;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = `uniform float uTime; varying vec3 vWorld;\n${GLSL_NOISE}\n${shader.fragmentShader}`.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec2 wp = vWorld.xz * 80.0; float h0 = rgNoise(wp + uTime * 1.8), hx = rgNoise(wp + vec2(0.06, 0.0) + uTime * 1.8), hz = rgNoise(wp + vec2(0.0, 0.06) + uTime * 1.8);
      normal = normalize(normal + (viewMatrix * vec4((h0 - hx) * 5.0, 0.0, (h0 - hz) * 5.0, 0.0)).xyz * 0.45);`);
  };
  const surface = kit.mesh(kit.geometry(new THREE.RingGeometry(dome, rim - .001, 128)), water, group, { cast: false, receive: false });
  surface.rotation.x = -Math.PI / 2; surface.position.y = waterY; surface.renderOrder = 2;
  // Moving water: foaming jets around the dome and a slender misty plume from its cap.
  const flow = (opacity, speed) => kit.track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: time },
    // Instanced jets need instanceMatrix applied by hand in a ShaderMaterial.
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; vec4 p = vec4(position, 1.0);\n#ifdef USE_INSTANCING\np = instanceMatrix * p;\n#endif\ngl_Position = projectionMatrix * modelViewMatrix * p; }',
    fragmentShader: `${GLSL_NOISE} uniform float uTime; varying vec2 vUv;
      void main(){ float s = rgNoise(vec2(vUv.x * 24.0, vUv.y * 6.0 - uTime * ${speed.toFixed(1)})) * 0.7 + rgNoise(vec2(vUv.x * 70.0, vUv.y * 12.0 - uTime * ${(speed * 1.6).toFixed(1)})) * 0.3;
        float a = (0.45 + 0.55 * s) * smoothstep(1.0, 0.7, vUv.y) * smoothstep(0.0, 0.05, vUv.y);
        gl_FragColor = vec4(mix(vec3(0.85, 0.93, 1.0), vec3(1.0), s), a * ${opacity.toFixed(2)}); }`,
  }));
  const jets = 22, jetMaterial = flow(1, 6), jet = kit.geometry(new THREE.CylinderGeometry(.009, .017, 1, 12, 1, true));
  const jetMesh = new THREE.InstancedMesh(jet, jetMaterial, jets), dummy = new THREE.Object3D(), jetR = (dome + rim) / 2;
  for (let i = 0; i < jets; i += 1) {
    const a = i / jets * Math.PI * 2, h = .085 + random() * .03;
    dummy.position.set(Math.cos(a) * jetR, waterY + h / 2, Math.sin(a) * jetR); dummy.scale.set(1, h, 1); dummy.updateMatrix(); jetMesh.setMatrixAt(i, dummy.matrix);
  }
  jetMesh.renderOrder = 3; group.add(jetMesh);
  const plume = kit.mesh(kit.geometry(new THREE.CylinderGeometry(.01, .022, .46, 20, 1, true)), flow(.7, 8), group, { cast: false, receive: false });
  plume.position.y = .264 + .23; plume.renderOrder = 3;
  // Spray: drops off the plume's crown falling onto the dome, and foam above each jet.
  const starts = [], velocities = [], phases = [], floors = [];
  for (let i = 0; i < 900; i += 1) {
    const a = random() * Math.PI * 2, crown = i < 520;
    if (crown) { const speed = .05 + random() * .14; starts.push(0, .7 + random() * .05, 0); velocities.push(Math.cos(a) * speed, .04 + random() * .1, Math.sin(a) * speed); floors.push(0); }
    else { const j = Math.floor(random() * jets) / jets * Math.PI * 2; starts.push(Math.cos(j) * jetR, waterY + .06, Math.sin(j) * jetR); velocities.push(Math.cos(a) * .03, .08 + random() * .1, Math.sin(a) * .03); floors.push(waterY); }
    phases.push(random());
  }
  const spray = kit.geometry(new THREE.BufferGeometry());
  spray.setAttribute('position', new THREE.Float32BufferAttribute(starts, 3)); spray.setAttribute('aVelocity', new THREE.Float32BufferAttribute(velocities, 3));
  spray.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1)); spray.setAttribute('aFloor', new THREE.Float32BufferAttribute(floors, 1));
  const sprayMaterial = kit.track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime: time, uScale: { value: 400 }, uViewport: { value: size }, uDome: { value: dome } },
    vertexShader: `attribute vec3 aVelocity; attribute float aPhase, aFloor; uniform float uTime, uScale, uDome; uniform vec2 uViewport; varying float vAlpha;
      ${mapMode ? `
      float rgProjectedDrop(vec4 centre, vec3 point) {
        vec4 edge = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
        vec2 delta = edge.xy / max(abs(edge.w), 0.0001) - centre.xy / max(abs(centre.w), 0.0001);
        return length(delta * uViewport) * 0.5;
      }` : ''}
      void main(){ float t = fract(aPhase + uTime * 0.85) * 0.75; vec3 p = position + aVelocity * t; p.y -= 1.5 * t * t;
        float r = length(p.xz), ground = aFloor > 0.0 ? aFloor : 0.264 * clamp(1.0 - pow(r / uDome, 1.6), 0.0, 1.0) + 0.04;
        vAlpha = step(ground, p.y) * (1.0 - t / 0.75) * 0.8;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        ${mapMode ? `
        // The map supplies a combined map camera matrix, so project the drop's
        // local diameter rather than assuming mv.z is camera-space depth.
        float drop = max(rgProjectedDrop(gl_Position, p + vec3(0.005, 0.0, 0.0)),
          max(rgProjectedDrop(gl_Position, p + vec3(0.0, 0.005, 0.0)), rgProjectedDrop(gl_Position, p + vec3(0.0, 0.0, 0.005))));
        gl_PointSize = clamp(drop, 1.0, 6.0);` : 'gl_PointSize = clamp(uScale * 0.005 / -mv.z, 1.0, 10.0);'} }`,
    fragmentShader: 'varying float vAlpha; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(0.92, 0.97, 1.0, vAlpha * (1.0 - smoothstep(0.1, 0.5, d))); }',
  }));
  const points = new THREE.Points(spray, sprayMaterial); points.frustumCulled = false; points.renderOrder = 4; group.add(points);
  // Ripples spreading from the jets across the pool.
  const ripple = kit.geometry(new THREE.RingGeometry(.97, 1, 128));
  const rings = [0, 1, 2].map(() => {
    const value = kit.mesh(ripple, kit.track(new THREE.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0, depthWrite: false })), group, { cast: false, receive: false });
    value.rotation.x = -Math.PI / 2; value.position.y = waterY + .0008; value.renderOrder = 3; return value;
  });
  return {
    update: (seconds) => {
      time.value = seconds;
      if (mapMode) size.set(renderer.domElement.width, renderer.domElement.height);
      else renderer.getDrawingBufferSize(size);
      if (!mapMode) sprayMaterial.uniforms.uScale.value = size.y * camera.projectionMatrix.elements[5] * .5;
      rings.forEach((ring, i) => { const t = (seconds * .3 + i / 3) % 1; ring.scale.setScalar(dome + .01 + t * (rim - dome - .02)); ring.material.opacity = (1 - t) * .4 * (seconds ? 1 : 0); });
    },
  };
}
