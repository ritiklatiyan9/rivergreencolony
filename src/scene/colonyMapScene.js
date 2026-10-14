import * as THREE from 'three';
import { Map as MapLibreMap, MercatorCoordinate, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { colonyPointToLatLng, getColonySiteFit, RIVER_GREEN_FRONTAGE } from '../data/colonyLocation.js';
import { createColonyFrontage, createFrontageShopPlacement, createExpandedInteriorFit } from '../data/colonyFrontage.js';
import { createCommercialApron } from '../data/frontCommercialApron.js';
import { buildColonyModel, preloadColonyModules } from './colonyModel.js';
import { createColonyMapFrame } from './colonyMapFrame.js';
import { createColonyMapTransform } from './colonyMapPlacement.js';
import { applyColonyMapFit } from './colonyMapFit.js';
import { prepareMapPlan, mercatorLocation } from '../data/colonySiteFit.js';
import { HEIGHTS } from './kit.js';
import { createPlotClickGesture, createPlotSurfaces, pickPlotRay } from './colonyPlotPicker.js';
import { NEARBY_PLACES, nearbyPlacesBounds } from '../data/nearbyPlaces.js';
import { createNearbyPlaceBanners } from './nearbyPlaceBanners.js';
import { observePageScroll } from './pageScrollActivity.js';
import { createDroneTourRoute, createDroneTourPlayer, droneOrbitDistance } from './droneTour.js';

setWorkerUrl(workerUrl);
export const preloadColonyMapScene = preloadColonyModules;

// Satellite tiles supply real surroundings. The Three.js
// colony uses the map's WebGL context and camera, so both move together.
export function createColonyMapScene({ host, plan, config, statusColours, records = [], view = 'nature', reducedMotion = false, signal, onFail = () => {}, onDragChange = () => {}, onPlotSelect = () => {}, onPlaceSelect = () => {}, onTourChange = () => {} }) {
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
    frontage.commercialApron = createCommercialApron(frontage);
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
  const plotSurfaces = createPlotSurfaces(modelPlan, { siteFit, shopRows: frontage?.shopRows, groundHeight: HEIGHTS.lawn, shopHeight: HEIGHTS.shopRoof });
  const canvas = map.getCanvas(), clickGesture = createPlotClickGesture();
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const pickSelection = event => {
    if (!ready || !model || disposed || failed) return null;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return null;
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
    ray.setFromCamera(pointer, model.camera);
    const place = placeBanners?.pick(ray);
    if (place) return { place };
    return { plot: pickPlotRay(ray.ray.origin.toArray(), ray.ray.direction.toArray(), plotSurfaces) };
  };
  const pointerDown = event => { tour.pause(); map.stop(); clickGesture.begin(event); };
  const wheel = event => { if (event.ctrlKey || event.metaKey) { tour.pause(); map.stop(); } };
  const pointerMove = event => clickGesture.move(event);
  const pointerUp = event => {
    if (!clickGesture.end(event)) return;
    const selected = pickSelection(event);
    if (selected?.place) api.focusPlace(selected.place);
    else if (selected?.plot) onPlotSelect(selected.plot);
  };
  const pointerCancel = event => { clickGesture.cancel(); clickGesture.end(event); };
  const pickListeners = [['pointerdown', pointerDown], ['pointermove', pointerMove], ['pointerup', pointerUp], ['pointercancel', pointerCancel], ['lostpointercapture', pointerCancel], ['wheel', wheel]];
  pickListeners.forEach(([name, handler]) => canvas.addEventListener(name, handler));
  window.addEventListener('pointerup', pointerUp);
  let renderer, model, placeBanners, placesVisible = true, selectedPlaceId = '', disposed = false, failed = false, visible = true, frame = 0, generation = 0;
  let motionOff = reducedMotion, latestRecords = records, lastTick = 0, ready = false, timeout;
  const drawFrame = createColonyMapFrame(transform);
  let resolveReady, rejectReady;
  const completion = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const requestRender = () => { if (!disposed && !failed && (!ready || (visible && !document.hidden))) map.triggerRepaint(); };
  const queueFrame = () => {
    if (frame || disposed || failed || motionOff || !visible || document.hidden || !model || pageScroll.active) return;
    frame = requestAnimationFrame(time => {
      frame = 0;
      if (time - lastTick >= 33) {
        lastTick = time;
        const camera = ready ? tour.tick(time) : null;
        if (camera) map.jumpTo({ ...camera, padding: 0 });
        requestRender();
      }
      queueFrame();
    });
  };
  const pageScroll = observePageScroll({ isVisible: () => visible && !disposed,
    pause: () => { tour.suspend(); cancelAnimationFrame(frame); frame = 0; },
    resume: () => { requestRender(); queueFrame(); },
  });
  const releaseModel = () => {
    generation += 1;
    placeBanners?.dispose(); placeBanners = null;
    model?.dispose(); model = null;
    renderer?.dispose(); renderer = null;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true; tour.stop(); cancelAnimationFrame(frame); clearTimeout(timeout);
    pageScroll.dispose();
    observer.disconnect(); resize.disconnect();
    document.removeEventListener('visibilitychange', visibilityChange);
    signal?.removeEventListener('abort', abort);
    pickListeners.forEach(([name, handler]) => canvas.removeEventListener(name, handler));
    window.removeEventListener('pointerup', pointerUp); clickGesture.reset();
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
    if (name === 'nearby') {
      const fit = map.cameraForBounds(nearbyPlacesBounds(), { bearing: 0,
        padding: { top: 70, bottom: 65, left: host.clientWidth < 700 ? 35 : 80, right: host.clientWidth < 700 ? 35 : 80 } });
      return { center: fit?.center || point(plan.roundabout.center), zoom: (fit?.zoom || 12) - .3, bearing: 0, pitch: 55, padding: 0 };
    }
    if (name === 'connection' && frontage?.commercialApron) {
      const apron = frontage.commercialApron;
      const frontPoints = [apron.gate, ...apron.shops.flatMap(shop => shop.polygon), apron.entryLine.at(-1)]
        .map(value => locationPoint(mercatorLocation(baseSiteFit.worldToMercator(value))));
      const xs = frontPoints.map(p => p[0]), ys = frontPoints.map(p => p[1]);
      const fit = map.cameraForBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]],
        { padding: Math.min(host.clientWidth, host.clientHeight) * .16, bearing: defaultBearing });
      return { center: fit?.center || frontagePoint(frontage.gate), bearing: defaultBearing, padding: 0,
        pitch: 50, zoom: (fit?.zoom || 19) + .05 };
    }
    const corners = (frontage?.cameraBoundary || plan.boundary).map(frontagePoint);
    if (frontage?.commercialApron) corners.push(...frontage.commercialApron.cameraBoundary.map(value =>
      locationPoint(mercatorLocation(baseSiteFit.worldToMercator(value)))));
    const xs = corners.map(p => p[0]), ys = corners.map(p => p[1]);
    const bounds = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
    const fit = map.cameraForBounds(bounds, { padding: Math.min(host.clientWidth, host.clientHeight) * .12, bearing: defaultBearing });
    if (name === 'nature') {
      // Keep close-up framing stable while fitting the panorama to its actual
      // footprint radius, including the H-shop apron, at every camera bearing.
      const zooms = Array.from({ length: 8 }, (_, i) => map.cameraForBounds(bounds,
        { padding: Math.min(host.clientWidth, host.clientHeight) * .12, bearing: i * 45 })?.zoom).filter(Number.isFinite);
      const center = fit?.center || point(plan.roundabout.center), origin = MercatorCoordinate.fromLngLat(center);
      const radius = Math.max(...corners.map(value => { const p = MercatorCoordinate.fromLngLat(value); return Math.hypot(p.x - origin.x, p.y - origin.y); }));
      const fov = map.getVerticalFieldOfView(), height = Math.max(host.clientHeight, 1);
      const distance = droneOrbitDistance({ radius, aspect: Math.max(host.clientWidth, 1) / height, fov });
      const zoom = Math.log2(height / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2)) / distance / 512);
      return { center, bearing: defaultBearing, padding: 0, pitch: 50, zoom,
        shotZoom: (zooms.length ? Math.min(...zooms) : fit?.zoom || 17) - .45 };
    }
    if (name === 'booking' && frontage?.commercialApron) return { center: fit?.center || point(plan.roundabout.center),
      bearing: defaultBearing, padding: 0, pitch: 45, zoom: (fit?.zoom || 17) + .05 };
    if (name === 'booking') return { center: point(plan.roundabout.center),
      bearing: defaultBearing, padding: { top: 0, right: 0, bottom: host.clientHeight * .2, left: host.clientWidth * .05 },
      pitch: 60, zoom: Math.min(19, (fit?.zoom || 17) + 1.2) };
    const entranceFocus = frontage ? frontage.gate : [plan.entrance.center[0], 1200];
    const centre = name === 'connection' ? frontagePoint(entranceFocus) : name === 'plan' || name === 'nature' ? fit?.center || point([plan.width / 2, plan.height / 2]) : point(plan.roundabout.center);
    return { center: centre, bearing: defaultBearing, padding: 0, pitch: name === 'plan' ? 0 : name === 'nature' ? 45 : 60,
      zoom: name === 'plan' ? fit?.zoom || 17 : name === 'nature' ? (fit?.zoom || 17) - .1 : name === 'connection' ? 19.8 : 19.4 };
  };
  const readCamera = () => ({ center: map.getCenter().toArray(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() });
  const coordinates = value => Array.isArray(value) ? value : locationPoint(value);
  const tourRoute = () => {
    const aerialCamera = cameraFor('nature'), entranceCamera = cameraFor('connection');
    return createDroneTourRoute({ plan: modelPlan, project: point,
      overview: { ...aerialCamera, center: coordinates(aerialCamera.center) },
      heading: config.heading,
      entry: frontage ? { center: frontagePoint(frontage.gate), zoom: aerialCamera.shotZoom + 1.65, bearing: config.heading, pitch: 62 } : undefined,
      forecourt: frontage?.commercialApron ? { ...entranceCamera, center: coordinates(entranceCamera.center), bearing: config.heading + 35, pitch: 58 } : undefined,
    });
  };
  const tour = createDroneTourPlayer(tourRoute(), onTourChange);
  const startTour = () => {
    map.stop();
    const camera = tour.start(readCamera(), motionOff);
    if (motionOff) map.jumpTo({ ...camera, padding: 0 });
    requestRender(); queueFrame();
  };
  const api = {
    requestRender,
    preset: name => { selectedPlaceId = ''; placeBanners?.select(''); if (name === 'nature') { startTour(); return; } tour.stop(); map.stop(); const camera = cameraFor(name); if (motionOff) map.jumpTo(camera); else map.easeTo({ ...camera, duration: 700 }); },
    pauseTour: () => { tour.pause(); map.stop(); },
    resumeTour: () => { if (motionOff) return; map.stop(); tour.resume(readCamera()); requestRender(); queueFrame(); },
    nextTourStop: () => { map.stop(); const camera = tour.next(readCamera()); if (camera) map.jumpTo({ ...camera, padding: 0 }); requestRender(); queueFrame(); },
    focusPlace: id => {
      const place = NEARBY_PLACES.find(value => value.id === id);
      if (!place) return;
      tour.stop();
      selectedPlaceId = id; placesVisible = true; placeBanners?.select(id); placeBanners?.setVisible(true); onPlaceSelect(id);
      map.stop();
      const camera = { center: [place.lng, place.lat], zoom: 17.8, bearing: -18, pitch: 62,
        padding: { top: Math.min(160, host.clientHeight * .3), bottom: 0, left: 0, right: 0 } };
      if (motionOff) map.jumpTo(camera); else map.flyTo({ ...camera, duration: 1100 });
    },
    setPlacesVisible: value => { placesVisible = value; placeBanners?.setVisible(value); requestRender(); },
    paintPlots: list => { latestRecords = list; model?.paintPlots(list); requestRender(); },
    zoom: factor => { tour.pause(); map.easeTo({ zoom: THREE.MathUtils.clamp(map.getZoom() + Math.log2(factor), 3, 22), duration: motionOff ? 0 : 180 }); },
    rotate: (amount, vertical = false) => { tour.pause(); map.easeTo(vertical
      ? { pitch: THREE.MathUtils.clamp(map.getPitch() - THREE.MathUtils.radToDeg(amount), 0, 75), duration: motionOff ? 0 : 150 }
      : { bearing: map.getBearing() + THREE.MathUtils.radToDeg(amount), duration: motionOff ? 0 : 150 }); },
    pan: (dx, dy) => { tour.pause(); map.panBy([-dx, -dy], { duration: motionOff ? 0 : 150 }); },
    setReducedMotion: flag => { motionOff = flag; if (flag) tour.pause(); tour.suspend(); map.stop(); cancelAnimationFrame(frame); frame = 0; requestRender(); queueFrame(); },
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
            placeBanners = createNearbyPlaceBanners({ scene: model.scene, transform, anchor, heading: config.heading });
            placeBanners.setVisible(placesVisible); placeBanners.select(selectedPlaceId);
            model.paintPlots(latestRecords); renderer.resetState(); requestRender(); queueFrame();
          }).catch(fail);
      } catch (error) { fail(error); }
    },
    render: (_, args) => {
      if (!model || !renderer || disposed || failed || !visible || document.hidden) return;
      try {
        drawFrame({ model, renderer, args, canvas: map.getCanvas(), time: performance.now(), paused: pageScroll.active, reducedMotion: motionOff });
        if (!ready) { ready = true; clearTimeout(timeout); if (view === 'nature') startTour(); resolveReady(api); }
      } catch (error) { fail(error); }
      finally { renderer?.resetState(); }
    },
    onRemove: releaseModel,
  };
  const updateTimeout = () => {
    clearTimeout(timeout);
    if (!ready && !disposed && visible && !document.hidden) timeout = setTimeout(() => fail(new Error('The surrounding map could not be loaded.')), 20000);
  };
  const visibilityChange = () => { tour.suspend(); cancelAnimationFrame(frame); frame = 0; updateTimeout(); requestRender(); queueFrame(); };
  const abort = () => fail(new DOMException('The colony view was closed.', 'AbortError'));
  signal?.addEventListener('abort', abort, { once: true });
  document.addEventListener('visibilitychange', visibilityChange);
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visibilityChange(); }); observer.observe(host);
  let tourSize = `${host.clientWidth}x${host.clientHeight}`;
  const resize = new ResizeObserver(() => {
    if (disposed) return;
    map.resize();
    const size = `${host.clientWidth}x${host.clientHeight}`;
    if (size !== tourSize) { tourSize = size; tour.reframe(tourRoute(), readCamera()); }
  }); resize.observe(host);
  updateTimeout();
  // Style readiness is enough for a custom layer. Waiting for `load` also
  // waits for every initial satellite tile, hiding a ready 3D colony behind
  // a slow imagery request. Set the final camera before fetching those tiles.
  map.jumpTo(cameraFor(view));
  map.once('style.load', () => { if (!disposed) map.addLayer(layer); });
  // Temporary missing tiles do not discard an already usable map. A failure
  // to load the style itself does prevent the colony layer from being added.
  map.on('error', event => { if (!ready && event.error?.status && !map.getStyle()) fail(event.error); });
  map.on('dragstart', () => { clickGesture.cancel(); onDragChange(true); }); map.on('dragend', () => onDragChange(false));
  map.on('rotatestart', () => clickGesture.cancel()); map.on('zoomstart', () => clickGesture.cancel());
  map.on('movestart', event => { if (event.originalEvent) tour.pause(); });
  map.on('webglcontextlost', () => fail(new Error('The live map lost its graphics context.')));
  return completion;
}
