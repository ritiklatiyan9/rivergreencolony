// Life in the colony: park paths and benches, light traffic (six cars, five
// motorcycles with riders) and people walking, jogging, sitting and talking.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { isPlazaGarden, plazaLayout } from './plazaLayout.js';
export default function buildLife(ctx) {
  const { THREE, plan, kit, world, SCALE, HEIGHTS, root } = ctx;
  const random = kit.rng(5151);
  const dark = kit.material('#293b32', { roughness: .5 });
  const paving = kit.material('#d8d2c2', { roughness: .93 });
  const crossroads = plan.roads.filter(road => road.kind === 'crossroad');
  const [cx, cy] = plan.roundabout.center;
  const box = kit.box;
  // A rig of Object3D nodes: every node tagged with a finish becomes an
  // InstancedMesh, and place(i) copies each node's world matrix into instance i.
  const node = (parent, at, { size, shape = box, finish, tag, turn } = {}) => {
    const value = new THREE.Object3D(); value.position.set(...at); if (size) value.scale.set(...size); if (turn) value.rotation.set(...turn);
    Object.assign(value.userData, { shape, finish, tag }); parent.add(value); return value;
  };
  const instanced = (rig, count) => {
    const nodes = []; rig.traverse(value => { if (value.userData.finish) nodes.push(value); });
    // All body panels, wheels and limbs share the complete rig's ground
    // anchor. Keep its source matrices intact; the map adapter uses this live
    // array to apply one rigid placement to the assembled object.
    const anchors = new Float32Array(count * 2);
    const meshes = nodes.map(value => {
      const instances = new THREE.InstancedMesh(value.userData.shape, value.userData.finish, count);
      instances.userData.colonyMapFit = { mode: 'rigid', anchors };
      instances.castShadow = false; instances.receiveShadow = true; instances.frustumCulled = false; root.add(instances); return instances;
    });
    return {
      place: (index) => {
        anchors[index * 2] = rig.position.x; anchors[index * 2 + 1] = rig.position.z;
        rig.updateMatrixWorld(true); nodes.forEach((value, n) => meshes[n].setMatrixAt(index, value.matrixWorld));
      },
      paint: (index, tag, colour) => nodes.forEach((value, n) => { if (value.userData.tag === tag) meshes[n].setColorAt(index, colour); }),
      commit: () => meshes.forEach(instances => {
        instances.instanceMatrix.needsUpdate = true;
        // The adapter installs this attribute on a geometry clone. Fetch it
        // from the current geometry so animation updates the uploaded buffer.
        const anchorAttribute = instances.geometry.getAttribute('aColonyMapAnchor');
        if (anchorAttribute) anchorAttribute.needsUpdate = true;
      }),
    };
  };
  const tyre = kit.geometry(new THREE.CylinderGeometry(.5, .5, 1, 12)), plane = kit.geometry(new THREE.PlaneGeometry(1, 1));
  const capsule = kit.geometry(new THREE.CapsuleGeometry(.5, 1, 3, 8)), ball = kit.geometry(new THREE.SphereGeometry(.5, 10, 8));
  const blobMap = kit.canvasTexture(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }, { wrap: false });
  const blobShadow = kit.track(new THREE.MeshBasicMaterial({ map: blobMap, transparent: true, depthWrite: false }));
  const groundShadow = (rig, width, depth) => node(rig, [0, .003, 0], { shape: plane, finish: blobShadow, size: [width, depth, 1], turn: [-Math.PI / 2, 0, 0] });
  const paint = kit.material('#ffffff', { roughness: .3, metalness: .5, envMapIntensity: 1.2 }), rubber = kit.material('#151617', { roughness: .9 }), chrome = kit.material('#c9ccd0', { roughness: .25, metalness: .9 });
  const headLamp = kit.material('#fff6d8', { emissive: '#fff1c4', emissiveIntensity: 1.2 }), tailLamp = kit.material('#ff3a2a', { emissive: '#d0180c', emissiveIntensity: 1 });
  const wheel = (rig, x, z, diameter, width) => node(rig, [x, diameter / 2, z], { shape: tyre, finish: rubber, size: [diameter, width, diameter], turn: [Math.PI / 2, 0, 0] });
  const along = new THREE.Vector3();
  const follow = (rig, { curve, length }, distance) => {
    const u = (distance / length) % 1; curve.getPointAt(u, rig.position); curve.getTangentAt(u, along); rig.rotation.y = Math.atan2(-along.z, along.x);
  };
  // Closed paths through plan points; long edges are densified so the
  // spline stays straight, and short end segments become smooth U-turns.
  const route = (points, y = .022) => {
    const dense = points.flatMap((a, i) => { const b = points[(i + 1) % points.length], steps = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 60)); return Array.from({ length: steps }, (_, s) => [a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps]); });
    const curve = new THREE.CatmullRomCurve3(dense.map(point => { const [x, z] = world(point); return new THREE.Vector3(x, y, z); }), true, 'centripetal');
    curve.arcLengthDivisions = Math.max(200, dense.length * 12); return { curve, length: curve.getLength() };
  };

  // The corner park keeps a paved loop with benches facing it. The four plaza
  // gardens follow the printed plan (see plazaLayout.js): people stroll the
  // walk along each arc and sit on its benches facing the fountain.
  const parks = plan.landscaping.filter(({ polygon }) => !isPlazaGarden(plan, polygon)).map(({ polygon }) => {
    const xs = polygon.map(p => p[0]), ys = polygon.map(p => p[1]), minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const [x0, x1] = [minX + 12, maxX - 12], top = minY + 22, bottom = maxY - 22, mid = (x0 + x1) / 2;
    return { x0, x1, top, bottom, mid, path: route([[x0, top], [x1, top], [x1, bottom], [x0, bottom]], .028), benches: [[mid + 8, top + 9, Math.PI / 2], [mid - 8, bottom - 9, -Math.PI / 2]] };
  });
  const plaza = plazaLayout(plan, ctx.siteFit), arcPoint = plaza.arcPoint;
  const gardens = plaza.gardens.map(garden => {
    const [a0, a1] = garden.arc, steps = Array.from({ length: 13 }, (_, i) => a0 + (a1 - a0) * i / 12);
    const xs = garden.polygon.map(p => p[0]), ys = garden.polygon.map(p => p[1]);
    return { ...garden, west: (Math.min(...xs) + Math.max(...xs)) / 2 < cx, north: (Math.min(...ys) + Math.max(...ys)) / 2 < cy, mid: (a0 + a1) / 2,
      path: route([...steps.map(a => arcPoint(a, 7)), ...steps.reverse().map(a => arcPoint(a, 10.5))], HEIGHTS.garden + .002) };
  });
  const footpaths = [];
  parks.forEach(({ x0, x1, top, bottom }) => [[x0, top, x1, top], [x0, bottom, x1, bottom], [x0, top, x0, bottom], [x1, top, x1, bottom]].forEach(([ax, ay, bx, by]) => {
    const [x, z] = world([(ax + bx) / 2, (ay + by) / 2]); footpaths.push([[Math.abs(bx - ax) * SCALE + .1, .004, Math.abs(by - ay) * SCALE + .1], [x, .026, z]]);
  }));
  const paths = kit.boxes(paving, footpaths, root);
  paths.castShadow = false; paths.userData.colonyMapFit = { mode: 'surface' };
  const benchRig = new THREE.Object3D(), wood = kit.material('#8b5a33', { roughness: .8 });
  node(benchRig, [0, .034, 0], { size: [.04, .006, .15], finish: wood }); node(benchRig, [-.021, .056, 0], { size: [.006, .03, .15], finish: wood });
  for (const z of [-.06, .06]) node(benchRig, [0, .017, z], { size: [.034, .034, .006], finish: dark });
  const benchSpots = [...parks.flatMap(park => park.benches), ...gardens.flatMap(garden => garden.benches)], benches = instanced(benchRig, benchSpots.length);
  benchSpots.forEach(([x, y, heading], i) => { const [wx, wz] = world([x, y]); benchRig.position.set(wx, .024, wz); benchRig.rotation.y = heading; benches.place(i); });
  benches.commit();

  // Light traffic: vehicles sharing a loop share a speed, so they never collide.
  const arc = (from, to) => Array.from({ length: 5 }, (_, i) => { const a = (from + (to - from) * i / 4) * Math.PI / 180; return [cx + Math.cos(a) * 66, cy + Math.sin(a) * 66]; });
  const boulevardRoad = plan.roads.find(road => road.kind === 'boulevard');
  const frontTurn = ctx.frontage ? Math.max(...boulevardRoad.polygon.map(p => p[1])) - 12 : 1290;
  const boulevard = route([[660, frontTurn], [660, 760], ...arc(100, 260), [660, 470], [660, 112], [680, 112], [680, 470], ...arc(280, 440), [680, 760], [680, frontTurn]]);
  const lanes = crossroads.map(({ polygon: p }) => {
    const middle = (p[0][1] + p[2][1]) / 2, lane = (p[2][1] - p[0][1]) * .25, start = Math.min(...p.map(q => q[0])) + 14, end = Math.min(p[1][0], p[2][0]) - 16;
    return route([[start, middle - lane], [end, middle - lane], [end, middle + lane], [start, middle + lane]]);
  });
  const fleet = [
    { kind: 'car', path: boulevard, speed: 1, phase: .05 }, { kind: 'bike', path: boulevard, speed: 1, phase: .4, pillion: true }, { kind: 'bike', path: boulevard, speed: 1, phase: .72 },
    { kind: 'car', path: lanes[1], speed: .75, phase: .3 }, { kind: 'car', path: lanes[4], speed: .8, phase: .6 }, { kind: 'car', path: lanes[6], speed: .78, phase: .5 },
    { kind: 'car', path: lanes[8], speed: .7, phase: .2 }, { kind: 'car', path: lanes[10], speed: .85, phase: .75 },
    { kind: 'bike', path: lanes[2], speed: 1.05, phase: .15 }, { kind: 'bike', path: lanes[7], speed: 1.1, phase: .55 }, { kind: 'bike', path: lanes[11], speed: .95, phase: .35, pillion: true },
  ].filter(vehicle => vehicle.path);
  const carRig = new THREE.Object3D(); groundShadow(carRig, .44, .24);
  const rounded = kit.geometry(new RoundedBoxGeometry(1, 1, 1, 3, .32));
  node(carRig, [0, .052, 0], { shape: rounded, size: [.34, .056, .16], finish: paint, tag: 'paint' });
  node(carRig, [-.018, .094, 0], { shape: rounded, size: [.2, .05, .148], finish: kit.material('#1a242d', { roughness: .08, metalness: .5 }) });
  node(carRig, [-.024, .118, 0], { shape: rounded, size: [.15, .012, .138], finish: paint, tag: 'paint' });
  node(carRig, [.171, .056, 0], { size: [.006, .016, .13], finish: headLamp }); node(carRig, [-.171, .056, 0], { size: [.006, .016, .13], finish: tailLamp });
  for (const x of [-.105, .105]) for (const z of [-.072, .072]) wheel(carRig, x, z, .05, .022);
  const bikeRig = new THREE.Object3D(); groundShadow(bikeRig, .22, .07);
  wheel(bikeRig, -.062, 0, .05, .012); wheel(bikeRig, .062, 0, .05, .012);
  node(bikeRig, [.004, .05, 0], { size: [.095, .03, .026], finish: paint, tag: 'paint' }); node(bikeRig, [-.036, .068, 0], { size: [.062, .012, .03], finish: rubber });
  node(bikeRig, [.056, .057, 0], { size: [.007, .062, .007], finish: chrome, turn: [0, 0, .35] }); node(bikeRig, [.046, .088, 0], { size: [.007, .007, .07], finish: rubber });
  node(bikeRig, [.06, .078, 0], { size: [.006, .013, .013], finish: headLamp }); node(bikeRig, [-.066, .045, .018], { size: [.06, .008, .008], finish: chrome });
  const cars = instanced(carRig, fleet.filter(v => v.kind === 'car').length), bikes = instanced(bikeRig, fleet.filter(v => v.kind === 'bike').length);
  const vehicleColours = ['#f2f2ef', '#b8bcc2', '#1c1e21', '#a8141c', '#21508f', '#6f747b'];
  fleet.forEach((vehicle, i) => { vehicle.index = fleet.slice(0, i).filter(v => v.kind === vehicle.kind).length; (vehicle.kind === 'car' ? cars : bikes).paint(vehicle.index, 'paint', new THREE.Color(vehicleColours[i % vehicleColours.length])); });

  // People: one jointed rig (pelvis, spine, hips, knees, shoulders) posed per
  // person per frame, ~1.35x true scale like the vehicles so they read.
  const flesh = kit.material('#ffffff', { roughness: .8 });
  const personRig = new THREE.Object3D(); groundShadow(personRig, .07, .07);
  const pelvis = node(personRig, [0, .075, 0]), spine = node(pelvis, [0, 0, 0]);
  node(spine, [0, .026, 0], { shape: capsule, finish: flesh, tag: 'shirt', size: [.024, .028, .036] });
  node(spine, [0, .066, 0], { shape: ball, finish: flesh, tag: 'skin', size: [.021, .023, .021] });
  node(spine, [-.002, .071, 0], { shape: ball, finish: flesh, tag: 'hair', size: [.022, .015, .022] });
  const shoulders = [.021, -.021].map(z => { const joint = node(spine, [0, .047, z]); node(joint, [0, -.027, 0], { shape: capsule, finish: flesh, tag: 'shirt', size: [.011, .027, .011] }); return joint; });
  const hips = [.0095, -.0095].map(z => node(pelvis, [0, 0, z]));
  const knees = hips.map(hip => { node(hip, [0, -.018, 0], { shape: capsule, finish: flesh, tag: 'pants', size: [.014, .018, .014] }); const knee = node(hip, [0, -.036, 0]); node(knee, [0, -.018, 0], { shape: capsule, finish: flesh, tag: 'pants', size: [.012, .018, .012] }); return knee; });
  const pose = (height, hipL, hipR, kneeL, kneeR, armL, armR, lean) => {
    pelvis.position.y = height; spine.rotation.z = lean; hips[0].rotation.z = hipL; hips[1].rotation.z = hipR; knees[0].rotation.z = kneeL; knees[1].rotation.z = kneeR;
    shoulders[0].rotation.set(-.1, 0, armL); shoulders[1].rotation.set(.1, 0, armR);
  };
  // Gait: legs swing opposite, the swinging leg's knee flexes, arms counter-
  // swing, and the body dips at double support. Running adds lean and lift.
  const stride = (phase, run) => {
    const s = Math.sin(phase), c = Math.cos(phase), swing = .42 + run * .3, knee = .65 + run * .75, arms = .32 + run * .5;
    pose(.075 + (.0025 + run * .004) * Math.cos(2 * phase), swing * s, -swing * s, -knee * Math.max(0, c) - .06, -knee * Math.max(0, -c) - .06, -arms * s, arms * s, -.04 - run * .16);
  };
  const people = [];
  const walker = (path, options = {}) => people.push({ mode: 'walk', path, speed: .13, phase: random(), side: 0, size: .94 + random() * .12, ...options });
  const still = (mode, point, heading, options = {}) => { const [x, z] = world(point); people.push({ mode, x, z, heading, ground: .024, side: 0, seed: random() * 9, size: .94 + random() * .12, ...options }); };
  const facing = (from, to) => Math.atan2(from[1] - to[1], to[0] - from[0]);
  // Street: strollers on the shop forecourts, and pacers along road edges.
  if (!ctx.frontage) {
    const forecourtWest = route([[300, 1255], [600, 1255], [600, 1282], [300, 1282]], .017), forecourtEast = route([[760, 1265], [1050, 1265], [1050, 1290], [760, 1290]], .017);
    walker(forecourtWest, { speed: .11, phase: .2, side: .011 }); walker(forecourtWest, { speed: .11, phase: .2, side: -.011 });
    walker(forecourtEast, { phase: .1 }); walker(forecourtEast, { phase: .6, speed: .12 });
  }
  const frontWalk = ctx.frontage ? frontTurn : 1180;
  walker(route([[655, frontWalk], [655, 730], [652, 730], [652, frontWalk]], .019)); walker(route([[685, 730], [685, frontWalk], [688, frontWalk], [688, 730]], .019));
  walker(route([[110, 803.5], [610, 803.5], [610, 806.5], [110, 806.5]], .019)); walker(route([[720, 827], [1180, 827], [1180, 824], [720, 824]], .019));
  // Parks: walkers, a jogger, a strolling couple, bench sitters, a chat, kids at play.
  const corner = parks[0];
  const [northWest, southWest, northEast, southEast] = [[true, true], [true, false], [false, true], [false, false]].map(([west, north]) => gardens.find(garden => garden.west === west && garden.north === north));
  walker(northWest.path, { phase: .1, speed: .1 }); walker(northWest.path, { phase: .55, speed: .11 });
  walker(southWest.path, { mode: 'run', speed: .22 });
  walker(northEast.path, { phase: .3, speed: .09, side: .011 }); walker(northEast.path, { phase: .3, speed: .09, side: -.011 });
  walker(southEast.path, { phase: .7, speed: .1 });
  const sit = (bench, side = 0) => still('sit', bench, bench[2], { side });
  sit(northWest.benches[0]); sit(southWest.benches[1]); sit(northEast.benches[0]); sit(southEast.benches[1], .035); sit(southEast.benches[1], -.035); if (corner) sit(corner.benches[0]);
  // Two neighbours chatting on the south-west lawn, a little way back from the walk.
  const chatA = arcPoint(southWest.mid - .08, 26), chatB = arcPoint(southWest.mid + .02, 27);
  still('stand', chatA, facing(chatA, chatB)); still('stand', chatB, facing(chatB, chatA));
  if (corner) {
    const playground = [(corner.x0 + corner.x1) / 2, (corner.top + corner.bottom) / 2];
    const kidsLoop = route(Array.from({ length: 8 }, (_, i) => [playground[0] + Math.cos(i / 8 * Math.PI * 2) * 10, playground[1] + Math.sin(i / 8 * Math.PI * 2) * 7]), .024);
    walker(kidsLoop, { mode: 'run', speed: .2, phase: 0, size: .62 }); walker(kidsLoop, { mode: 'run', speed: .2, phase: .45, size: .58 });
    const parent = [playground[0] + 24, playground[1] - 2]; still('stand', parent, facing(parent, playground));
  }
  // Riders sit on the motorcycles; a pillion rides behind on some.
  fleet.filter(v => v.kind === 'bike').forEach(vehicle => {
    people.push({ mode: 'ride', vehicle, seat: -.022, size: 1 });
    if (vehicle.pillion) people.push({ mode: 'pillion', vehicle, seat: -.068, size: .96 });
  });
  const crowd = instanced(personRig, people.length);
  const skinTones = ['#8d5a3b', '#a8714a', '#6e4530', '#c08a60', '#7b4d33'], shirtColours = ['#f4f1ea', '#2f5d8c', '#b0302c', '#e3b23c', '#3f6b45', '#d77fa1', '#5b4b8a', '#ececec', '#1f2a36', '#e07a2e'];
  const trouserColours = ['#1f2633', '#2d2d2d', '#5a4a3a', '#3a4b63', '#c8b99a', '#4a4a4a'], hairColours = ['#141110', '#231a14', '#2e2620', '#0d0d0d', '#6b6b6b'], helmets = ['#111214', '#c62828', '#f2f2f2', '#1e4fa0'];
  const pick = list => new THREE.Color(list[Math.floor(random() * list.length)]);
  people.forEach((person, i) => {
    const top = pick(shirtColours);
    crowd.paint(i, 'shirt', top); crowd.paint(i, 'pants', random() < .3 ? top : pick(trouserColours)); crowd.paint(i, 'skin', pick(skinTones));
    crowd.paint(i, 'hair', pick(person.mode === 'ride' || person.mode === 'pillion' ? helmets : hairColours));
  });
  const placeRider = (person, seconds) => {
    const { vehicle } = person; follow(personRig, vehicle.path, seconds * vehicle.speed + vehicle.phase * vehicle.path.length);
    personRig.position.addScaledVector(along.set(Math.cos(personRig.rotation.y), 0, -Math.sin(personRig.rotation.y)), person.seat);
    if (person.mode === 'ride') pose(.079, 1.15, 1.15, -1.55, -1.55, 1.2, 1.2, -.28); else pose(.083, 1.2, 1.2, -1.6, -1.6, .35, .35, -.08);
  };
  return {
    update: (seconds) => {
      fleet.forEach(vehicle => {
        const rig = vehicle.kind === 'car' ? carRig : bikeRig;
        follow(rig, vehicle.path, seconds * vehicle.speed + vehicle.phase * vehicle.path.length); (vehicle.kind === 'car' ? cars : bikes).place(vehicle.index);
      });
      cars.commit(); bikes.commit();
      people.forEach((person, i) => {
        personRig.scale.setScalar(person.size);
        if (person.vehicle) placeRider(person, seconds);
        else if (person.path) {
          const distance = seconds * person.speed + person.phase * person.path.length, run = person.mode === 'run' ? 1 : 0;
          follow(personRig, person.path, distance); stride(distance / ((.13 + run * .09) * person.size) * Math.PI * 2, run);
        } else {
          const t = seconds + person.seed;
          personRig.position.set(person.x, person.ground, person.z); personRig.rotation.y = person.heading;
          if (person.mode === 'sit') pose(.043, 1.5, 1.5, -1.5, -1.5, .45, .45 + .2 * Math.max(0, Math.sin(t * .5)) ** 2, .1);
          else { const talk = Math.max(0, Math.sin(t * .9)) ** 3; pose(.075 + .001 * Math.sin(t * 1.3), 0, .04, -.03, -.06, .06 + .04 * Math.sin(t * .7), -.05 + .7 * talk, 0); personRig.rotation.y += .12 * Math.sin(t * .3); }
        }
        // Couples and shared benches: offset sideways from the shared path.
        if (person.side) personRig.position.addScaledVector(along.set(Math.sin(personRig.rotation.y), 0, Math.cos(personRig.rotation.y)), person.side);
        crowd.place(i);
      });
      crowd.commit();
    },
  };
}
