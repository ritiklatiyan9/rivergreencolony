// Parked cars in front of the villas: BMW saloon, Range Rover (black floating
// roof) and Mahindra Scorpio (boxy, roof rails, chrome grille). Each model is
// side-profile silhouettes extruded across its width (body, glasshouse, roof)
// plus wheels, lamps and grille parts. Car space: x forward, y up, z right.
// Colours per model: [white, black, silver/grey, accent] (sitePlots.js picks by weight).
const MODELS = {
  bmw: {
    width: .165, wheel: .034, axle: .13, roofKey: 'paint',
    body: [[-.2, .03], [.198, .03], [.205, .048], [.2, .06], [.09, .068], [-.12, .07], [-.198, .068], [-.205, .048]],
    glass: [[.095, .068], [.02, .108], [-.075, .111], [-.155, .072]], roof: [[.024, .104], [.018, .114], [-.074, .116], [-.08, .106]],
    colours: ['#f1f1ee', '#0e1013', '#8f949a', '#1d3557'],
    parts: [['black', [.006, .014, .022], [.205, .05, .019]], ['black', [.006, .014, .022], [.205, .05, -.019]],
      ['lamp', [.006, .008, .03], [.203, .058, .06]], ['lamp', [.006, .008, .03], [.203, .058, -.06]],
      ['tail', [.006, .01, .04], [-.205, .058, .058]], ['tail', [.006, .01, .04], [-.205, .058, -.058]]],
  },
  rangerover: {
    width: .175, wheel: .04, axle: .135, roofKey: 'black',
    body: [[-.205, .032], [.2, .032], [.21, .055], [.207, .088], [.1, .094], [-.2, .097], [-.21, .07]],
    glass: [[.1, .094], [.065, .146], [-.18, .148], [-.2, .097]], roof: [[.068, .142], [.064, .153], [-.18, .155], [-.183, .144]],
    colours: ['#f3f3f0', '#151719', '#6e7276', '#2b3a2e'],
    parts: [['black', [.006, .026, .075], [.211, .068, 0]], ['lamp', [.006, .009, .036], [.209, .08, .066]], ['lamp', [.006, .009, .036], [.209, .08, -.066]],
      ['tail', [.006, .012, .036], [-.211, .08, .064]], ['tail', [.006, .012, .036], [-.211, .08, -.064]]],
  },
  scorpio: {
    width: .165, wheel: .039, axle: .125, roofKey: 'paint',
    body: [[-.193, .034], [.188, .034], [.196, .06], [.193, .092], [.075, .098], [-.19, .1], [-.197, .07]],
    glass: [[.078, .098], [.048, .152], [-.168, .154], [-.186, .1]], roof: [[.05, .148], [.047, .158], [-.168, .16], [-.17, .15]],
    colours: ['#efefea', '#121314', '#9da2a7', '#7b1717'],
    parts: [['black', [.24, .008, .008], [-.055, .166, .06]], ['black', [.24, .008, .008], [-.055, .166, -.06]],
      ...[-.04, -.02, 0, .02, .04].map(z => ['chrome', [.004, .03, .006], [.198, .068, z]]),
      ['lamp', [.006, .012, .03], [.196, .082, .062]], ['lamp', [.006, .012, .03], [.196, .082, -.062]],
      ['tail', [.006, .03, .012], [-.198, .085, .07]], ['tail', [.006, .03, .012], [-.198, .085, -.07]],
      ['black', [.37, .018, .004], [0, .044, .0835]], ['black', [.37, .018, .004], [0, .044, -.0835]]],
  },
};

