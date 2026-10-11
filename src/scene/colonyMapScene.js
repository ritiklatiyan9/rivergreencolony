import * as THREE from 'three';
import { Map as MapLibreMap, MercatorCoordinate, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { colonyPointToLatLng, getColonySiteFit, RIVER_GREEN_FRONTAGE } from '../data/colonyLocation.js';
import { createColonyFrontage, createFrontageShopPlacement, createExpandedInteriorFit } from '../data/colonyFrontage.js';
import { buildColonyModel, preloadColonyModules } from './colonyModel.js';
import { updateMapCamera } from './colonyMapCamera.js';
import { createColonyMapTransform } from './colonyMapPlacement.js';
import { applyColonyMapFit } from './colonyMapFit.js';
import { prepareMapPlan } from '../data/colonySiteFit.js';

setWorkerUrl(workerUrl);
export const preloadColonyMapScene = preloadColonyModules;

// Satellite tiles supply real surroundings. The Three.js
// colony uses the map's WebGL context and camera, so both move together.
export function createColonyMapScene({ host, plan, config, statusColours, records = [], view = 'nature', reducedMotion = false, signal, onFail = () => {}, onDragChange = () => {} }) {
  if (signal?.aborted) return Promise.resolve(null);
  // The model builder awaits this same promise and handles any load failure.
  preloadColonyModules().catch(() => {});
  const baseSiteFit = config.fitToSite ? getColonySiteFit(plan, config) : null;
  const basePlan = baseSiteFit ? prepareMapPlan(plan) : plan;
  let siteFit = baseSiteFit, modelPlan = basePlan;
  const frontage = baseSiteFit ? createColonyFrontage(plan, baseSiteFit, RIVER_GREEN_FRONTAGE) : null;
  if (frontage) {
    const placement = createFrontageShopPlacement(basePlan, baseSiteFit, frontage);
    frontage.shopRows = placement.rows;
    frontage.shopBoundary = placement.targetBoundary;
    frontage.shopGateFront = placement.gateFront;
    const interior = createExpandedInteriorFit(basePlan, baseSiteFit, frontage, placement);
    siteFit = interior.fit; modelPlan = interior.plan;
    frontage.approach = interior.approach; frontage.entry = interior.entry;
    frontage.gardens = interior.frontageGardens;
    frontage.forecourtBoundary = interior.forecourtBoundary;
    frontage.forecourtTargetBoundary = interior.forecourtTargetBoundary;
  }
  const locationPoint = p => [p.lng, p.lat];
  const point = value => locationPoint(siteFit ? siteFit.location(value) : colonyPointToLatLng(value, plan, config));
  const frontagePoint = value => locationPoint(baseSiteFit ? baseSiteFit.location(value) : colonyPointToLatLng(value, plan, config));
  // A negative camera bearing turns the displayed map clockwise on screen.
  // Keep camera rotation independent of the colony's geographic alignment.
  const defaultBearing = -90;
  const map = new MapLibreMap({
    container: host, style: config.styleUrl, center: point(plan.roundabout.center),
    zoom: 17, pitch: 45, bearing: defaultBearing,
    maxPitch: 75, maxZoom: 22, projection: { type: 'mercator' },
    cooperativeGestures: true, keyboard: false,
    canvasContextAttributes: { antialias: true },
    attributionControl: { compact: true },
  });
  map.addControl(new NavigationControl({ showZoom: false, showCompass: true, visualizePitch: true }), 'bottom-right');
  const anchor = MercatorCoordinate.fromLngLat([config.location.lng, config.location.lat], config.altitude);
  // Mercator is X east / Y south / Z up; the model is X east / Y up / Z south.
  // Apply this in the camera matrix, preserving procedural model coordinates.
  const transform = createColonyMapTransform(plan, config, anchor, anchor.meterInMercatorCoordinateUnits());
  let renderer, model, disposed = false, failed = false, visible = true, frame = 0, generation = 0;
  let motionOff = reducedMotion, latestRecords = records, lastDraw = 0, lastTick = 0, ready = false, timeout;
  let resolveReady, rejectReady;
  const completion = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const requestRender = () => { if (!disposed && !failed && (!ready || (visible && !document.hidden))) map.triggerRepaint(); };
  const queueFrame = () => {
    if (frame || disposed || failed || motionOff || !visible || document.hidden || !model) return;
    frame = requestAnimationFrame(time => {
      frame = 0;
      if (time - lastTick >= 33) { lastTick = time; requestRender(); }
      queueFrame();
    });
  };
  const releaseModel = () => {
    generation += 1;
    model?.dispose(); model = null;
    renderer?.dispose(); renderer = null;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame); clearTimeout(timeout);
    observer.disconnect(); resize.disconnect();
    document.removeEventListener('visibilitychange', visibilityChange);
    signal?.removeEventListener('abort', abort);
    map.remove(); releaseModel();
  };
  const fail = error => {
    if (failed || disposed) return;
    failed = true;
    const wasReady = ready;
    dispose();
    if (wasReady) onFail(error);
    else rejectReady(error);
  };
  const cameraFor = name => {
    const corners = (frontage?.cameraBoundary || plan.boundary).map(frontagePoint);
    const xs = corners.map(p => p[0]), ys = corners.map(p => p[1]);
    const bounds = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
    const fit = map.cameraForBounds(bounds, { padding: Math.min(host.clientWidth, host.clientHeight) * .12, bearing: defaultBearing });
    const entranceFocus = frontage ? frontage.gate : [plan.entrance.center[0], 1200];
    const centre = name === 'connection' ? frontagePoint(entranceFocus) : name === 'plan' || name === 'nature' ? fit?.center || point([plan.width / 2, plan.height / 2]) : point(plan.roundabout.center);
    return { center: centre, bearing: defaultBearing, pitch: name === 'plan' ? 0 : name === 'nature' ? 45 : 60,
      zoom: name === 'plan' ? fit?.zoom || 17 : name === 'nature' ? (fit?.zoom || 17) - .1 : name === 'connection' ? 19.8 : 19.4 };
  };
  const api = {
    requestRender,
    preset: name => { map.stop(); const camera = cameraFor(name); if (motionOff) map.jumpTo(camera); else map.easeTo({ ...camera, duration: 700 }); },
    paintPlots: list => { latestRecords = list; model?.paintPlots(list); requestRender(); },
    zoom: factor => map.easeTo({ zoom: THREE.MathUtils.clamp(map.getZoom() + Math.log2(factor), 3, 22), duration: motionOff ? 0 : 180 }),
    rotate: (amount, vertical = false) => map.easeTo(vertical
      ? { pitch: THREE.MathUtils.clamp(map.getPitch() - THREE.MathUtils.radToDeg(amount), 0, 75), duration: motionOff ? 0 : 150 }
      : { bearing: map.getBearing() + THREE.MathUtils.radToDeg(amount), duration: motionOff ? 0 : 150 }),
    pan: (dx, dy) => map.panBy([-dx, -dy], { duration: motionOff ? 0 : 150 }),
    setReducedMotion: flag => { motionOff = flag; map.stop(); cancelAnimationFrame(frame); frame = 0; requestRender(); queueFrame(); },
    dispose,
  };
  const layer = {
    id: 'river-green-colony', type: 'custom', renderingMode: '3d',
    onAdd: (_, gl) => {
      const currentGeneration = generation;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, ...gl.getContextAttributes() });
        renderer.autoClear = false;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
        renderer.resetState();
        buildColonyModel({ renderer, plan: modelPlan, statusColours, records: latestRecords, mapMode: true, siteFit, baseSiteFit, basePlan, frontage,
          quality: { tier: 'medium', density: .6, shadowMapSize: 2048 }, requestRender })
          .then(value => {
            if (disposed || failed || currentGeneration !== generation) { value.dispose(); return; }
            model = value;
            if (siteFit) applyColonyMapFit(model, siteFit);
            model.paintPlots(latestRecords); renderer.resetState(); requestRender(); queueFrame();
          }).catch(fail);
      } catch (error) { fail(error); }
    },
    render: (_, args) => {
      if (!model || !renderer || disposed || failed) return;
      const time = performance.now(), delta = Math.min((time - lastDraw) / 1000, .05); lastDraw = time;
      try {
        updateMapCamera(model.camera, args, transform);
        renderer.resetState();
        renderer.setViewport(0, 0, map.getCanvas().width, map.getCanvas().height);
        model.update(motionOff ? 0 : time / 1000, delta);
        renderer.render(model.scene, model.camera);
        if (!ready) { ready = true; clearTimeout(timeout); resolveReady(api); }
      } catch (error) { fail(error); }
      finally { renderer?.resetState(); }
    },
    onRemove: releaseModel,
  };
  const updateTimeout = () => {
    clearTimeout(timeout);
    if (!ready && !disposed && visible && !document.hidden) timeout = setTimeout(() => fail(new Error('The surrounding map could not be loaded.')), 20000);
  };
  const visibilityChange = () => { cancelAnimationFrame(frame); frame = 0; updateTimeout(); requestRender(); queueFrame(); };
  const abort = () => fail(new DOMException('The colony view was closed.', 'AbortError'));
  signal?.addEventListener('abort', abort, { once: true });
  document.addEventListener('visibilitychange', visibilityChange);
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visibilityChange(); }); observer.observe(host);
  const resize = new ResizeObserver(() => { if (!disposed) map.resize(); }); resize.observe(host);
  updateTimeout();
  // Style readiness is enough for a custom layer. Waiting for `load` also
  // waits for every initial satellite tile, hiding a ready 3D colony behind
  // a slow imagery request. Set the final camera before fetching those tiles.
  map.jumpTo(cameraFor(view));
  map.once('style.load', () => { if (!disposed) map.addLayer(layer); });
  // Temporary missing tiles do not discard an already usable map. A failure
  // to load the style itself does prevent the colony layer from being added.
  map.on('error', event => { if (!ready && event.error?.status && !map.getStyle()) fail(event.error); });
  map.on('dragstart', () => onDragChange(true)); map.on('dragend', () => onDragChange(false));
  map.on('webglcontextlost', () => fail(new Error('The live map lost its graphics context.')));
  return completion;
}
