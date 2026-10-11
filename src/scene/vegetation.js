// Trees, palms, shrubs and hedges. Mature canopy trees ring the perimeter
// wall (sceneLandscape.js), the corner park is planted richly, and young fruit
// trees line the road-facing edges of the residential plots. Every plant
// archetype is one InstancedMesh (one draw call); foliage sways with ctx.wind.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pointInPolygon } from '../data/sceneLandscape.js';
import { layoutVegetation } from './vegetation-layout.js';
import { makeFoliageTextures, TILE } from './vegetation-textures.js';
import { broadleaf } from './vegetation-trees.js';
import { hedgeBox, palm } from './vegetation-palms.js';
import { chakroadLayout } from './chakroad.js';
import { builtPlotNumbers, villaSites } from './sitePlots.js';

export default function buildVegetation(ctx) {
  const { THREE, kit, world, root, plan, landscape, wind, quality, HEIGHTS, SCALE } = ctx;
  const random = kit.rng(4242), layout = layoutVegetation(plan, landscape, quality.density);
  const { atlas, hedgeMap } = makeFoliageTextures(kit);

  // Foliage: alpha-cut cards, bent normals kept on both faces, per-instance
  // tint on leaves only, gusts that grow with height plus a leaf flutter.
  const foliage = kit.material('#ffffff', { map: atlas, vertexColors: true, alphaTest: .42, side: THREE.DoubleSide, roughness: .8 });
  foliage.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind;
    shader.vertexShader = 'uniform float uTime;\nattribute float aLeaf;\n' + shader.vertexShader
      .replace('#include <color_vertex>', `vColor = color;
        #ifdef USE_INSTANCING_COLOR
        vColor *= mix(vec3(1.0), instanceColor, aLeaf);
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 anchor = instanceMatrix[3].xyz, windDir = normalize(transpose(mat3(instanceMatrix)) * vec3(1.0, 0.0, 0.35));
        float gust = sin(uTime * 1.1 + anchor.x * .4 + anchor.z * .25) * .6 + sin(uTime * 2.3 + anchor.z * 1.1) * .25 + .3;
        transformed += windDir * gust * .02 * position.y * position.y;
        transformed += aLeaf * .005 * sin(uTime * 5.0 + dot(position, vec3(41.0, 29.0, 37.0)) + anchor.x * 7.0) * vec3(1.0, .5, 1.0);
        #endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  // ponytail: no customDepthMaterial — three builds an alpha-tested depth variant itself when map + alphaTest are set.

  const surface = (point) => plan.plots.some(plot => pointInPolygon(point, plot.geometry.polygon)) ? HEIGHTS.lawn
    : plan.landscaping.some(({ polygon }) => pointInPolygon(point, polygon)) ? HEIGHTS.garden : HEIGHTS.ground + .002;
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  // Each plant is sized from its tested canopy radius (plan units): the
  // archetype's measured spread times its scale never exceeds it.
  const plant = (geometry, items, { brightness = 1, min = 0, max = 9 } = {}) => {
    const mesh = new THREE.InstancedMesh(kit.geometry(geometry), foliage, Math.max(items.length, 1)); mesh.count = items.length;
    const p = geometry.getAttribute('position'); let spread = 0;
    for (let i = 0; i < p.count; i += 1) spread = Math.max(spread, Math.hypot(p.getX(i), p.getZ(i)));
    items.forEach(({ point, radius }, i) => {
      const [x, z] = world(point), warm = random() - .5, light = brightness * (.9 + random() * .25), sx = .92 + random() * .12, sz = .94 + random() * .12;
      const height = Math.min(max, Math.max(min * (.95 + random() * .1), radius * SCALE / (spread * Math.max(sx, sz))));
      dummy.position.set(x, surface(point) - .003, z); dummy.rotation.set(0, random() * Math.PI * 2, 0); dummy.scale.set(height * sx, height, height * sz); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, tint.setRGB(light * (1 + warm * .22), light, light * (1 - warm * .4)));
    });
    mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  const split = (items, n) => Array.from({ length: n }, (_, k) => items.filter((_, i) => i % n === k));
  const detail = quality.density;

  // Mature canopy trees (mango / neem) on the perimeter and in the corner park.
  // The north side has none inside: as on the printed plan, an alternating
  // mango / neem row lines the far side of the Chakroad instead.
  const north = chakroadLayout(plan), [na, nb] = plan.boundary, nLength = Math.hypot(nb[0] - na[0], nb[1] - na[1]);
  const fromNorth = ([x, y]) => ((x - na[0]) * (nb[1] - na[1]) - (y - na[1]) * (nb[0] - na[0])) / nLength;
  // Villa plots have walls, houses and their own garden trees instead.
  const villaPlots = plan.plots.filter(plot => builtPlotNumbers.has(plot.number)).map(plot => plot.geometry.polygon);
  const perimeter = landscape.trees.filter(({ point }) => Math.abs(fromNorth(point)) > 40 && !villaPlots.some(polygon => pointInPolygon(point, polygon)));
  const [mangoes, neems] = split([...perimeter, ...layout.groves], 2);
  // The live basemap supplies everything beyond the colony boundary.
  if (!ctx.mapMode) north.trees.forEach(tree => (tree.kind ? neems : mangoes).push(tree));
  plant(broadleaf({ seed: 11, tile: TILE.mango, rx: .46, ry: .33, clumps: 9, cards: Math.round(900 * detail), card: .085, trunkRadius: .032, branches: 5 }), mangoes, { max: .72 });
  plant(broadleaf({ seed: 23, tiles: [TILE.neem, TILE.neem, TILE.mango], rx: .42, ry: .36, clumps: 10, cards: Math.round(1000 * detail), card: .08, trunkRadius: .03, branches: 5 }), neems, { max: .72 });

  // Young fruit trees on the plots, and the villa gardens' ornamental trees.
  const gardens = villaSites(plan).flatMap(site => site.trees.map(({ x, y, radius }) => ({ point: site.toPlan(x, y), radius: radius / SCALE })));
  const [youngA, youngB] = split([...layout.saplings, ...gardens], 2);
  plant(broadleaf({ seed: 5, tile: TILE.mango, rx: .3, ry: .3, clumps: 5, cards: Math.round(170 * detail) + 50, card: .085, trunkRadius: .018, branches: 3, coreDetail: 0 }), youngA, { brightness: 1.3, max: .3 });
  plant(broadleaf({ seed: 9, tiles: [TILE.neem, TILE.mango], rx: .28, ry: .32, clumps: 5, cards: Math.round(170 * detail) + 50, card: .085, trunkRadius: .017, branches: 3, coreDetail: 0 }), youngB, { brightness: 1.3, max: .3 });

  // Flowering shrubs in the corner park.
  plant(broadleaf({ seed: 41, tiles: [TILE.bloom, TILE.bloom, TILE.mango], rx: .55, ry: .45, lift: .02, clumps: 5, cards: 160, card: .14, coreDetail: 0 }), layout.blooms, { brightness: 1.1 });

  // Garden palms: tall and slender, fronds well inside the tested radius.
  plant(palm({ seed: 7, trunk: .82, fronds: 16, length: .36, droop: .5, width: .22, tile: TILE.frond }), layout.palms, { min: .82, max: .98 });

  // Clipped boxwood hedges (merged; world-space leaf texture so sizes never stretch it).
  const noise = kit.makeNoise(17);
  const hedgeParts = layout.shrubs.map(({ point }, i) => {
    const [x, z] = world(point), g = hedgeBox(.24, .115, .095, .03, noise, i * 3.1);
    g.translate(x, surface(point), z);
    const anchors = new Float32Array(g.getAttribute('position').count * 2);
    for (let k = 0; k < anchors.length; k += 2) { anchors[k] = x; anchors[k + 1] = z; }
    g.setAttribute('aColonyMapAnchor', new THREE.BufferAttribute(anchors, 2));
    return g;
  });
  if (hedgeParts.length) {
    const hedges = kit.geometry(mergeGeometries(hedgeParts)); hedgeParts.forEach(g => g.dispose());
    const hedge = kit.material('#ffffff', { map: hedgeMap, vertexColors: true, roughness: .9 });
    hedge.onBeforeCompile = (shader) => {
      shader.vertexShader = 'varying vec3 vHedgePos;\nvarying vec3 vHedgeNormal;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHedgePos = (modelMatrix * vec4(position, 1.0)).xyz; vHedgeNormal = normal;');
      shader.fragmentShader = 'varying vec3 vHedgePos;\nvarying vec3 vHedgeNormal;\n' + shader.fragmentShader.replace('#include <map_fragment>', `vec3 tw = pow(abs(vHedgeNormal), vec3(4.0)); tw /= dot(tw, vec3(1.0));
        diffuseColor *= texture2D(map, vHedgePos.zy * 12.0) * tw.x + texture2D(map, vHedgePos.xz * 12.0) * tw.y + texture2D(map, vHedgePos.xy * 12.0) * tw.z;`);
    };
    const hedgeMesh = kit.mesh(hedges, hedge, root);
    hedgeMesh.userData.colonyMapFit = { mode: 'rigid' };
  }
  return {};
}
