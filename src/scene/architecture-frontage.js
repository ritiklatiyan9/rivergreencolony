// The entrance keeps its own registration. Paving, corners, shops and the
// outer gate stay on the marked frontage while the interior can fill the
// space behind the commercial row.
import { lawnMaterial, proceduralMaterial, uniform } from './kit.js';
import { createBatch } from './architecture-common.js';
import { buildWallSegments, buildCurbSegments } from './architecture-wall.js';
import { buildArch } from './architecture-arch.js';
import { buildShops } from './architecture-shops.js';

export function buildFrontage(ctx, mat) {
  const { THREE, kit, root, world, HEIGHTS, frontage, SCALE } = ctx;
  const siteFit = ctx.baseSiteFit || ctx.siteFit;
  const group = new THREE.Group(); group.name = 'Entrance frontage';
  group.userData.colonyMapFit = { siteFit, clipBoundary: frontage.forecourtTargetBoundary || frontage.targetBoundary };
  root.add(group);
  const colour = hex => new THREE.Color(hex);
  // Match the existing shop forecourt's pavers, using source coordinates to
  // keep their pattern stable while the satellite view rotates.
  const paving = proceduralMaterial(kit, {
    uniforms: { uPaver: uniform('vec3', colour('#cfc9bd')), uPaverAlt: uniform('vec3', colour('#bdb5a6')) },
    surface: `
      vec2 p = vWorld.xz; vec2 q = p / vec2(0.024, 0.012); q.x += step(1.0, mod(floor(q.y), 2.0)) * 0.5;
      float id = rgHash(floor(q));
      vec3 c = mix(uPaver, uPaverAlt, id * 0.7) * (0.92 + 0.1 * rgFbm(p * 3.0)) * (0.95 + 0.08 * rgFine(p * 90.0));
      c *= 1.0 - 0.3 * max(rgLine(q.x, 1.0, 0.04), rgLine(q.y, 1.0, 0.06));
      diffuseColor.rgb = c;`, roughness: .95,
  });
  const forecourt = kit.flatPolygon(frontage.forecourtBoundary || frontage.boundary, paving, HEIGHTS.forecourt, group);
  forecourt.name = 'Entrance forecourt';

  // Carry the boulevard to the outer gate. Along/across attributes follow the
  // four approach corners and keep its brick bands attached to both edges.
  const approach = frontage.approach.polygon || frontage.approach;
  const points = approach.map(world), entry = world(frontage.entry), gate = world(frontage.gate);
  const length = Math.hypot((points[2][0] + points[3][0]) / 2 - entry[0], (points[2][1] + points[3][1]) / 2 - entry[1]);
  const boulevard = ctx.plan.roads.find(road => road.kind === 'boulevard');
  const startAlong = ctx.baseSiteFit && ctx.baseSiteFit !== ctx.siteFit
    ? world([0, Math.max(...boulevard.polygon.map(point => point[1]))])[1] : entry[1];
  const half = ctx.plan.entrance.roadWidth * SCALE / 2;
  const geometry = kit.geometry(new THREE.ShapeGeometry(kit.shapeFromPolygon(approach)));
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position'), params = [];
  const cornerParams = [[startAlong, -half, half], [startAlong, half, half], [startAlong + length, half, half], [startAlong + length, -half, half]];
  for (let i = 0; i < positions.count; i += 1) {
    let nearest = 0, distance = Infinity;
    points.forEach(([x, z], j) => {
      const d = Math.hypot(x - positions.getX(i), z - positions.getZ(i));
      if (d < distance) { distance = d; nearest = j; }
    });
    params.push(...cornerParams[nearest]);
  }
  geometry.setAttribute('aRoad', new THREE.Float32BufferAttribute(params, 3));
  const road = proceduralMaterial(kit, {
    uniforms: { uConcrete: uniform('vec3', colour('#d6d2c9')), uBrick: uniform('vec3', colour('#b4523c')), uBrickAlt: uniform('vec3', colour('#c96b50')), uCurb: uniform('vec3', colour('#ece9e1')) },
    attributes: 'attribute vec3 aRoad;', varyings: 'varying vec3 vRoad;', vertex: 'vRoad = aRoad;',
    surface: `
      float along = vRoad.x, across = vRoad.y, edge = vRoad.z - abs(across);
      vec2 p = vWorld.xz;
      vec3 concrete = uConcrete * (0.9 + 0.12 * rgFbm(p * 2.6)) * (0.96 + 0.08 * rgFine(p * 75.0));
      concrete *= 1.0 - 0.07 * smoothstep(0.55, 0.8, rgFbm(p * 0.9 + 11.0));
      float joints = max(rgLine(along, 0.36, 0.0022), rgLine(across, 1000.0, 0.0018));
      vec3 c = concrete * (1.0 - 0.38 * joints);
      float band = 0.042 + 0.01 * rgTri(along / 0.038);
      if (edge < band) {
        vec2 brick = vec2(along / 0.022 + (fract(floor(edge / 0.011) * 0.5) * 0.5) * 2.0, edge / 0.011);
        vec3 b = mix(uBrick, uBrickAlt, rgHash(floor(brick))) * (0.86 + 0.18 * rgFine(p * 60.0));
        float mortar = max(rgLine(brick.x, 1.0, 0.04), rgLine(brick.y, 1.0, 0.06));
        c = mix(b, uCurb * 0.8, mortar * 0.55);
        if (edge < 0.007) c = uCurb * (0.92 + 0.08 * rgFine(p * 90.0));
      }
      float dashAA = fwidth(across) + 0.0005, dash = 1.0 - smoothstep(0.0065 - dashAA, 0.0065 + dashAA, abs(across));
      dash *= smoothstep(0.0, 0.02, fract(along / 0.34)) * (1.0 - smoothstep(0.17, 0.19, fract(along / 0.34)));
      diffuseColor.rgb = mix(c, vec3(0.93, 0.93, 0.9) * (0.92 + 0.08 * rgFine(p * 90.0)), dash);`, roughness: .92,
  });
  const roadMesh = kit.mesh(geometry, road, group, { cast: false }); roadMesh.position.y = HEIGHTS.road;
  roadMesh.name = 'Outer gate approach';
  if (frontage.shopRows?.length) roadMesh.userData.colonyMapFit = { clipBoundary: frontage.shopRows[0].clipBoundary };

  const walls = createBatch(THREE, kit, group);
  if (frontage.shopRows?.length) {
    buildWallSegments({ world, boundary: frontage.boundary }, [frontage.wallSegments[0], frontage.wallSegments[3]], walls, mat);
    buildCurbSegments({ world, boundary: frontage.boundary, floor: HEIGHTS.forecourt }, [frontage.wallSegments[1], frontage.wallSegments[2]], walls, mat);
  } else buildWallSegments({ world, boundary: frontage.boundary }, frontage.wallSegments, walls, mat);
  walls.build();

  // A separate batch prevents old interior containment from pulling the gate
  // back to the shop row. Compensate for the fit frame's rotation so the portal
  // faces along the actual outer frontage while retaining its native shape.
  const gateRoot = new THREE.Group(); gateRoot.name = 'Outer entrance gate'; group.add(gateRoot);
  if (frontage.shopRows?.length) gateRoot.userData.colonyMapFit = { clipBoundary: frontage.shopRows[0].clipBoundary };
  const batch = createBatch(THREE, kit, gateRoot);
  const [left, right] = frontage.outerFront.map(point => siteFit.point(world(point)));
  const frame = siteFit.asset(gate);
  const entranceYaw = frame.angle - Math.atan2(right[1] - left[1], right[0] - left[0]);
  buildArch({ ...ctx, entrancePoint: frontage.gate, entranceYaw }, batch, mat);
  batch.build();
  if (frontage.gardens?.length) buildFrontageGardens(ctx, mat);
  return group;
}

