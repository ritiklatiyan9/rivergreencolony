// The H commercial strip belongs to the outside apron. Its reference polygons
// already use fitted map-world coordinates, independently of the colony grid.
import { createBatch } from './architecture-common.js';

const IDENTITY_MATRIX = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function worldShape(THREE, polygon) {
  const shape = new THREE.Shape();
  polygon.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath();
  return shape;
}

function facadeFrame(shop) {
  const [a, b] = shop.facade, length = distance(a, b);
  const tangent = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  let outward = [-tangent[1], tangent[0]];
  const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if ((shop.center[0] - midpoint[0]) * outward[0] + (shop.center[1] - midpoint[1]) * outward[1] > 0) outward = outward.map(value => -value);
  return { length, tangent, outward, midpoint };
}

function atlasPlane(THREE, kit, material, parent, center, horizontal, vertical, width, height, index) {
  const positions = [], uvs = [], columns = 4, rows = 3;
  const u0 = (index % columns) / columns, u1 = u0 + 1 / columns;
  const v1 = 1 - Math.floor(index / columns) / rows, v0 = v1 - 1 / rows;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  corners.forEach(([x, y]) => positions.push(...center.map((value, axis) => value + horizontal[axis] * x * width / 2 + vertical[axis] * y * height / 2)));
  uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
  const geometry = kit.geometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]); geometry.computeVertexNormals();
  return kit.mesh(geometry, material, parent, { cast: false, receive: false });
}

