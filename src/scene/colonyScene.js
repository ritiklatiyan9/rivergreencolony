// River Green 3D colony: renderer, camera, controls, render loop and module
// orchestration. Visual content lives in the sibling modules; each receives
// the shared `ctx` and may return { update(seconds, delta), paintPlots(statuses) }.
import * as THREE from 'three';
import { createKit, HEIGHTS, M, SCALE } from './kit.js';
import { buildLandscape } from '../data/sceneLandscape.js';
import { createPlotClickGesture, createPlotSurfaces, pickPlotRay } from './colonyPlotPicker.js';
import { observePageScroll } from './pageScrollActivity.js';

// Build order matters: sky sets the lights and fog the others are lit by.
const MODULES = [
  ['sky', () => import('./sky.js')],
  ['countryside', () => import('./countryside.js')],
  ['city', () => import('./city.js')],
  ['chakroad', () => import('./chakroad.js')],
  ['ground', () => import('./ground.js')],
  ['architecture', () => import('./architecture.js')],
  ['plaza', () => import('./plaza.js')],
  ['vegetation', () => import('./vegetation.js')],
  ['life', () => import('./life.js')],
];

// azimuth 0 looks north up the boulevard from the entrance side; elevation is
// the camera's angle above the ground; distance is from the target (or zoom,
// where 1 fits the whole colony). The default aerial view is a drone shot up
// the boulevard to the fountain with the horizon in frame.
const VIEWS = {
  booking: { azimuth: 0, elevation: 1.25, distance: 5, x: -5.6, z: 1.55, fov: 50 },
  nature: { azimuth: 0, elevation: .45, distance: 12.5, x: -1.2, z: 2.4, fov: 52 },
  plan: { azimuth: 0, elevation: 1.5, fit: 'plan', x: -.3, z: -.3, fov: 26 },
  community: { azimuth: .1, elevation: .4, distance: 6.4, x: -1.2, z: -1.3, fov: 50 },
  connection: { azimuth: .25, elevation: .3, distance: 6, x: -1.2, z: 10.3, fov: 45 },
};
// Free exploration: any azimuth, from just above the ground to straight down;
// zoom has no limits; the look-at target stays inside the modelled world.
const ELEVATION = [.03, 1.565];
const PAN_LIMIT = 600;

// ponytail: GPU-string + pointer heuristics; the frame-time governor below catches the rest.
function detectQuality() {
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    gpu = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* Detection is best effort. */ }
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const software = /swiftshader|llvmpipe|software|basic render/i.test(gpu);
  const weak = /mali-[gt]?[1-7]\d?\b|adreno.*\b[1-5]\d\d\b|powervr|sgx|intel.*hd graphics [1-5]/i.test(gpu) || (navigator.hardwareConcurrency || 4) < 4;
  const forced = new URLSearchParams(window.location.search).get('tier');
  const tier = ['high', 'medium', 'low'].includes(forced) ? forced : software || weak ? 'low' : coarse || window.innerWidth < 900 ? 'medium' : 'high';
  const dpr = window.devicePixelRatio || 1;
  return {
    tier, gpu,
    pixelRatio: Math.min(dpr, tier === 'high' ? 2 : tier === 'medium' ? 1.5 : 1),
    shadowMapSize: tier === 'high' ? 4096 : tier === 'medium' ? 2048 : 1024,
    // MSAA lives on the post-processing target (cheap on tile-based mobile GPUs).
    ao: tier === 'high', msaa: tier === 'low' ? 2 : 4,
    density: tier === 'high' ? 1 : tier === 'medium' ? .6 : .35,
  };
}