function buildFrontageGardens(ctx, mat) {
  const { THREE, root, kit, world, frontage, HEIGHTS } = ctx;
  const lawn = lawnMaterial(kit), wood = kit.material('#8b5a33', { roughness: .8 });
  const bark = kit.material('#73614b', { roughness: .9 }), leaves = kit.material('#557633', { roughness: .9 });
  frontage.gardens.forEach((descriptor, i) => {
    const polygon = descriptor.garden.polygon, centre = polygon.reduce((sum, p) => [sum[0] + p[0] / polygon.length, sum[1] + p[1] / polygon.length], [0, 0]);
    const row = frontage.shopRows?.find(row => row.fit === descriptor.fit);
    const group = new THREE.Group(); group.name = `Frontage corner garden ${i + 1}`;
    group.userData.colonyMapFit = { siteFit: descriptor.fit, clipBoundary: descriptor.clipBoundary, anchor: row?.sourceFront || world(centre) };
    root.add(group); kit.flatPolygon(polygon, lawn, HEIGHTS.garden, group);
    const batch = createBatch(THREE, kit, group);
    const inset = polygon.map(p => p.map((value, axis) => centre[axis] + (value - centre[axis]) * .95));
    inset.forEach((a, j) => {
      const b = inset[(j + 1) % inset.length], [ax, az] = world(a), [bx, bz] = world(b), dx = bx - ax, dz = bz - az;
      batch.addBox(mat.concrete, [Math.hypot(dx, dz), .014, .012], [(ax + bx) / 2, HEIGHTS.garden + .007, (az + bz) / 2], -Math.atan2(dz, dx));
    });
    const xs = polygon.map(p => p[0]), ys = polygon.map(p => p[1]);
    const minY = Math.min(...ys), maxY = Math.max(...ys), spanX = Math.max(...xs) - Math.min(...xs), spanY = maxY - minY;
    // Use the same seat and leg proportions as the existing colony benches.
    if (spanX > 30 && spanY > 45) {
      const bench = (point, yaw) => {
        const [x, z] = world(point), c = Math.cos(yaw), s = Math.sin(yaw);
        const at = (dx, y, dz) => [x + c * dx + s * dz, HEIGHTS.garden + y, z - s * dx + c * dz];
        batch.addBox(wood, [.04, .006, .15], at(0, .034, 0), yaw);
        batch.addBox(wood, [.006, .03, .15], at(-.021, .056, 0), yaw);
        for (const dz of [-.06, .06]) batch.addBox(mat.iron, [.034, .034, .006], at(0, .017, dz), yaw);
      };
      bench([centre[0] + 8, minY + 14], Math.PI / 2);
      bench([centre[0] - 8, maxY - 14], -Math.PI / 2);
      const trunk = kit.geometry(new THREE.CylinderGeometry(.008, .012, .2, 7)), crown = kit.geometry(new THREE.IcosahedronGeometry(1, 1));
      [[centre[0] - 10, minY + spanY * .35], [centre[0] + 10, maxY - spanY * .35]].forEach(point => {
        const [x, z] = world(point);
        const tree = new THREE.Group(); tree.name = 'Garden tree'; group.add(tree);
        const stem = kit.mesh(trunk, bark, tree); stem.position.set(x, HEIGHTS.garden + .1, z);
        [[0, .245, 0, .12], [-.07, .235, .025, .09], [.065, .22, -.025, .095]].forEach(([dx, y, dz, radius]) => {
          const canopy = kit.mesh(crown, leaves, tree); canopy.position.set(x + dx, HEIGHTS.garden + y, z + dz); canopy.scale.set(radius, radius * .82, radius);
        });
      });
    }
    batch.build();
  });
}

