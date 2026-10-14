// Colony ground: black roads with white centre stripes and circular roundabout, the paved shop
// forecourt, soil plots and green gardens, plot edging, live availability
// (a coloured outline and light wash; unconfirmed plots stay natural soil) and plot
// numbers. Surfaces are shaded procedurally in world space, so nothing tiles.
// Shops are built by architecture.js.
import { lawnMaterial, soilMaterial, proceduralMaterial, uniform } from './kit.js';
import { isPlazaGarden, plazaLayout } from './plazaLayout.js';
import { builtPlotNumbers, villaSites, VILLA_SITES } from './sitePlots.js';
import { availabilityMaterial } from './availabilityMaterial.js';
import { pointInPolygon } from '../data/sceneLandscape.js';

export default function buildGround(ctx) {
  const { THREE, plan, kit, world, SCALE, HEIGHTS, root, statusColours } = ctx;
  const linear = (hex) => new THREE.Color(hex);

  const lawn = lawnMaterial(kit), soil = soilMaterial(kit);
  const villaLawn = lawnMaterial(kit, { dark: '#27652d', light: '#63a841', dry: '#79ad4d' });

  // One black finish covers the complete road width, including junctions.
  const roadMaterial = kit.material('#17191b', { roughness: 1 });

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

  // Merge each set of road polygons into one flat surface.
  const roadGeometry = (roads) => {
    const positions = [];
    roads.forEach(({ polygon }) => {
      const shape = new THREE.ShapeGeometry(kit.shapeFromPolygon(polygon)); shape.rotateX(-Math.PI / 2);
      const index = shape.getIndex(), p = shape.getAttribute('position');
      for (let i = 0; i < index.count; i += 1) {
        const v = index.getX(i), x = p.getX(v), z = p.getZ(v);
        positions.push(x, 0, z);
      }
      shape.dispose();
    });
    const value = kit.geometry(new THREE.BufferGeometry());
    value.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    value.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    value.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(positions.length / 3 * 2).fill(0), 2));
    return value;
  };
  const boulevard = plan.roads.filter(road => road.kind === 'boulevard'), crossroads = plan.roads.filter(road => road.kind === 'crossroad'), frontage = plan.roads.filter(road => road.kind === 'frontage');
  const addRoad = (geometryValue, material, y) => { const value = kit.mesh(geometryValue, material, root, { cast: false }); value.position.y = y; return value; };
  addRoad(roadGeometry(boulevard), roadMaterial, HEIGHTS.road);
  addRoad(roadGeometry(crossroads), roadMaterial, HEIGHTS.road);
  frontage.forEach(road => kit.flatPolygon(road.polygon, forecourtMaterial, HEIGHTS.forecourt, root));

  const [fx, fz] = world(plan.roundabout.center);
  // The circular road around the fountain uses the same uninterrupted black finish.
  const ring = kit.mesh(kit.geometry(new THREE.CircleGeometry(plan.roundabout.width * SCALE / 2, 128)), roadMaterial, root, { cast: false });
  ring.userData.colonyMapFit = { mode: 'rigid', anchor: [fx, fz] };
  ring.rotation.x = -Math.PI / 2; ring.position.set(fx, HEIGHTS.road + .004, fz);

  // Dashed centre lines stop at junctions and leave the fountain approach clear.
  // Merge the paint into one surface so the markings add only one draw call.
  const stripes = [], dashLength = 14, dashGap = 12, halfWidth = .8;
  [...boulevard, ...crossroads].forEach(({ polygon, kind }) => {
    const vertical = kind === 'boulevard';
    const xs = polygon.map(point => point[0]), ys = polygon.map(point => point[1]);
    const centre = vertical ? (Math.min(...xs) + Math.max(...xs)) / 2 : (Math.min(...ys) + Math.max(...ys)) / 2;
    const axis = vertical ? ys : xs, start = Math.min(...axis) + 8, end = Math.max(...axis) - 8;
    for (let along = start; along + dashLength <= end; along += dashLength + dashGap) {
      const corners = [[along, -halfWidth], [along + dashLength, -halfWidth], [along + dashLength, halfWidth], [along, halfWidth]]
        .map(([distance, offset]) => vertical ? [centre + offset, distance] : [distance, centre + offset]);
      const clear = corners.every(point => pointInPolygon(point, polygon)
        && Math.hypot(point[0] - plan.roundabout.center[0], point[1] - plan.roundabout.center[1]) > plan.roundabout.width / 2 + 4
        && (!vertical || crossroads.every(road => !pointInPolygon(point, road.polygon))));
      // Also reject a dash spanning a junction between its endpoints.
      const crossesJunction = vertical && crossroads.some(road => {
        const y = road.polygon.map(point => point[1]);
        return along < Math.max(...y) + 4 && along + dashLength > Math.min(...y) - 4;
      });
      if (clear && !crossesJunction) stripes.push({ polygon: corners });
    }
  });
  const stripeMaterial = kit.track(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  const centreStripes = addRoad(roadGeometry(stripes), stripeMaterial, HEIGHTS.road + .006);
  centreStripes.name = 'White road centre stripes';
  centreStripes.receiveShadow = false;

  // Bare ground stays earthy; landscaped parks and house gardens receive grass.
  const base = kit.flatPolygon(plan.boundary, soil, HEIGHTS.ground + .002, root); base.name = 'Colony soil base';
  // Plaza gardens lose a concave arc to the roundabout, as on the printed plan.
  const plazaGardens = plazaLayout(plan, ctx.siteFit).gardens;
  plan.landscaping.forEach((garden) => kit.flatPolygon(isPlazaGarden(plan, garden.polygon) ? plazaGardens.find(item => item.polygon === garden.polygon).outline : garden.polygon, lawn, HEIGHTS.garden, root));

  // Residential plots: soil on vacant plots and grass around built houses,
  // with concrete kerb sides and thick white separators between plots.
  const residential = plan.plots.filter(plot => !plot.number.startsWith('S'));
  const tops = [], lawnTops = [], sides = [], edging = [];
  // A twin villa (A-41+A-42, B-61+B-62) is one compound: no white line or wash gap through it.
  const twinVertices = plot => new Set(VILLA_SITES.find(numbers => numbers.length > 1 && numbers.includes(plot.number))?.filter(number => number !== plot.number)
    .flatMap(number => residential.find(other => other.number === number).geometry.polygon.map(String)));
  residential.forEach((plot) => {
    const shape = new THREE.ExtrudeGeometry(kit.shapeFromPolygon(plot.geometry.polygon), { depth: HEIGHTS.lawn - .004, bevelEnabled: false, curveSegments: 1 });
    shape.rotateX(-Math.PI / 2); shape.translate(0, .004, 0);
    const p = shape.getAttribute('position'), n = shape.getAttribute('normal');
    for (let i = 0; i < p.count; i += 3) {
      const ny = n.getY(i); if (ny < -.5) continue;
      const out = ny > .5 ? (builtPlotNumbers.has(plot.number) ? lawnTops : tops) : sides; for (let k = 0; k < 3; k += 1) out.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k), n.getX(i + k), n.getY(i + k), n.getZ(i + k));
    }
    shape.dispose();
    const polygon = plot.geometry.polygon;
    const twin = twinVertices(plot);
    polygon.forEach((a, i) => {
      if (twin.has(String(a)) && twin.has(String(polygon[(i + 1) % polygon.length]))) return;
      const [ax, az] = world(a), [bx, bz] = world(polygon[(i + 1) % polygon.length]), dx = bx - ax, dz = bz - az;
      edging.push([[Math.hypot(dx, dz) + .006, .003, .05], [(ax + bx) / 2, HEIGHTS.lawn + .003, (az + bz) / 2], -Math.atan2(dz, dx)]);
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
  const gardens = kit.mesh(interleaved(lawnTops), villaLawn, root, { cast: false }); gardens.name = 'Villa grass gardens';
  kit.mesh(interleaved(sides), kit.material('#d9d5cb', { roughness: .9 }), root, { cast: false });
  const plotEdging = kit.boxes(kit.track(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, depthWrite: false })), edging, root);
  plotEdging.name = 'White plot boundaries'; plotEdging.renderOrder = 2;
  plotEdging.castShadow = false; plotEdging.userData.colonyMapFit = { mode: 'surface' };

  // Live availability: a solid colour inside each white plot boundary,
  // merged into one mesh whose vertex alpha paintPlots switches on and off.
  const RING = .014, FILL = 1;
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
    const twin = twinVertices(plot), outer = plot.geometry.polygon.map(world);
    const inner = inset(outer, RING).map((point, i) => twin.has(String(plot.geometry.polygon[i])) ? outer[i] : point), start = overlayPositions.length / 3, count = outer.length, y = HEIGHTS.lawn + .0012;
    // Vertex sets: outline outer edge, outline inner edge, then the wash (same points as the inner edge).
    [...outer, ...inner, ...inner].forEach(([x, z]) => { overlayPositions.push(x, y, z); overlayColours.push(1, 1, 1, 0); });
    for (let i = 0; i < count; i += 1) { const j = (i + 1) % count; overlayIndex.push(start + i, start + count + j, start + j, start + i, start + count + i, start + count + j); }
    for (let i = 1; i < count - 1; i += 1) overlayIndex.push(start + 2 * count, start + 2 * count + i + 1, start + 2 * count + i);
    overlaySlots.set(plot.number, { start, count });
  });
  const overlayGeometry = kit.geometry(new THREE.BufferGeometry());
  overlayGeometry.setAttribute('position', new THREE.Float32BufferAttribute(overlayPositions, 3)); overlayGeometry.setAttribute('color', new THREE.Float32BufferAttribute(overlayColours, 4));
  overlayGeometry.setAttribute('aPlotAvailable', new THREE.Float32BufferAttribute(new Float32Array(overlayPositions.length / 3), 1));
  overlayGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(overlayPositions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); overlayGeometry.setIndex(overlayIndex);
  const overlay = kit.mesh(overlayGeometry, availabilityMaterial(kit, { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), root, { cast: false });
  overlay.name = 'Plot availability colours';
  overlay.renderOrder = 1;
  const overlayColour = overlayGeometry.getAttribute('color');
  const available = overlayGeometry.getAttribute('aPlotAvailable');
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
  labels.name = 'Plot numbers';
  labels.renderOrder = 2;

  return {
    paintPlots: (statuses) => {
      overlaySlots.forEach(({ start, count }, number) => {
        const status = statuses.get(number), colour = palette[status], shown = colour && status !== 'UNKNOWN';
        // Keep the black edging visible; availability colours only tint the interior.
        const fill = FILL;
        for (let i = 0; i < count * 3; i += 1) {
          const grass = status === 'AVAILABLE';
          overlayColour.setXYZW(start + i, grass ? 1 : colour?.r ?? 1, grass ? 1 : colour?.g ?? 1, grass ? 1 : colour?.b ?? 1, shown && i >= count * 2 ? fill : 0);
          available.setX(start + i, grass ? 1 : 0);
        }
      });
      overlayColour.needsUpdate = true;
      available.needsUpdate = true;
    },
  };
}