export async function createColonyScene({ host, plan, statusColours, records = [], view = 'community', reducedMotion = false, onDragChange = () => {}, onFail = () => {}, onHint = () => {}, onPlotSelect = () => {} }) {
  const quality = detectQuality();
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'default', stencil: false });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.info.autoReset = false;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.domElement.setAttribute('aria-hidden', 'true'); host.appendChild(renderer.domElement);

  const kit = createKit(renderer, plan);
  const scene = new THREE.Scene(); const root = new THREE.Group(); scene.add(root);
  const camera = new THREE.PerspectiveCamera(38, 1.6, .05, 4000);
  const updates = []; const painters = []; const parts = {};
  let disposed = false, failed = false, frame = 0, visible = true, lastTime = 0, lastRendered = 0, gesture = null, aspect = 1.6, motionOff = reducedMotion, post = null, statuses = new Map();
  const requestRender = () => { if (!frame && visible && !document.hidden && !failed && !disposed && !pageScroll.active) frame = requestAnimationFrame(render); };
  const pageScroll = observePageScroll({ isVisible: () => visible && !disposed,
    pause: () => { cancelAnimationFrame(frame); frame = 0; },
    resume: () => { lastTime = 0; lastRendered = 0; requestRender(); },
  });
  const ctx = { THREE, renderer, scene, camera, root, plan, kit, world: kit.world, SCALE, M, HEIGHTS, quality, statusColours, landscape: buildLandscape(plan), wind: { value: 0 }, sun: null, requestRender };

  const loaded = await Promise.allSettled([...MODULES.map(([, load]) => load()), import('./post.js')]);
  if (disposed) return null;
  // One failing module is logged and skipped; the rest of the colony still renders.
  MODULES.forEach(([name], index) => {
    const result = loaded[index];
    if (result.status !== 'fulfilled') { console.error(`[colony] ${name} failed to load`, result.reason); return; }
    try {
      const part = result.value.default(ctx) || {}; parts[name] = part;
      if (part.update) updates.push([name, part.update]);
      if (part.paintPlots) painters.push([name, part.paintPlots]);
    } catch (error) { console.error(`[colony] ${name} failed to build`, error); }
  });
  try { if (loaded.at(-1).status === 'fulfilled') post = loaded.at(-1).value.default(ctx); else throw loaded.at(-1).reason; }
  catch (error) { console.error('[colony] post-processing unavailable', error); post = null; }

  const failedUpdates = new Set();
  const animate = (seconds, delta) => {
    ctx.wind.value = seconds;
    updates.forEach(([name, update]) => { if (failedUpdates.has(name)) return; try { update(seconds, delta); } catch (error) { failedUpdates.add(name); console.error(`[colony] ${name} update failed`, error); } });
  };
  const paintPlots = (list) => {
    statuses = new Map(list.map(record => [record.number, record.status]));
    painters.forEach(([name, paint]) => { try { paint(statuses); } catch (error) { console.error(`[colony] ${name} paint failed`, error); } });
    renderer.shadowMap.needsUpdate = true; requestRender();
  };

  // Camera: eased spherical orbit around a ground target.
  const fit = (fov) => { const tan = Math.tan(THREE.MathUtils.degToRad(fov) / 2); return Math.max(15.5 / (tan * Math.min(aspect, 1.9)), 11.5 / tan); };
  // Plan view frames the whole colony with the Chakroad (north) and Shamli Road (south) on any aspect.
  const fitPlan = (fov) => { const tan = Math.tan(THREE.MathUtils.degToRad(fov) / 2); return Math.max(14.6 / (tan * aspect), 13.9 / tan); };
  const resolve = (name) => { const v = VIEWS[name] || VIEWS.nature; return { azimuth: v.azimuth, elevation: v.elevation, x: v.x, z: v.z, fov: v.fov, distance: v.distance ?? (v.fit === 'plan' ? fitPlan(v.fov) : fit(v.fov) / v.zoom) }; };
  const current = resolve(view), target = { ...current };
  const lookAt = new THREE.Vector3();
  const placeCamera = () => {
    lookAt.set(current.x, .1, current.z);
    const flat = Math.cos(current.elevation) * current.distance;
    camera.position.set(current.x + Math.sin(current.azimuth) * flat, .1 + Math.sin(current.elevation) * current.distance, current.z + Math.cos(current.azimuth) * flat);
    camera.fov = current.fov; camera.near = Math.min(Math.max(current.distance * .01, .002), 20); camera.far = Math.max(4000, current.distance * 3);
    camera.updateProjectionMatrix(); camera.lookAt(lookAt);
  };

  // Frame-time governor: sustained slow frames lower resolution, then drop AO.
  let slowFrames = 0; let pixelRatio = quality.pixelRatio;
  const govern = (interval) => {
    slowFrames = interval > 45 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
    if (slowFrames < 90) return; slowFrames = 0;
    if (pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio * .75); renderer.setPixelRatio(pixelRatio); resize(); }
    else if (post?.setAO && quality.ao) { quality.ao = false; post.setAO(false); }
  };

  const fail = () => { if (failed || disposed) return; failed = true; cancelAnimationFrame(frame); frame = 0; onFail(); };
  function render(time = 0) {
    frame = 0; if (failed || disposed || !visible || document.hidden || pageScroll.active) return;
    const interval = lastTime ? time - lastTime : 16; const delta = Math.min(interval / 1000, .05); lastTime = time;
    const easing = motionOff ? 1 : 1 - Math.exp(-delta * 6); let settling = false;
    for (const key of Object.keys(current)) { current[key] += (target[key] - current[key]) * easing; if (Math.abs(target[key] - current[key]) > .0005 * (key === 'distance' ? current.distance : 1)) settling = true; }
    // Ambient-only animation is capped near 30 fps; interaction runs at full rate.
    if (!motionOff && !settling && !gesture && time - lastRendered < 31) { frame = requestAnimationFrame(render); return; }
    if (!motionOff && !settling && !gesture && lastRendered) govern(time - lastRendered);
    lastRendered = time;
    placeCamera(); animate(motionOff ? 0 : time * .001, delta);
    renderer.info.reset();
    try { if (post) post.render(); else renderer.render(scene, camera); } catch (error) { console.error('[colony] render failed', error); fail(); return; }
    if (!motionOff || settling || gesture) frame = requestAnimationFrame(render);
  }
  function resize() {
    const w = Math.max(host.clientWidth, 1), h = Math.max(host.clientHeight, 1); aspect = w / h;
    camera.aspect = aspect; renderer.setSize(w, h, false); post?.setSize(w, h);
    requestRender();
  }
  const preset = (name) => { Object.assign(target, resolve(name)); requestRender(); };

  const canvas = renderer.domElement;
  const plotSurfaces = createPlotSurfaces(plan, { groundHeight: HEIGHTS.lawn, shopHeight: HEIGHTS.shopRoof });
  const plotClick = createPlotClickGesture(), pickRay = new THREE.Raycaster(), pickPointer = new THREE.Vector2();
  const pickPlot = event => {
    if (disposed || failed) return null;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return null;
    pickPointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
    // Use the rendered camera, not the easing target used by wheel controls.
    camera.updateMatrixWorld(); pickRay.setFromCamera(pickPointer, camera);
    return pickPlotRay(pickRay.ray.origin.toArray(), pickRay.ray.direction.toArray(), plotSurfaces);
  };
  const clampPan = (value) => THREE.MathUtils.clamp(value, -PAN_LIMIT, PAN_LIMIT);
  // Pan by screen pixels: the map follows the pointer across the ground plane.
  const panBy = (dx, dy) => {
    const perPixel = 2 * target.distance * Math.tan(THREE.MathUtils.degToRad(target.fov) / 2) / Math.max(host.clientHeight, 1), tilt = 1 / Math.max(Math.sin(target.elevation), .25);
    const sin = Math.sin(target.azimuth), cos = Math.cos(target.azimuth);
    target.x = clampPan(target.x + (-cos * dx - sin * dy * tilt) * perPixel); target.z = clampPan(target.z + (sin * dx - cos * dy * tilt) * perPixel);
  };
  // The point under a screen position (on the target's plane), seen from the
  // camera the controls are heading to, so quick wheel steps stay consistent.
  const probe = new THREE.PerspectiveCamera(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pivotPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.1), hit = new THREE.Vector3();
  const groundAt = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect(), flat = Math.cos(target.elevation) * target.distance;
    ndc.set((clientX - r.left) / r.width * 2 - 1, 1 - (clientY - r.top) / r.height * 2);
    probe.fov = target.fov; probe.aspect = aspect; probe.near = .001; probe.far = 1e6; probe.updateProjectionMatrix();
    probe.position.set(target.x + Math.sin(target.azimuth) * flat, .1 + Math.sin(target.elevation) * target.distance, target.z + Math.cos(target.azimuth) * flat);
    probe.lookAt(target.x, .1, target.z); probe.updateMatrixWorld();
    ray.setFromCamera(ndc, probe);
    return ray.ray.intersectPlane(pivotPlane, hit) ? hit : null;
  };
  // Zoom keeps the point under the anchor (cursor or pinch midpoint) fixed on
  // screen: camera and target scale together about it. Without an anchor (the
  // + / − buttons) it zooms on the middle. No limits: multiplicative, never zero.
  const zoomAt = (factor, clientX, clientY) => {
    const scale = 1 / factor, anchor = clientX === undefined ? null : groundAt(clientX, clientY);
    if (anchor) { target.x = clampPan(anchor.x + (target.x - anchor.x) * scale); target.z = clampPan(anchor.z + (target.z - anchor.z) * scale); }
    target.distance *= scale; requestRender();
  };
  const zoomBy = (factor) => zoomAt(factor);
  // Turning keeps the point under the anchor fixed too: the whole rig rotates about it.
  const turnAt = (delta, clientX, clientY) => {
    const anchor = groundAt(clientX, clientY);
    if (anchor) { const dx = target.x - anchor.x, dz = target.z - anchor.z, c = Math.cos(delta), s = Math.sin(delta); target.x = clampPan(anchor.x + dx * c + dz * s); target.z = clampPan(anchor.z - dx * s + dz * c); }
    target.azimuth += delta;
  };
  // Double-click / double-tap: fly to the spot and zoom in.
  let lastFly = 0;
  const flyTo = (clientX, clientY) => { const spot = groundAt(clientX, clientY); if (!spot) return; lastFly = performance.now(); target.x = clampPan(spot.x); target.z = clampPan(spot.z); zoomBy(1.8); };
  // Pointers: one = orbit (or pan with the right button / Shift); two = pan, pinch zoom and twist.
  const pointers = new Map();
  const startGesture = () => {
    const list = [...pointers.values()];
    if (list.length >= 2) { const [a, b] = list; gesture = { mode: 'pinch', spread: Math.hypot(b.x - a.x, b.y - a.y) || 1, angle: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, locked: true }; }
    else if (list.length === 1) { const [p] = list; gesture = { mode: p.pan ? 'pan' : 'orbit', x: p.x, y: p.y, azimuth: target.azimuth, elevation: target.elevation, touch: p.touch, locked: false }; }
    else gesture = null;
  };
  const pointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button > 2) return;
    plotClick.begin(event);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, touch: event.pointerType === 'touch', pan: event.button === 1 || event.button === 2 || event.shiftKey });
    startGesture(); requestRender();
  };
  const pointerMove = (event) => {
    plotClick.move(event);
    const p = pointers.get(event.pointerId); if (!p || !gesture) return;
    p.x = event.clientX; p.y = event.clientY;
    if (gesture.mode === 'pinch') {
      // Move with the fingers, then zoom and turn about the point between them.
      const [a, b] = [...pointers.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, spread = Math.hypot(b.x - a.x, b.y - a.y) || 1, angle = Math.atan2(b.y - a.y, b.x - a.x);
      const turn = Math.atan2(Math.sin(gesture.angle - angle), Math.cos(gesture.angle - angle)); // shortest way round
      panBy(mx - gesture.mx, my - gesture.my); zoomAt(spread / gesture.spread, mx, my); turnAt(turn, mx, my);
      Object.assign(gesture, { mx, my, spread, angle });
      onDragChange(true); requestRender(); return;
    }
    const dx = p.x - gesture.x, dy = p.y - gesture.y;
    // A single finger swiping vertically scrolls the page instead.
    if (gesture.touch && !gesture.locked && gesture.mode === 'orbit' && Math.abs(dy) > Math.abs(dx) + 5) { pointers.delete(event.pointerId); gesture = null; onDragChange(false); onHint('touch'); return; }
    if (!gesture.locked && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) { gesture.locked = true; onDragChange(true); try { canvas.setPointerCapture(event.pointerId); } catch { /* Pointer may already be released. */ } }
    if (!gesture.locked) return;
    if (gesture.mode === 'pan') { panBy(dx, dy); gesture.x = p.x; gesture.y = p.y; }
    else { target.azimuth = gesture.azimuth - dx * .005; target.elevation = THREE.MathUtils.clamp(gesture.elevation + dy * .003, ...ELEVATION); }
    requestRender();
  };
  let lastTap = null;
  const pointerUp = (event) => {
    const selected = plotClick.end(event) ? pickPlot(event) : null;
    if (selected) onPlotSelect(selected);
    // A second quick tap in the same place flies there (touch has no dblclick).
    const p = pointers.get(event.pointerId);
    if (!selected && p?.touch && event.type === 'pointerup' && pointers.size === 1 && gesture && !gesture.locked) {
      const now = performance.now();
      if (lastTap && now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) { flyTo(p.x, p.y); lastTap = null; } else lastTap = { t: now, x: p.x, y: p.y };
    }
    if (!pointers.delete(event.pointerId) && event.type !== 'pointerup') return;
    if (pointers.size) startGesture(); else if (gesture) { gesture = null; onDragChange(false); }
    requestRender();
  };
  // Ctrl/⌘ + wheel and trackpad pinches zoom toward the cursor; a plain wheel
  // keeps scrolling the page (and shows a one-line hint over the map).
  const wheel = (event) => {
    if (!(event.ctrlKey || event.metaKey)) { onHint('wheel'); return; }
    event.preventDefault(); zoomAt(Math.exp(-event.deltaY * .0025), event.clientX, event.clientY);
  };
  const doubleClick = (event) => { if (!pickPlot(event) && performance.now() - lastFly > 500) flyTo(event.clientX, event.clientY); }; // a double-tap may also fire dblclick
  const noMenu = (event) => event.preventDefault();
  const lost = event => { event.preventDefault(); fail(); };
  const visibilityChange = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else { lastTime = 0; requestRender(); } };
  const listeners = [['pointerdown', pointerDown], ['pointermove', pointerMove], ['pointerup', pointerUp], ['pointercancel', pointerUp], ['lostpointercapture', pointerUp], ['webglcontextlost', lost], ['dblclick', doubleClick], ['contextmenu', noMenu]];
  listeners.forEach(([type, handler]) => canvas.addEventListener(type, handler));
  canvas.addEventListener('wheel', wheel, { passive: false });
  window.addEventListener('pointerup', pointerUp); document.addEventListener('visibilitychange', visibilityChange);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) { lastTime = 0; requestRender(); } else { cancelAnimationFrame(frame); frame = 0; } }); intersectionObserver.observe(host);

  resize(); Object.assign(target, resolve(view)); Object.assign(current, target); paintPlots(records);
  // Development-only hooks for the screenshot harness: jump the camera, read render stats.
  if (import.meta.env?.DEV) {
    window.__colonyCamera = (next) => { Object.assign(target, next); Object.assign(current, target); requestRender(); };
    window.__colonyPick = (clientX, clientY) => { const spot = groundAt(clientX, clientY); return spot && { x: spot.x, z: spot.z }; };
    window.__colonyState = () => ({ ...target });
    window.__colonyInfo = () => ({ loop: { frame, visible, motionOff, rendered: renderer.info.render.frame, hidden: document.hidden }, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, quality: { ...quality } });
  }

  return {
    requestRender, preset, paintPlots,
    rotate: (amount, vertical = false) => { if (vertical) target.elevation = THREE.MathUtils.clamp(target.elevation + amount, ...ELEVATION); else target.azimuth += amount; requestRender(); },
    zoom: zoomBy,
    pan: (dx, dy) => { panBy(dx, dy); requestRender(); },
    setReducedMotion: (flag) => { motionOff = flag; requestRender(); },
    dispose: () => {
      disposed = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); intersectionObserver.disconnect();
      pageScroll.dispose();
      plotClick.reset();
      listeners.forEach(([type, handler]) => canvas.removeEventListener(type, handler)); canvas.removeEventListener('wheel', wheel);
      window.removeEventListener('pointerup', pointerUp); document.removeEventListener('visibilitychange', visibilityChange);
      Object.values(parts).forEach(part => { try { part.dispose?.(); } catch { /* Keep disposing the rest. */ } });
      post?.dispose?.(); kit.dispose(); scene.environment?.dispose?.(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