export function buildCars({ THREE, kit, root }, cars) {
  const paint = kit.material('#ffffff', { metalness: .55, roughness: .26, envMapIntensity: 1.3 });
  const finishes = {
    paint, black: kit.material('#16181a', { roughness: .45, metalness: .3 }), glass: kit.material('#1b252c', { roughness: .05, metalness: .6, envMapIntensity: 1.6 }),
    chrome: kit.material('#d9dde0', { roughness: .15, metalness: 1 }), tyre: kit.material('#141516', { roughness: .9 }), rim: kit.material('#b9bec3', { roughness: .3, metalness: .85 }),
    lamp: kit.material('#f4f6f2', { emissive: '#fffbe8', emissiveIntensity: .6, roughness: .2 }), tail: kit.material('#7a0b0b', { emissive: '#b3150f', emissiveIntensity: .5, roughness: .3 }),
  };
  const extrude = (points, width, bevel = .007) => {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .8, bevelSegments: 2, curveSegments: 2 });
    geometry.translate(0, 0, -(width - bevel * 2) / 2); geometry.computeVertexNormals(); return kit.geometry(geometry);
  };
  const box = kit.geometry(new THREE.BoxGeometry(1, 1, 1)), wheel = kit.geometry(new THREE.CylinderGeometry(.5, .5, 1, 18)).rotateX(Math.PI / 2);
  const dummy = new THREE.Object3D(), colour = new THREE.Color();
  const groups = new Map(); // `${model}|${part}` -> { geometry, material, items: [{ matrix, colour }] }
  const push = (key, geometry, material, at, size, carMatrix, tint) => {
    if (!groups.has(key)) groups.set(key, { geometry, material, items: [] });
    dummy.position.set(...at); dummy.rotation.set(0, 0, 0); dummy.scale.set(...size); dummy.updateMatrix();
    groups.get(key).items.push({ matrix: new THREE.Matrix4().multiplyMatrices(carMatrix, dummy.matrix), tint,
      anchor: [carMatrix.elements[12], carMatrix.elements[14]] });
  };
  const geometries = Object.fromEntries(Object.entries(MODELS).map(([name, m]) => [name, {
    body: extrude(m.body, m.width), glass: extrude(m.glass, m.width * .9, .005), roof: extrude(m.roof, m.width * .86, .004),
  }]));
  cars.forEach(({ model, colour: shade, basis }) => {
    const m = MODELS[model], g = geometries[model], tint = colour.set(m.colours[shade % m.colours.length]).clone();
    push(`${model}|body`, g.body, paint, [0, 0, 0], [1, 1, 1], basis, tint);
    push(`${model}|glass`, g.glass, finishes.glass, [0, 0, 0], [1, 1, 1], basis);
    push(`${model}|roof`, g.roof, m.roofKey === 'paint' ? paint : finishes.black, [0, 0, 0], [1, 1, 1], basis, m.roofKey === 'paint' ? tint : undefined);
    for (const x of [-m.axle, m.axle]) for (const z of [-1, 1]) {
      const zz = z * (m.width / 2 - .014);
      push('tyre', wheel, finishes.tyre, [x, m.wheel, zz], [m.wheel * 2, m.wheel * 2, .024], basis);
      push('rim', wheel, finishes.rim, [x, m.wheel, zz + z * .0125], [m.wheel * 1.25, m.wheel * 1.25, .002], basis);
    }
    for (const [key, size, at] of m.parts) push(`${model}|${key}|box`, box, finishes[key], at, size, basis);
    push(`${model}|mirror`, box, paint, [m.axle * .55, (m.glass[0][1] + .012), m.width / 2 + .006], [.012, .01, .014], basis, tint);
    push(`${model}|mirror`, box, paint, [m.axle * .55, (m.glass[0][1] + .012), -m.width / 2 - .006], [.012, .01, .014], basis, tint);
  });
  groups.forEach(({ geometry, material, items }) => {
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    items.forEach(({ matrix: value, tint }, i) => { mesh.setMatrixAt(i, value); if (material === paint) mesh.setColorAt(i, tint || colour.set('#ffffff')); });
    mesh.userData.colonyMapFit = { mode: 'rigid', anchors: new Float32Array(items.flatMap(item => item.anchor)) };
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.instanceMatrix.needsUpdate = true; root.add(mesh);
  });
}