// Each row owns one similarity fit, including the shared parapets and painted
// roof numbers. Per-unit source coordinates and availability remain intact.
export function buildFrontageShops(ctx, mat) {
  const { THREE, kit, root, frontage } = ctx, painters = [];
  frontage.shopRows.forEach(row => {
    const group = new THREE.Group(); group.name = `${row.side} frontage shops`;
    group.userData.colonyMapFit = { siteFit: row.fit, clipBoundary: row.clipBoundary, anchor: row.sourceFront };
    root.add(group);
    const batch = createBatch(THREE, kit, group), plan = { ...ctx.plan, plots: row.plots };
    painters.push(buildShops({ ...ctx, plan, root: group }, batch, mat)); batch.build();
    buildShopNumbers({ ...ctx, plan, root: group });
  });
  return statuses => painters.forEach(paint => paint(statuses));
}

function buildShopNumbers({ THREE, kit, plan, root, world, SCALE, HEIGHTS }) {
  const atlas = kit.canvasTexture(1024, 512, c => {
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '600 54px "Space Grotesk", "DM Sans", system-ui, sans-serif';
    plan.plots.forEach((plot, i) => {
      c.shadowColor = 'rgba(10,22,8,.55)'; c.shadowBlur = 6; c.fillStyle = 'rgba(255,255,250,.96)';
      c.fillText(plot.number, i % 8 * 128 + 64, Math.floor(i / 8) * 128 + 65, 116);
      c.shadowBlur = 0; c.fillText(plot.number, i % 8 * 128 + 64, Math.floor(i / 8) * 128 + 65, 116);
    });
  }, { wrap: false });
  const positions = [], uvs = [], indices = [], anchors = [], flags = [];
  plan.plots.forEach((plot, i) => {
    const xs = plot.geometry.polygon.map(p => p[0]), ys = plot.geometry.polygon.map(p => p[1]);
    const [x, z] = world(plot.geometry.center), width = Math.min((Math.max(...xs) - Math.min(...xs)) * SCALE * .62, .62);
    const anchor = world([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]);
    const start = positions.length / 3, y = HEIGHTS.shopRoof + .019;
    positions.push(x - width / 2, y, z + width / 2, x + width / 2, y, z + width / 2, x + width / 2, y, z - width / 2, x - width / 2, y, z - width / 2);
    const u = i % 8 / 8, v = 1 - (Math.floor(i / 8) + 1) / 4;
    uvs.push(u, v, u + 1 / 8, v, u + 1 / 8, v + 1 / 4, u, v + 1 / 4);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    for (let j = 0; j < 4; j += 1) { anchors.push(...anchor); flags.push(1); }
  });
  const geometry = kit.geometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aColonyMapAnchor', new THREE.Float32BufferAttribute(anchors, 2));
  geometry.setAttribute('aColonyMapRigid', new THREE.Float32BufferAttribute(flags, 1));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const labels = kit.mesh(geometry, kit.track(new THREE.MeshBasicMaterial({ map: atlas, transparent: true, depthWrite: false, alphaTest: .02, toneMapped: false })), root, { cast: false, receive: false });
  labels.name = 'Shop roof numbers'; labels.renderOrder = 2;
}
