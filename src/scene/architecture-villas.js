// Villas on the surveyed plots (sitePlots.js): each site gets a compound wall
// with an open sliding gate, a paved forecourt with the owners' parked cars,
// the villa itself and front-garden shrubs. Garden trees are planted by
// vegetation.js from the same layout. Everything is instanced per finish.
import { villaSites, WALL_INSET } from './sitePlots.js';
import { buildCars } from './architecture-cars.js';
import { proceduralMaterial, uniform } from './kit.js';
import { weather } from './architecture-common.js';

export function buildVillas(ctx, mat) {
  const { THREE, plan, kit, world, HEIGHTS, root } = ctx;
  const colour = (hex) => new THREE.Color(hex);
  const finishes = {
    ...mat,
    glass: kit.material('#26343e', { roughness: .05, metalness: .55, envMapIntensity: 1.7 }),
    wall: weather(kit.material('#ece6d8', { roughness: .9 }), { grime: .35, mottle: .1, streak: .05, key: 'villa-wall' }),
    stone: proceduralMaterial(kit, {
      uniforms: { uA: uniform('vec3', colour('#b8a68a')), uB: uniform('vec3', colour('#8c7e6a')) },
      surface: `vec2 q = vec2((vWorld.x + vWorld.z) / 0.034, vWorld.y / 0.011); q.x += rgHash(vec2(floor(q.y), 3.0)) * 3.0;
        float id = rgHash(floor(q)); vec2 f = fract(q);
        diffuseColor.rgb = mix(uA, uB, id) * (0.82 + 0.25 * rgNoise(vWorld.xy * 900.0)) * (1.0 - 0.45 * (step(f.x, 0.05) + step(f.y, 0.12)));`,
      roughness: .85 }),
    wood: proceduralMaterial(kit, {
      uniforms: { uA: uniform('vec3', colour('#8a5734')), uB: uniform('vec3', colour('#5b3620')) },
      surface: 'float g = rgNoise(vec2((vWorld.x + vWorld.z) * 420.0, vWorld.y * 18.0)) * 0.7 + rgNoise(vec2((vWorld.x + vWorld.z) * 90.0, vWorld.y * 6.0)) * 0.3; diffuseColor.rgb = mix(uB, uA, g);',
      roughness: .55 }),
    grey: kit.material('#3f4346', { roughness: .7 }),
    railGlass: kit.material('#cfe4ea', { transparent: true, opacity: .32, roughness: .04, metalness: .1, depthWrite: false }),
    solar: proceduralMaterial(kit, {
      uniforms: { uCell: uniform('vec3', colour('#17284a')) },
      surface: 'vec2 q = vWorld.xz / 0.016; diffuseColor.rgb = uCell * (1.0 + 0.6 * max(rgLine(q.x, 1.0, 0.04), rgLine(q.y, 1.0, 0.04)));',
      roughness: .2, metalness: .4 }),
    light: kit.material('#fff4dc', { emissive: '#ffdca0', emissiveIntensity: 1.1, roughness: .3 }),
    pot: kit.material('#a5512f', { roughness: .8 }),
    plant: proceduralMaterial(kit, {
      uniforms: { uDark: uniform('vec3', colour('#24461a')), uLight: uniform('vec3', colour('#5a8a31')) },
      surface: 'vec3 p = vWorld * 260.0; diffuseColor.rgb = mix(uDark, uLight, rgNoise(p.xz + p.y) * 0.6 + rgNoise(p.zy * 0.5) * 0.4);',
      roughness: .9 }),
    paver: proceduralMaterial(kit, {
      uniforms: { uA: uniform('vec3', colour('#bdb7ab')), uB: uniform('vec3', colour('#a59e92')) },
      surface: `vec2 q = vWorld.xz / vec2(0.022, 0.011); q.x += step(1.0, mod(floor(q.y), 2.0)) * 0.5;
        diffuseColor.rgb = mix(uA, uB, rgHash(floor(q))) * (0.93 + 0.08 * rgFine(vWorld.xz * 90.0)) * (1.0 - 0.3 * max(rgLine(q.x, 1.0, 0.05), rgLine(q.y, 1.0, 0.08)));`,
      roughness: .92 }),
  };
  const shapes = { box: kit.geometry(new THREE.BoxGeometry(1, 1, 1)), cyl: kit.geometry(new THREE.CylinderGeometry(.5, .5, 1, 20)), ball: kit.geometry(new THREE.IcosahedronGeometry(.5, 2)) };
  const bins = new Map(), part = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  let plotNumbers;
  const add = (basis, key, size, pos, shape = 'box', rot, anchor) => {
    const bin = `${key}|${shape}|${anchor ? 'rigid' : 'surface'}`; if (!bins.has(bin)) bins.set(bin, []);
    q.setFromEuler(rot ? e.set(...rot) : e.set(0, 0, 0)); part.compose(p.set(...pos), q, s.set(...size));
    bins.get(bin).push({ matrix: new THREE.Matrix4().multiplyMatrices(basis, part), anchor, plotNumbers });
  };
  const cars = [];
  villaSites(plan).forEach((site) => {
    plotNumbers = site.numbers;
    const [ox, oz] = world(site.mid), front = new THREE.Matrix4();
    // Site basis: x along the road-facing side, y up, +z toward the road.
    const ex = new THREE.Vector3(site.u[0], 0, site.u[1]), ey = new THREE.Vector3(0, 1, 0), ez = new THREE.Vector3(-site.v[0], 0, -site.v[1]);
    front.makeBasis(ex, ey, ez).setPosition(ox, HEIGHTS.lawn, oz);
    const at = (x, depth, y = 0) => [x, y, -depth];
    const villa = front.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -site.villa.y0));
    const villaAnchor = [villa.elements[12], villa.elements[14]];
    // Every part of the house shares one frame; plot pads and compound walls
    // follow the site's surface fit instead of deforming the house with them.
    site.design.parts.forEach(([key, size, pos, shape, rot]) => add(villa, key, size, pos, shape, rot, villaAnchor));
    // Paved forecourt with a kerb on its lawn side.
    const { pad } = site;
    add(front, 'paver', [pad.x1 - pad.x0, .004, pad.y1 - pad.y0], at((pad.x0 + pad.x1) / 2, (pad.y0 + pad.y1) / 2, .002));
    add(front, 'concrete', [.012, .008, pad.y1 - pad.y0], at(pad.x1 + .006, (pad.y0 + pad.y1) / 2, .004));
    // Compound wall: front (gate gap), sides and back, pillars with caps, gate-side lamps.
    const W2 = site.W / 2 - WALL_INSET, D = site.D - WALL_INSET, h = .085, t = .014;
    const wall = (x0, z0, x1, z1) => {
      const length = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      add(front, 'wall', alongX ? [length, h, t] : [t, h, length], at((x0 + x1) / 2, (z0 + z1) / 2, h / 2));
      add(front, 'trim', alongX ? [length + .006, .006, t + .008] : [t + .008, .006, length + .006], at((x0 + x1) / 2, (z0 + z1) / 2, h + .003));
      const n = Math.max(1, Math.round(length / .32));
      for (let i = 0; i <= n; i += 1) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; add(front, 'wall', [.026, h + .014, .026], at(x, z, (h + .014) / 2)); add(front, 'trim', [.032, .006, .032], at(x, z, h + .017)); }
    };
    wall(-W2, WALL_INSET, site.gate.x0, WALL_INSET); wall(site.gate.x1, WALL_INSET, W2, WALL_INSET);
    wall(-W2, WALL_INSET, -W2, D); wall(W2, WALL_INSET, W2, D); wall(-W2, D, W2, D);
    for (const x of [site.gate.x0, site.gate.x1]) add(front, 'light', [.016, .022, .016], at(x, WALL_INSET, h + .03));
    // Sliding gate, slid open behind the wall on the right of the opening.
    const gw = site.gate.x1 - site.gate.x0, g0 = site.gate.x1 + .004, gy = WALL_INSET + .016;
    add(front, 'iron', [gw, .008, .01], at(g0 + gw / 2, gy, .012)); add(front, 'iron', [gw, .008, .01], at(g0 + gw / 2, gy, .078));
    for (let x = g0 + .01; x < g0 + gw; x += .022) add(front, 'iron', [.005, .07, .005], at(x, gy, .045));
    site.shrubs.forEach(({ x, y, radius }) => add(front, 'plant', [radius * 2, radius * 1.7, radius * 2], at(x, y, radius * .8), 'ball'));
    // Cars parked nose to the house: car space x forward = into the plot, z = along the road side.
    site.cars.forEach((car) => {
      const basis = new THREE.Matrix4().makeBasis(ez.clone().negate(), ey, ex).setPosition(new THREE.Vector3(...at(car.x, car.y, .004)).applyMatrix4(front));
      cars.push({ ...car, basis });
    });
  });
  bins.forEach((items, key) => {
    const [name, shape, mode] = key.split('|'), mesh = new THREE.InstancedMesh(shapes[shape], finishes[name], items.length);
    mesh.name = `Villa ${name} ${mode}`;
    mesh.userData.villaPlots = items.map(item => item.plotNumbers);
    items.forEach(({ matrix }, i) => mesh.setMatrixAt(i, matrix));
    mesh.userData.colonyMapFit = mode === 'rigid'
      ? { mode, anchors: new Float32Array(items.flatMap(item => item.anchor)) }
      : { mode: 'surface' };
    mesh.castShadow = name !== 'railGlass' && name !== 'light'; mesh.receiveShadow = true; mesh.instanceMatrix.needsUpdate = true; root.add(mesh);
  });
  buildCars(ctx, cars);
}
