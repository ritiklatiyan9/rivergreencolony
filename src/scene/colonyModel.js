// Colony content without a renderer, camera controls or a render loop. The
// MapLibre adapter supplies the renderer and georeferenced camera matrix.
// Keep all model coordinates in their original units: procedural materials
// compare world positions with the plan's road and fountain coordinates.
import * as THREE from 'three';
import { createKit, HEIGHTS, M, SCALE } from './kit.js';
import { buildLandscape } from '../data/sceneLandscape.js';

const MODULES = [
  ['sky', () => import('./sky.js')],
  ['ground', () => import('./ground.js')],
  ['architecture', () => import('./architecture.js')],
  ['plaza', () => import('./plaza.js')],
  ['vegetation', () => import('./vegetation.js')],
  ['life', () => import('./life.js')],
];

let modulesReady;
// Fetch the builders alongside the satellite style, rather than starting a
// second download waterfall only after the map and its tiles have loaded.
export const preloadColonyModules = () => {
  if (!modulesReady) modulesReady = Promise.all(MODULES.map(([, load]) => load())).catch(error => { modulesReady = null; throw error; });
  return modulesReady;
};

export async function buildColonyModel({ renderer, plan, statusColours, records = [], mapMode = true, siteFit = null, baseSiteFit = null, basePlan = null, frontage = null, quality = {}, requestRender = () => {} }) {
  const kit = createKit(renderer, plan);
  const scene = new THREE.Scene();
  const root = new THREE.Group(); scene.add(root);
  const camera = new THREE.PerspectiveCamera();
  const parts = [], updates = [], painters = [];
  let disposed = false, paintedStatuses = null;
  const ctx = {
    THREE, renderer, scene, root, camera, plan, kit, world: kit.world,
    SCALE, M, HEIGHTS, statusColours, mapMode, siteFit, baseSiteFit, basePlan, frontage, requestRender,
    quality: { tier: 'medium', shadowMapSize: 2048, density: .6, ao: false, ...quality },
    landscape: buildLandscape(plan), wind: { value: 0 }, sun: null,
  };
  const paintPlots = (list = []) => {
    if (disposed) return;
    const statuses = new Map(list.map(record => [record.number, record.status]));
    if (paintedStatuses && statuses.size === paintedStatuses.size && [...statuses].every(([number, status]) => paintedStatuses.get(number) === status)) return;
    paintedStatuses = statuses;
    painters.forEach(paint => paint(statuses));
    renderer.shadowMap.needsUpdate = true;
    requestRender();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    parts.forEach(part => { try { part.dispose?.(); } catch (error) { console.error('[colony model] cleanup failed', error); } });
    kit.dispose();
    scene.environment = null;
    scene.clear(); root.clear();
    updates.length = 0; painters.length = 0; parts.length = 0;
    // The supplied renderer and its canvas/context belong to the map adapter.
  };
  try {
    const loaded = await preloadColonyModules();
    for (const [index, module] of loaded.entries()) {
      try {
        const part = module.default(ctx) || {};
        parts.push(part);
        if (part.update) updates.push(part.update);
        if (part.paintPlots) painters.push(part.paintPlots);
      } catch (error) {
        throw new Error(`Unable to build colony ${MODULES[index][0]}`, { cause: error });
      }
      // Let input, scrolling and the page's first paint run between builders.
      if (index < loaded.length - 1) await new Promise(resolve => setTimeout(resolve, 0));
    }
    paintPlots(records);
  } catch (error) {
    dispose(); throw error;
  }
  return {
    scene, root, camera, ctx, paintPlots,
    update: (seconds = 0, delta = 0) => {
      if (disposed) return;
      ctx.wind.value = seconds;
      updates.forEach(update => update(seconds, delta));
    },
    dispose,
  };
}
