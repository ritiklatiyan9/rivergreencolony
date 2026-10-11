// Farmland and the world outside the colony wall: field patchwork to the
// horizon, sugarcane blocks, tree belts, villages, poles and Shamli Road.
import buildFields from './countryside-fields.js';
import buildCane from './countryside-cane.js';
import buildTrees from './countryside-trees.js';
import { fieldsAround, colonyHalfPlanes, outsidePieces } from './countryside-layout.js';

export default function buildCountryside(ctx) {
  const { THREE, plan, world, scene } = ctx;
  const started = performance.now();
  const land = new THREE.Group(); land.name = 'countryside'; scene.add(land);
  const local = { ...ctx, scene: land };
  buildFields(local);
  const planes = colonyHalfPlanes(plan.boundary.map(world), .5);
  planes[0][2] += 1.05; // north edge: room for the Chakroad and its tree row (chakroad.js)
  const cane = buildCane(local, fieldsAround(60), planes, outsidePieces);
  const trees = buildTrees(local, planes);
  // Dev-only cost report: open the page with ?cstats to log it as a warning.
  if (import.meta.env?.DEV && /[?&]cstats/.test(window.location.search)) {
    let triangles = 0, calls = 0;
    land.traverse((o) => { if (!o.isMesh) return; const g = o.geometry, n = (g.index ? g.index.count : g.getAttribute('position').count) / 3; triangles += n * (o.isInstancedMesh ? o.count : 1); calls += 1; });
    console.warn('[countryside] stats', JSON.stringify({ ms: Math.round(performance.now() - started), triangles: Math.round(triangles), meshes: calls, cane, trees: trees.trees }));
  }
  return { dispose: () => scene.remove(land) };
}
