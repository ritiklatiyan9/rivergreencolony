import { proceduralMaterial, uniform, lawnMaterial } from './kit.js';
import { buildFrontApronLandscape } from './front-apron-landscape.js';

export function frontPavingMaterial(THREE, kit, { brick = false } = {}) {
  const material = proceduralMaterial(kit, {
    uniforms: {
      uPaver: uniform('vec3', new THREE.Color(brick ? '#965b45' : '#555b60')),
      uPaverAlt: uniform('vec3', new THREE.Color(brick ? '#754938' : '#42484d')),
      uJoint: uniform('vec3', new THREE.Color(brick ? '#54483e' : '#2e3337')),
    },
    surface: `
      vec2 p = vec2(vWorld.x + vWorld.z, vWorld.z - vWorld.x) * 0.70710678 / 0.035;
      vec2 cell = floor(p), uv = fract(p);
      float diagonal = mod(cell.x - cell.y, 4.0);
      float horizontal = 1.0 - step(2.0, diagonal);
      vec2 tileUV = mix(vec2(uv.x, (uv.y + 3.0 - diagonal) * 0.5), vec2((uv.x + diagonal) * 0.5, uv.y), horizontal);
      vec2 tileCell = cell - mix(vec2(0.0, 3.0 - diagonal), vec2(diagonal, 0.0), horizontal);
      vec2 edge = min(tileUV, 1.0 - tileUV) * mix(vec2(1.0, 2.0), vec2(2.0, 1.0), horizontal);
      float footprint = max(fwidth(p.x), fwidth(p.y));
      float aa = min(0.06, footprint * 0.25);
      float bevel = smoothstep(0.025 - aa, 0.065 + aa, min(edge.x, edge.y));
      vec3 c = mix(uPaver, uPaverAlt, rgHash(tileCell) * 0.7);
      c *= 0.94 + 0.08 * rgFine(vWorld.xz * 110.0);
      vec3 average = mix(uJoint, mix(uPaver, uPaverAlt, 0.35) * 0.98, 0.85);
      diffuseColor.rgb = mix(average, mix(uJoint, c, bevel), 1.0 - smoothstep(0.6, 1.5, footprint));`,
    roughness: .96,
  });
  material.userData.colonyMapTextureSpace = 'fitted';
  return material;
}

export function buildCommercialApron(ctx) {
  const { THREE, kit, root, HEIGHTS, frontage } = ctx;
  const apron = frontage?.commercialApron;
  if (!apron) return null;
  const identityFit = { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    point: point => [...point], unpoint: point => [...point],
    asset: source => ({ source, target: [...source], scale: 1, angle: 0 }) };
  const group = new THREE.Group(); group.name = 'Dark grey front commercial apron';
  group.userData.colonyMapFit = { siteFit: identityFit, clipBoundary: apron.targetBoundary };
  root.add(group);
  const flat = (polygon, material, height, parent, name) => {
    const shape = new THREE.Shape();
    polygon.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)); shape.closePath();
    const geometry = kit.geometry(new THREE.ShapeGeometry(shape)); geometry.rotateX(-Math.PI / 2);
    const mesh = kit.mesh(geometry, material, parent, { cast: false }); mesh.position.y = height; mesh.name = name;
    return mesh;
  };
  const paving = frontPavingMaterial(THREE, kit), brick = frontPavingMaterial(THREE, kit, { brick: true });
  flat(apron.boundary, paving, HEIGHTS.forecourt, group, 'Dark grey interlocking entrance paving');
  const middle = apron.boundary.reduce((sum, p) => sum.map((v, i) => v + p[i] / apron.boundary.length), [0, 0]);
  const brickBand = (a, b, width, center, name) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    let nx = -dz / length, nz = dx / length;
    if ((center[0] - (a[0] + b[0]) / 2) * nx + (center[1] - (a[1] + b[1]) / 2) * nz < 0) { nx = -nx; nz = -nz; }
    flat([[a[0] + nx * .02, a[1] + nz * .02], [b[0] + nx * .02, b[1] + nz * .02],
      [b[0] + nx * width, b[1] + nz * width], [a[0] + nx * width, a[1] + nz * width]],
    brick, HEIGHTS.forecourt + .003, group, name);
  };
  apron.boundary.forEach((a, i) => brickBand(a, apron.boundary[(i + 1) % apron.boundary.length], .11, middle, 'Brick perimeter edging'));
  const first = apron.shops[0], last = apron.shops.at(-1);
  const shopFrontA = first.facade[0], shopFrontB = last.facade[1];
  const shopCenter = apron.shops.reduce((sum, shop) => sum.map((v, i) => v + shop.center[i] / apron.shops.length), [0, 0]);
  const frontMiddle = shopFrontA.map((v, i) => v + shopFrontB[i] - shopCenter[i]);
  brickBand(shopFrontA, shopFrontB, .16, frontMiddle, 'Brick design along H shop fronts');
  const white = kit.track(new THREE.MeshBasicMaterial({ color: '#f6f4eb', toneMapped: false }));
  const line = (a, b, width, parent, name) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz), nx = -dz / length * width / 2, nz = dx / length * width / 2;
    return flat([[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]],
      white, HEIGHTS.forecourt + .006, parent, name);
  };
  const dashed = (a, b, parent, name, dash = .28, gap = .25) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const at = t => a.map((v, i) => v + (b[i] - v) * t / length);
    for (let t = gap; t + dash < length; t += dash + gap) line(at(t), at(t + dash), .022, parent, name);
  };
  // The approach follows the open area in the drawing, above the angled H row.
  dashed(apron.entryLine[0], apron.entryLine[1], group, 'Gate approach centre dash');
  dashed(apron.entryLine[2], apron.entryLine[3], group, 'Main road entry centre dash');
  const { center, radius } = apron.roundabout;
  const circle = (geometry, material, height, name) => {
    const mesh = kit.mesh(kit.geometry(geometry), material, group, { cast: false });
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(center[0], height, center[1]); mesh.name = name;
    return mesh;
  };
  circle(new THREE.CircleGeometry(radius, 48), lawnMaterial(kit), HEIGHTS.garden, 'Front roundabout green island');
  circle(new THREE.RingGeometry(radius, radius + .025, 48), white, HEIGHTS.garden + .003, 'Front roundabout curb');
  circle(new THREE.RingGeometry(radius + .04, radius + .15, 48), brick, HEIGHTS.forecourt + .004, 'Brick ring in interlocking apron');
  const stone = kit.material('#d8d5c9', { roughness: .85 }), water = kit.material('#6b9cba', { roughness: .22 });
  circle(new THREE.CircleGeometry(radius * .62, 40), stone, HEIGHTS.garden + .012, 'Front roundabout basin');
  circle(new THREE.CircleGeometry(radius * .45, 40), water, HEIGHTS.garden + .018, 'Front roundabout water');
  buildFrontApronLandscape(ctx, group);
  return group;
}