export function buildHShops(ctx, mat) {
  const { THREE, kit, root, HEIGHTS, frontage } = ctx;
  const apron = frontage?.commercialApron;
  if (!apron?.shops?.length) return null;
  const scale = frontage.gateScale || 1, floor = HEIGHTS.forecourt;
  const top = HEIGHTS.shopRoof * scale, slab = .01 * scale, height = top - floor;
  const identityFit = {
    matrix: [...IDENTITY_MATRIX], target: apron.targetBoundary,
    point: point => [...point], unpoint: point => [...point],
    asset: source => ({ source, target: [...source], scale: 1, angle: 0 }),
  };
  const group = new THREE.Group(); group.name = 'H1–H12 outer commercial shops';
  group.userData.colonyMapFit = { siteFit: identityFit, clipBoundary: apron.targetBoundary };
  root.add(group);
  const batch = createBatch(THREE, kit, group);
  const roofMaterial = kit.material('#dfddd4', { roughness: .9 });
  const border = kit.track(new THREE.MeshBasicMaterial({ color: '#111111', toneMapped: false }));
  const shutterTexture = kit.canvasTexture(64, 256, (c, width, canvasHeight) => {
    c.fillStyle = '#adb4b0'; c.fillRect(0, 0, width, canvasHeight);
    for (let y = 0; y < canvasHeight; y += 10) {
      c.fillStyle = '#ced2ce'; c.fillRect(0, y, width, 2);
      c.fillStyle = '#77827e'; c.fillRect(0, y + 8, width, 2);
    }
    c.fillStyle = '#34443c'; c.fillRect(width / 2 - 7, canvasHeight - 24, 14, 6);
  }, { wrap: false });
  const shutterMaterial = kit.material('#ffffff', { map: shutterTexture, roughness: .65, metalness: .25 });
  const signMaterial = kit.material('#f6f1de', { roughness: .7 });
  const numberAtlas = kit.canvasTexture(1024, 768, c => {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 100px "DM Sans", Arial, sans-serif';
    apron.shops.forEach((shop, i) => {
      const x = i % 4 * 256 + 128, y = Math.floor(i / 4) * 256 + 128;
      c.lineJoin = 'round'; c.strokeStyle = '#f8f4e9'; c.lineWidth = 7;
      c.strokeText(shop.number, x, y, 230);
      c.fillStyle = '#143c2c'; c.fillText(shop.number, x, y, 230);
    });
  }, { wrap: false });
  const numberMaterial = kit.track(new THREE.MeshBasicMaterial({ map: numberAtlas, transparent: true, depthWrite: false, alphaTest: .02,
    side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));

  apron.shops.forEach((shop, index) => {
    const unit = new THREE.Group(); unit.name = `${shop.number} shop`;
    unit.userData.shopNumber = shop.number; unit.userData.referencePolygon = shop.polygon;
    group.add(unit);
    const shape = worldShape(THREE, shop.polygon);
    const bodyGeometry = kit.geometry(new THREE.ExtrudeGeometry(shape, { depth: height - slab, bevelEnabled: false, curveSegments: 1 }));
    bodyGeometry.rotateX(-Math.PI / 2); bodyGeometry.translate(0, floor, 0);
    const body = kit.mesh(bodyGeometry, mat.plaster, unit); body.name = `${shop.number} polygon body`;
    const roofGeometry = kit.geometry(new THREE.ExtrudeGeometry(shape, { depth: slab, bevelEnabled: false, curveSegments: 1 }));
    roofGeometry.rotateX(-Math.PI / 2); roofGeometry.translate(0, top - slab, 0);
    const roof = kit.mesh(roofGeometry, roofMaterial, unit); roof.name = `${shop.number} neutral roof`;

    const frame = facadeFrame(shop), { tangent, outward, midpoint, length } = frame;
    const yaw = -Math.atan2(tangent[1], tangent[0]);
    const at = (along, y, out) => [midpoint[0] + tangent[0] * along + outward[0] * out, y, midpoint[1] + tangent[1] * along + outward[1] * out];
    const width = Math.max(length - .04 * scale, length * .7);
    const shutterBottom = floor + .018 * scale, shutterTop = floor + height * .72;
    // The front panels follow the actual angled apron edge, not the colony's
    // original X axis. Their normals point away from the polygon interior.
    const panel = kit.geometry(new THREE.PlaneGeometry(width, shutterTop - shutterBottom));
    const shutter = kit.mesh(panel, shutterMaterial, unit);
    shutter.position.set(...at(0, (shutterBottom + shutterTop) / 2, .003 * scale));
    shutter.rotation.y = Math.atan2(outward[0], outward[1]);
    shutter.name = `${shop.number} apron-facing shutter`;
    shutter.userData.facade = shop.facade; shutter.userData.outward = outward;
    const canopyDepth = Math.min(.09 * scale, length * .23);
    batch.addBox(mat.trim, [length, .015 * scale, canopyDepth], at(0, shutterTop + .012 * scale, canopyDepth / 2), yaw);
    batch.addBox(mat.concrete, [length, .014 * scale, canopyDepth * .9], at(0, floor + .007 * scale, canopyDepth * .45), yaw);
    const signY = floor + height * .86, signHeight = Math.min(.06 * scale, height * .16);
    batch.addBox(signMaterial, [width, signHeight, .007 * scale], at(0, signY, .004 * scale), yaw);
    const sign = atlasPlane(THREE, kit, numberMaterial, unit, at(0, signY, .009 * scale),
      [tangent[0], 0, tangent[1]], [0, 1, 0], Math.min(width * .65, signHeight * 2.8), signHeight * .94, index);
    sign.name = `${shop.number} sign label`;

    shop.polygon.forEach((a, i) => {
      const b = shop.polygon[(i + 1) % shop.polygon.length], edgeLength = distance(a, b);
      let normal = [-(b[1] - a[1]) / edgeLength, (b[0] - a[0]) / edgeLength];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if ((shop.center[0] - mid[0]) * normal[0] + (shop.center[1] - mid[1]) * normal[1] < 0) normal = normal.map(value => -value);
      const thickness = Math.min(.01 * scale, edgeLength * .035);
      batch.addBox(border, [edgeLength - thickness, .003 * scale, thickness],
        [mid[0] + normal[0] * thickness / 2, top + .002 * scale, mid[1] + normal[1] * thickness / 2],
        -Math.atan2(b[1] - a[1], b[0] - a[0]));
    });
    const clearance = Math.min(...shop.polygon.map((a, i) => {
      const b = shop.polygon[(i + 1) % shop.polygon.length];
      return Math.abs((b[0] - a[0]) * (shop.center[1] - a[1]) - (b[1] - a[1]) * (shop.center[0] - a[0])) / distance(a, b);
    }));
    const labelWidth = Math.min(length * .72, clearance * 1.65);
    const label = atlasPlane(THREE, kit, numberMaterial, unit, [shop.center[0], top + .026 * scale, shop.center[1]],
      [tangent[0], 0, tangent[1]], [outward[0], 0, outward[1]], labelWidth, labelWidth * .62, index);
    label.name = `${shop.number} roof label`; label.renderOrder = 2;
  });
  batch.build();
  return group;
}
