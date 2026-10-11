// Colony ground: concrete roads with terracotta brick edge bands (and a white
// dashed centre line on the boulevard), the circular roundabout, the paved shop
// forecourt, soil plots and green gardens, plot edging, live availability
// (a coloured outline and light wash; unconfirmed plots stay natural soil) and plot
// numbers. Surfaces are shaded procedurally in world space, so nothing tiles.
// Shops are built by architecture.js.
import { lawnMaterial, soilMaterial, proceduralMaterial, uniform } from './kit.js';
import { isPlazaGarden, plazaLayout } from './plazaLayout.js';
import { villaSites } from './sitePlots.js';

export default function buildGround(ctx) {
  const { THREE, plan, kit, world, SCALE, HEIGHTS, root, statusColours } = ctx;
  const linear = (hex) => new THREE.Color(hex);

  const lawn = lawnMaterial(kit), soil = soilMaterial(kit);

  // Roads. aRoad = (along, across, half width) in world units; the boulevard
  // adds a white dashed centre line and opens its edge bands at the crossroad mouths.
  const roadUniforms = {
    uConcrete: uniform('vec3', linear('#d6d2c9')), uBrick: uniform('vec3', linear('#b4523c')), uBrickAlt: uniform('vec3', linear('#c96b50')), uCurb: uniform('vec3', linear('#ece9e1')),
    uRoundabout: uniform('vec4', new THREE.Vector4(...world(plan.roundabout.center), plan.roundabout.width * SCALE / 2, plan.roundabout.width * SCALE / 2)),
    uWest: uniform('vec2', []), uEast: uniform('vec2', []),
  };
  const roadSurface = `
    float along = vRoad.x, across = vRoad.y, halfWidth = vRoad.z, edge = halfWidth - abs(across);
    vec2 p = vWorld.xz;
    vec3 concrete = uConcrete * (0.9 + 0.12 * rgFbm(p * 2.6)) * (0.96 + 0.08 * rgFine(p * 75.0));
    concrete *= 1.0 - 0.07 * smoothstep(0.55, 0.8, rgFbm(p * 0.9 + 11.0));
    float joints = max(rgLine(along, 0.36, 0.0022), rgLine(across, 1000.0, 0.0018) * step(0.2, halfWidth));
    vec3 colour = concrete * (1.0 - 0.38 * joints);
    float band = 0.042 + 0.01 * rgTri(along / 0.038);
    float banded = 1.0;
    #ifdef BOULEVARD
    for (int i = 0; i < 8; i++) {
      vec2 w = uWest[i], e = uEast[i];
      if (across < 0.0 && along > w.x && along < w.y) banded = 0.0;
      if (across > 0.0 && along > e.x && along < e.y) banded = 0.0;
    }
    #endif
    vec2 rq = (p - uRoundabout.xy) / uRoundabout.zw;
    banded *= step(1.02, length(rq));
    if (edge < band && banded > 0.5) {
      vec2 brick = vec2(along / 0.022 + (fract(floor(edge / 0.011) * 0.5) * 0.5) * 2.0, edge / 0.011);
      float id = rgHash(floor(brick));
      vec3 b = mix(uBrick, uBrickAlt, id) * (0.86 + 0.18 * rgFine(p * 60.0));
      float mortar = max(rgLine(brick.x, 1.0, 0.04), rgLine(brick.y, 1.0, 0.06));
      colour = mix(b, uCurb * 0.8, mortar * 0.55);
      if (edge < 0.007) colour = uCurb * (0.92 + 0.08 * rgFine(p * 90.0));
    }
    #ifdef BOULEVARD
    // White dashed centre line between the palm planters, as on the printed plan.
    float dashAA = fwidth(across) + 0.0005, dash = 1.0 - smoothstep(0.0065 - dashAA, 0.0065 + dashAA, abs(across));
    dash *= smoothstep(0.0, 0.02, fract(along / 0.34)) * (1.0 - smoothstep(0.17, 0.19, fract(along / 0.34)));
    colour = mix(colour, vec3(0.93, 0.93, 0.9) * (0.92 + 0.08 * rgFine(p * 90.0)), dash * step(1.0, length(rq)));
    #endif
    diffuseColor.rgb = colour;`;
  const roadOptions = { uniforms: roadUniforms, attributes: 'attribute vec3 aRoad;', varyings: 'varying vec3 vRoad;', vertex: 'vRoad = aRoad;', surface: roadSurface };
  const boulevardMaterial = proceduralMaterial(kit, { ...roadOptions, defines: { BOULEVARD: '' }, roughness: .92 });
  const crossroadMaterial = proceduralMaterial(kit, { ...roadOptions, roughness: .92 });

  // Shop forecourt: light interlocking pavers.
  const forecourtMaterial = proceduralMaterial(kit, {
    uniforms: { uPaver: uniform('vec3', linear('#cfc9bd')), uPaverAlt: uniform('vec3', linear('#bdb5a6')) },
    surface: `
      vec2 p = vWorld.xz; vec2 q = p / vec2(0.024, 0.012); q.x += step(1.0, mod(floor(q.y), 2.0)) * 0.5;
      float id = rgHash(floor(q));
      vec3 c = mix(uPaver, uPaverAlt, id * 0.7) * (0.92 + 0.1 * rgFbm(p * 3.0)) * (0.95 + 0.08 * rgFine(p * 90.0));
      c *= 1.0 - 0.3 * max(rgLine(q.x, 1.0, 0.04), rgLine(q.y, 1.0, 0.06));
      diffuseColor.rgb = c;`,
    roughness: .95,
  });

  // Road geometry with per-vertex road coordinates.
  const roadGeometry = (roads, axis) => {
    const positions = [], params = [];
    roads.forEach(({ polygon }) => {
      const shape = new THREE.ShapeGeometry(kit.shapeFromPolygon(polygon)); shape.rotateX(-Math.PI / 2);
      const index = shape.getIndex(), p = shape.getAttribute('position');
      const pts = polygon.map(world), xs = pts.map(q => q[0]), zs = pts.map(q => q[1]);
      const [lo, hi] = axis === 'z' ? [Math.min(...xs), Math.max(...xs)] : [Math.min(...zs), Math.max(...zs)];
      const centre = (lo + hi) / 2, half = (hi - lo) / 2;
      for (let i = 0; i < index.count; i += 1) {
        const v = index.getX(i), x = p.getX(v), z = p.getZ(v);
        positions.push(x, 0, z); params.push(axis === 'z' ? z : x, (axis === 'z' ? x : z) - centre, half);
      }
      shape.dispose();
    });
    const value = kit.geometry(new THREE.BufferGeometry());
    value.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); value.setAttribute('aRoad', new THREE.Float32BufferAttribute(params, 3));
    value.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    value.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(positions.length / 3 * 2).fill(0), 2));
    return value;
  };
  const boulevard = plan.roads.filter(road => road.kind === 'boulevard'), crossroads = plan.roads.filter(road => road.kind === 'crossroad'), frontage = plan.roads.filter(road => road.kind === 'frontage');
  const [bLeft, bRight] = [Math.min(...boulevard[0].polygon.map(q => q[0])), Math.max(...boulevard[0].polygon.map(q => q[0]))];
  const mouths = (side) => {
    const list = crossroads.filter(({ polygon }) => polygon.some(([x]) => Math.abs(x - side) < 1)).map(({ polygon }) => {
      const ys = polygon.map(q => q[1]); return new THREE.Vector2(world([0, Math.min(...ys)])[1] - .004, world([0, Math.max(...ys)])[1] + .004);
    });
    while (list.length < 8) list.push(new THREE.Vector2(1e4, 1e4));
    return list.slice(0, 8);
  };
  roadUniforms.uWest.value = mouths(bLeft); roadUniforms.uEast.value = mouths(bRight);
  roadUniforms.uWest.type = 'vec2'; roadUniforms.uEast.type = 'vec2';
  // GLSL array declarations: patch the uniform lines.
  const arrayFix = (material) => { const compile = material.onBeforeCompile; material.onBeforeCompile = (shader) => { compile(shader); shader.fragmentShader = shader.fragmentShader.replace('uniform vec2 uWest;', 'uniform vec2 uWest[8];').replace('uniform vec2 uEast;', 'uniform vec2 uEast[8];'); }; };
  arrayFix(boulevardMaterial); arrayFix(crossroadMaterial);
  const addRoad = (geometryValue, material, y) => { const value = kit.mesh(geometryValue, material, root, { cast: false }); value.position.y = y; return value; };
  addRoad(roadGeometry(boulevard, 'z'), boulevardMaterial, HEIGHTS.road);
  addRoad(roadGeometry(crossroads, 'x'), crossroadMaterial, HEIGHTS.road);
  frontage.forEach(road => kit.flatPolygon(road.polygon, forecourtMaterial, HEIGHTS.forecourt, root));

  const [fx, fz] = world(plan.roundabout.center);
  // The plaza round the fountain, as in the project photos: grey interlocking
  // dog-bone pavers right up to the pool, with red paver stripes on the
  // boulevard axis leading into the fountain.
  const ringMaterial = proceduralMaterial(kit, {
    uniforms: { uPaver: uniform('vec3', linear('#c2baab')), uPaverAlt: uniform('vec3', linear('#a8a093')), uRed: uniform('vec3', linear('#a8473a')), uRedAlt: uniform('vec3', linear('#8b382e')), uCentre: uniform('vec2', new THREE.Vector2(fx, fz)) },
    surface: `
      vec2 p = vWorld.xz, d = p - uCentre; vec2 q = p / vec2(0.0196, 0.0098); q.x += step(1.0, mod(floor(q.y), 2.0)) * 0.5;
      float id = rgHash(floor(q)); vec2 f = fract(q);
      float joint = max(rgLine(q.x, 1.0, 0.045), rgLine(q.y, 1.0, 0.07));
      // Dog-bone waist: short notches at the middle of each paver's long sides (faded with distance).
      joint = max(joint, step(abs(f.x - 0.5), 0.03) * (step(f.y, 0.18) + step(0.82, f.y)) * clamp(1.0 - fwidth(q.x) * 4.0, 0.0, 1.0));
      bool red = abs(d.x) < 0.065;
      vec3 c = red ? mix(uRed, uRedAlt, id) : mix(uPaver, uPaverAlt, id * 0.8);
      c *= (0.9 + 0.12 * rgFbm(p * 3.0)) * (0.95 + 0.08 * rgFine(p * 90.0));
      diffuseColor.rgb = c * (1.0 - 0.32 * joint);`,
    roughness: .92,
  });
  const ring = kit.mesh(kit.geometry(new THREE.CircleGeometry(plan.roundabout.width * SCALE / 2, 128)), ringMaterial, root, { cast: false });
  ring.userData.colonyMapFit = { mode: 'rigid', anchor: [fx, fz] };
  ring.rotation.x = -Math.PI / 2; ring.position.set(fx, HEIGHTS.road + .004, fz);

  // Bare ground and residential cells stay earthy; only landscaped parks
  // receive the lawn material.
  const base = kit.flatPolygon(plan.boundary, soil, HEIGHTS.ground + .002, root); base.name = 'Colony soil base';
  // Plaza gardens lose a concave arc to the roundabout, as on the printed plan.
  const plazaGardens = plazaLayout(plan, ctx.siteFit).gardens;
  plan.landscaping.forEach((garden) => kit.flatPolygon(isPlazaGarden(plan, garden.polygon) ? plazaGardens.find(item => item.polygon === garden.polygon).outline : garden.polygon, lawn, HEIGHTS.garden, root));

  // Residential plots: raised soil with concrete kerb sides (tops and sides
  // split into two merged meshes), plus fine stone edging between plots.
  const residential = plan.plots.filter(plot => !plot.number.startsWith('S'));
  const tops = [], sides = [], edging = [];
  residential.forEach((plot) => {
    const shape = new THREE.ExtrudeGeometry(kit.shapeFromPolygon(plot.geometry.polygon), { depth: HEIGHTS.lawn - .004, bevelEnabled: false, curveSegments: 1 });
    shape.rotateX(-Math.PI / 2); shape.translate(0, .004, 0);
    const p = shape.getAttribute('position'), n = shape.getAttribute('normal');
    for (let i = 0; i < p.count; i += 3) {
      const ny = n.getY(i); if (ny < -.5) continue;
      const out = ny > .5 ? tops : sides; for (let k = 0; k < 3; k += 1) out.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k), n.getX(i + k), n.getY(i + k), n.getZ(i + k));
    }
    shape.dispose();
    const polygon = plot.geometry.polygon;
    polygon.forEach((a, i) => {
      const [ax, az] = world(a), [bx, bz] = world(polygon[(i + 1) % polygon.length]), dx = bx - ax, dz = bz - az;
      edging.push([[Math.hypot(dx, dz) + .006, .0016, .0065], [(ax + bx) / 2, HEIGHTS.lawn + .0008, (az + bz) / 2], -Math.atan2(dz, dx)]);
    });
  });
  const interleaved = (data) => {
    const value = kit.geometry(new THREE.BufferGeometry()), positions = [], normals = [];
    for (let i = 0; i < data.length; i += 6) { positions.push(data[i], data[i + 1], data[i + 2]); normals.push(data[i + 3], data[i + 4], data[i + 5]); }
    value.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); value.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    value.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(positions.length / 3 * 2).fill(0), 2));
    return value;
  };
  const plots = kit.mesh(interleaved(tops), soil, root, { cast: false }); plots.name = 'Residential soil plots';
  kit.mesh(interleaved(sides), kit.material('#d9d5cb', { roughness: .9 }), root, { cast: false });
  const plotEdging = kit.boxes(kit.material('#cdc8b6', { roughness: .9 }), edging, root);
  plotEdging.castShadow = false; plotEdging.userData.colonyMapFit = { mode: 'surface' };

  // Live availability: per plot a translucent wash and a crisp inner outline,
  // merged into one mesh whose vertex alpha paintPlots switches on and off.
  const RING = .046, FILL = .16, LINE = 1;
  const overlayPositions = [], overlayColours = [], overlayIndex = [], overlaySlots = new Map();
  const inset = (points, width) => points.map((point, i) => {
    const prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
    const normal = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; };
    const centre = points.reduce((s, q) => [s[0] + q[0] / points.length, s[1] + q[1] / points.length], [0, 0]);
    let n1 = normal(prev, point), n2 = normal(point, next);
    const towards = (n) => ((centre[0] - point[0]) * n[0] + (centre[1] - point[1]) * n[1] < 0 ? [-n[0], -n[1]] : n);
    n1 = towards(n1); n2 = towards(n2);
    const m = [n1[0] + n2[0], n1[1] + n2[1]], k = width / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [point[0] + m[0] * k, point[1] + m[1] * k];
  });
  residential.forEach((plot) => {
    const outer = plot.geometry.polygon.map(world), inner = inset(outer, RING), start = overlayPositions.length / 3, count = outer.length, y = HEIGHTS.lawn + .0012;
    // Vertex sets: outline outer edge, outline inner edge, then the wash (same points as the inner edge).
    [...outer, ...inner, ...inner].forEach(([x, z]) => { overlayPositions.push(x, y, z); overlayColours.push(1, 1, 1, 0); });
    for (let i = 0; i < count; i += 1) { const j = (i + 1) % count; overlayIndex.push(start + i, start + count + j, start + j, start + i, start + count + i, start + count + j); }
    for (let i = 1; i < count - 1; i += 1) overlayIndex.push(start + 2 * count, start + 2 * count + i + 1, start + 2 * count + i);
    overlaySlots.set(plot.number, { start, count });
  });
  const overlayGeometry = kit.geometry(new THREE.BufferGeometry());
  overlayGeometry.setAttribute('position', new THREE.Float32BufferAttribute(overlayPositions, 3)); overlayGeometry.setAttribute('color', new THREE.Float32BufferAttribute(overlayColours, 4));
  overlayGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(overlayPositions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); overlayGeometry.setIndex(overlayIndex);
  const overlay = kit.mesh(overlayGeometry, kit.material('#ffffff', { vertexColors: true, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), root, { cast: false });
  overlay.renderOrder = 1;
  const overlayColour = overlayGeometry.getAttribute('color');
  const palette = Object.fromEntries(Object.entries(statusColours).map(([status, hex]) => [status, linear(hex)]));

  // Plot numbers: one atlas, one mesh, one draw call. Painted-on white numerals.
  const atlas = kit.canvasTexture(2048, 2048, (c) => {
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '600 54px "Space Grotesk", "DM Sans", system-ui, sans-serif';
    plan.plots.forEach((plot, i) => {
      const x = (i % 16) * 128 + 64, y = Math.floor(i / 16) * 128 + 64, label = plot.number;
      c.shadowColor = 'rgba(10,22,8,.55)'; c.shadowBlur = 6; c.fillStyle = 'rgba(255,255,250,.96)'; c.fillText(label, x, y + 1, 116);
      c.shadowBlur = 0; c.fillText(label, x, y + 1, 116);
    });
  }, { wrap: false });
  const labelPositions = [], labelUVs = [], labelIndices = [], labelAnchors = [], labelRigid = [];
  // Villa plots carry their number on the villa roof (sitePlots.js), the rest on the soil.
  const roofLabels = new Map(villaSites(plan).flatMap(site => site.labels.map(label => [label.number, { ...label, anchor: world(site.toPlan(0, site.villa.y0)) }])));
  plan.plots.forEach((plot, i) => {
    const roof = roofLabels.get(plot.number), [x, z] = world(roof ? roof.point : plot.geometry.center), commercial = plot.number.startsWith('S');
    if (commercial && ctx.frontage?.shopRows) return; // Relocated labels belong to the complete shop row.
    const xs = plot.geometry.polygon.map(p => p[0]), visibleWidth = Math.max(...xs) - Math.min(...xs);
    const width = Math.min(visibleWidth * SCALE * .62, roof ? .3 : .62), height = width, y = roof ? HEIGHTS.lawn + roof.height : commercial ? HEIGHTS.shopRoof + .019 : HEIGHTS.label;
    const ys = plot.geometry.polygon.map(p => p[1]);
    const shopAnchor = commercial ? world([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]) : [0, 0];
    const anchor = roof?.anchor || shopAnchor;
    for (let k = 0; k < 4; k++) { labelAnchors.push(...anchor); labelRigid.push(roof || commercial ? 1 : 0); }
    const start = labelPositions.length / 3; labelPositions.push(x - width / 2, y, z + height / 2, x + width / 2, y, z + height / 2, x + width / 2, y, z - height / 2, x - width / 2, y, z - height / 2);
    const u = i % 16 / 16, v = 1 - (Math.floor(i / 16) + 1) / 16; labelUVs.push(u, v, u + 1 / 16, v, u + 1 / 16, v + 1 / 16, u, v + 1 / 16); labelIndices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  });
  const labelGeometry = kit.geometry(new THREE.BufferGeometry()); labelGeometry.setAttribute('position', new THREE.Float32BufferAttribute(labelPositions, 3)); labelGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(labelUVs, 2)); labelGeometry.setIndex(labelIndices); labelGeometry.computeVertexNormals();
  labelGeometry.setAttribute('aColonyMapAnchor', new THREE.Float32BufferAttribute(labelAnchors, 2));
  labelGeometry.setAttribute('aColonyMapRigid', new THREE.Float32BufferAttribute(labelRigid, 1));
  const labels = kit.mesh(labelGeometry, kit.track(new THREE.MeshBasicMaterial({ map: atlas, transparent: true, depthWrite: false, alphaTest: .02, toneMapped: false })), root, { cast: false, receive: false });
  labels.renderOrder = 2;

  return {
    paintPlots: (statuses) => {
      overlaySlots.forEach(({ start, count }, number) => {
        const status = statuses.get(number), colour = palette[status], shown = colour && status !== 'UNKNOWN';
        for (let i = 0; i < count * 3; i += 1) overlayColour.setXYZW(start + i, colour?.r ?? 1, colour?.g ?? 1, colour?.b ?? 1, shown ? (i < count * 2 ? LINE : FILL) : 0);
      });
      overlayColour.needsUpdate = true;
    },
  };
}
