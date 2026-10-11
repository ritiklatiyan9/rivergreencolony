// Single-storey shop rows on the south frontage: plastered pillars between
// units, signboard band, rolling shutters (some up, lit inside), canopy, front
// step, parapet, and tanks/AC units at the back edge of the roofs. Roof tops sit
// exactly at HEIGHTS.shopRoof and carry the live availability colour.
const SIGNS = ['RIVER GREEN SALES OFFICE', 'SHARMA GENERAL STORE', 'GUPTA MEDICAL HALL', 'KRISHNA SWEETS', 'MOBILE POINT', 'AGARWAL HARDWARE',
  'DAIRY FRESH', 'NEW STYLE SALON', 'PHOTOSTAT & CYBER', 'KIRANA STORE', '', '', '', '', '', ''];
const SIGN_COLOURS = [['#1f5f3a', '#f5f1e4'], ['#b3261e', '#fff6e0'], ['#0f4c81', '#ffffff'], ['#f2b705', '#3a2a10'], ['#2b2b2b', '#ffd34d'], ['#e8e4da', '#2f3a30']];

export function buildShops({ THREE, plan, kit, world, SCALE, HEIGHTS, root, statusColours }, batch, mat) {
  const random = kit.rng(4242), top = HEIGHTS.shopRoof, floor = HEIGHTS.forecourt;
  const signMap = kit.canvasTexture(1024, 512, (c, w) => {
    SIGNS.forEach((text, i) => {
      const x = (i % 2) * 512, y = Math.floor(i / 2) * 64, [bg, fg] = text ? SIGN_COLOURS[i % SIGN_COLOURS.length] : ['#e9e6de', '#e9e6de'];
      c.fillStyle = bg; c.fillRect(x, y, 512, 64); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, y + 58, 512, 6); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x, y, 512, 4);
      if (!text) { c.strokeStyle = 'rgba(0,0,0,.08)'; c.strokeRect(x + 170.5, y + .5, 1, 63); c.strokeRect(x + 340.5, y + .5, 1, 63); return; }
      c.fillStyle = fg; c.font = '700 34px "Arial Narrow", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x + 256, y + 33, 470);
    });
  }, { wrap: false });
  const shutterMap = kit.canvasTexture(64, 256, (c, w, h) => {
    c.fillStyle = '#a3a6a6'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) { c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(0, y, w, 2); c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(0, y + 6, w, 2); }
    c.fillStyle = 'rgba(70,60,40,.25)'; c.fillRect(0, h - 40, w, 40); c.fillStyle = '#4a4c4e'; c.fillRect(w / 2 - 6, h - 22, 12, 6);
  }, { wrap: false });
  const interiorMap = kit.canvasTexture(256, 128, (c, w, h) => {
    c.fillStyle = '#e9c98f'; c.fillRect(0, 0, w, h); c.fillStyle = '#c99d63'; c.fillRect(0, h * .78, w, h * .22);
    const goods = ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60', '#ecf0f1', '#8e44ad', '#e67e22'];
    for (let row = 0; row < 4; row += 1) for (let x = 6; x < w - 6; x += 7) { c.fillStyle = goods[Math.floor(random() * goods.length)]; c.fillRect(x, 14 + row * 20, 5, 12 - random() * 5); }
    for (let row = 0; row < 5; row += 1) { c.fillStyle = '#7a5532'; c.fillRect(0, 26 + row * 20 - 20, w, 3); }
    c.fillStyle = '#fff8e6'; c.fillRect(w * .2, 2, w * .6, 4);
    const shade = c.createLinearGradient(0, 0, w, 0); shade.addColorStop(0, 'rgba(40,25,10,.55)'); shade.addColorStop(.18, 'rgba(40,25,10,0)'); shade.addColorStop(.82, 'rgba(40,25,10,0)'); shade.addColorStop(1, 'rgba(40,25,10,.55)'); c.fillStyle = shade; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(40,25,10,.35)'; c.fillRect(0, 0, w, 8); c.fillStyle = '#6b4b2c'; c.fillRect(w * .1, h * .62, w * .55, h * .2);
  }, { wrap: false });
  const signs = kit.material('#ffffff', { map: signMap, roughness: .55 });
  const shutter = kit.material('#ffffff', { map: shutterMap, roughness: .5, metalness: .45 });
  const interior = kit.material('#ffffff', { map: interiorMap, emissive: '#ffffff', emissiveMap: interiorMap, emissiveIntensity: .32, roughness: .8 });

  const shops = plan.plots.filter(plot => plot.number.startsWith('S'));
  const plane = new THREE.PlaneGeometry(1, 1), tank = new THREE.CylinderGeometry(.036, .036, .07, 14);
  shops.forEach((plot) => {
    const polygon = plot.geometry.polygon, xs = polygon.map(p => p[0]), ys = polygon.map(p => p[1]);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const frontXs = plot.cornerShop ? polygon.filter(([, y]) => Math.abs(y - maxY) < 1e-6).map(([x]) => x) : xs;
    const [x0] = world([Math.min(...frontXs), 0]), [x1] = world([Math.max(...frontXs), 0]), [, back] = world([0, minY]), [, front] = world([0, maxY]);
    const width = x1 - x0, depth = front - back, cx = (x0 + x1) / 2;
    const [anchorX] = world([(Math.min(...xs) + Math.max(...xs)) / 2, 0]);
    batch.withAsset([anchorX, (front + back) / 2], () => {
      if (plot.cornerShop) {
        // S1 follows the actual tapered corner: body and roof use the same
        // polygon, while its shutter faces the row's straight front edge.
        const body = new THREE.ExtrudeGeometry(kit.shapeFromPolygon(polygon), { depth: top - .012 - floor, bevelEnabled: false, curveSegments: 1 });
        body.rotateX(-Math.PI / 2); body.translate(0, floor, 0);
        batch.add(mat.plaster, body); body.dispose();
      } else batch.addBox(mat.plaster, [width, top - .012 - floor, depth], [cx, (top - .012 + floor) / 2, (front + back) / 2]);
      // Pillar on the left edge of each unit (rows end with an extra pillar).
      for (const x of [x0, x1]) batch.addBox(mat.plaster, [.04, top - .012 - floor, .03], [x, (top + floor) / 2 - .006, front + .006]);
      batch.addBox(mat.trim, [width, .012, .095], [cx, .262, front + .047]);
      batch.addBox(mat.concrete, [width + .002, .014, .07], [cx, floor + .007, front + .035]);
      // Signboard band between the pillars.
      const sign = plot.number === 'S18' ? 0 : random() < .55 ? 1 + Math.floor(random() * 9) : 10 + Math.floor(random() * 6);
      const g = plane.clone(), uv = g.getAttribute('uv'), u0 = (sign % 2) / 2, v0 = 1 - (Math.floor(sign / 2) + 1) / 8;
      for (let i = 0; i < uv.count; i += 1) uv.setXY(i, u0 + uv.getX(i) * .5, v0 + uv.getY(i) / 8);
      batch.add(signs, g, [cx, .304, front + .0035], 0, [width - .04, .055, 1]); g.dispose();
      // Shutter down, or rolled up over a lit interior.
      const open = plot.number === 'S18' || random() < .22, high = .25, low = floor + .014;
      if (open) {
        batch.add(interior, plane, [cx, (high + low) / 2, front + .002], 0, [width - .05, high - low, 1]);
        batch.addBox(mat.metal, [width - .045, .018, .02], [cx, high + .003, front + .01]);
      } else batch.add(shutter, plane, [cx, (high + low) / 2, front + .002], 0, [width - .045, high - low, 1]);
      // Back edge of the roof only: tank on a stand, or an AC unit.
      const pick = random();
      if (pick < .45) {
        const tx = cx + (random() - .5) * width * .4;
        batch.addBox(mat.concrete, [.09, .02, .09], [tx, top + .01, back + .08]);
        batch.add(mat.tank, tank, [tx, top + .055, back + .08]);
      } else if (pick < .75) batch.addBox(mat.trim, [.07, .045, .03], [cx + (random() - .5) * width * .4, top + .022, back + .04]);
    });
  });
  plane.dispose(); tank.dispose();
  buildParapets({ kit, world, top }, batch, mat, shops);
  return buildRoofs({ THREE, kit, root, top, statusColours }, shops);
}

// One parapet around each row (consecutive units share the same front line).
function buildParapets({ world, top }, batch, mat, shops) {
  const rows = new Map();
  shops.forEach((plot) => {
    const ys = plot.geometry.polygon.map(p => p[1]), xs = plot.geometry.polygon.map(p => p[0]), key = Math.max(...ys);
    const row = rows.get(key) || { x0: Infinity, x1: -Infinity, y0: Math.min(...ys), y1: key, shops: [] }; row.x0 = Math.min(row.x0, ...xs); row.x1 = Math.max(row.x1, ...xs); row.shops.push(plot); rows.set(key, row);
  });
  rows.forEach(({ x0, x1, y0, y1, shops: row }) => {
    if (row.some(plot => plot.cornerShop)) {
      const points = row.flatMap(plot => plot.geometry.polygon);
      const back = points.filter(([, y]) => Math.abs(y - y0) < 1e-6).map(([x]) => x), front = points.filter(([, y]) => Math.abs(y - y1) < 1e-6).map(([x]) => x);
      const outline = [[Math.min(...back), y0], [Math.max(...back), y0], [Math.max(...front), y1], [Math.min(...front), y1]].map(world);
      const centre = outline.reduce((sum, p) => [sum[0] + p[0] / 4, sum[1] + p[1] / 4], [0, 0]);
      outline.forEach((a, i) => {
        const b = outline[(i + 1) % 4], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz), yaw = -Math.atan2(dz, dx);
        let inward = [-dz / length, dx / length];
        if ((centre[0] - (a[0] + b[0]) / 2) * inward[0] + (centre[1] - (a[1] + b[1]) / 2) * inward[1] < 0) inward = inward.map(value => -value);
        const at = y => [(a[0] + b[0]) / 2 + inward[0] * .02, y, (a[1] + b[1]) / 2 + inward[1] * .02];
        batch.addBox(mat.plaster, [length - .04, .04, .016], at(top + .02), yaw);
        batch.addBox(mat.trim, [length - .04, .008, .026], at(top + .044), yaw);
      });
      return;
    }
    const [ax, az] = world([x0, y0]), [bx, bz] = world([x1, y1]), h = .04, t = .016, w = bx - ax, d = bz - az;
    batch.addBox(mat.plaster, [w + .03, h + .012, t], [(ax + bx) / 2, top + h / 2 - .006, bz + .007]);
    batch.addBox(mat.plaster, [w, h, t], [(ax + bx) / 2, top + h / 2, az + t / 2]);
    for (const x of [ax + t / 2, bx - t / 2]) batch.addBox(mat.plaster, [t, h, d], [x, top + h / 2, (az + bz) / 2]);
    batch.addBox(mat.trim, [w + .04, .008, t + .01], [(ax + bx) / 2, top + h + .004, bz + .007]);
  });
}

// Roof slabs: one merged mesh; each unit's top face carries its status colour.
function buildRoofs({ THREE, kit, root, top, statusColours }, shops) {
  const random = kit.rng(5150);
  const roofMap = kit.canvasTexture(256, 256, (c, size) => {
    c.fillStyle = '#e6e3dc'; c.fillRect(0, 0, size, size);
    kit.blobs(c, size, 26, ['rgba(60,55,45,.08)', 'rgba(255,255,255,.18)'], 18, 60, random);
    kit.speckle(c, size, 5000, ['rgba(0,0,0,.12)', 'rgba(255,255,255,.2)'], random, 1, 1);
  }, { repeat: 2 });
  const natural = new THREE.Color('#cdc8bd'), side = new THREE.Color('#d9d4c8');
  const palette = Object.fromEntries(Object.entries(statusColours).map(([status, hex]) => [status, new THREE.Color(hex)]));
  const positions = [], normals = [], uvs = [], colours = [], anchors = [], rigid = [], tops = new Map();
  shops.forEach((plot) => {
    const polygon = plot.geometry.polygon, xs = polygon.map(p => p[0]), ys = polygon.map(p => p[1]);
    const anchor = kit.world([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]);
    const shape = new THREE.ExtrudeGeometry(kit.shapeFromPolygon(plot.geometry.polygon), { depth: .012, bevelEnabled: false, curveSegments: 1 });
    shape.rotateX(-Math.PI / 2); shape.translate(0, top - .012, 0);
    const p = shape.getAttribute('position'), n = shape.getAttribute('normal'), uv = shape.getAttribute('uv'), list = [];
    for (let i = 0; i < p.count; i += 1) {
      if (n.getY(i) > .5) list.push(positions.length / 3);
      positions.push(p.getX(i), p.getY(i), p.getZ(i)); normals.push(n.getX(i), n.getY(i), n.getZ(i)); uvs.push(uv.getX(i), uv.getY(i)); colours.push(side.r, side.g, side.b);
      anchors.push(...anchor); rigid.push(1);
    }
    shape.dispose(); tops.set(plot.number, list);
  });
  const geometry = kit.geometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setAttribute('aColonyMapAnchor', new THREE.Float32BufferAttribute(anchors, 2));
  geometry.setAttribute('aColonyMapRigid', new THREE.Float32BufferAttribute(rigid, 1));
  kit.mesh(geometry, kit.material('#ffffff', { map: roofMap, vertexColors: true, roughness: .9 }), root);
  const colour = geometry.getAttribute('color');
  return (statuses) => {
    tops.forEach((list, number) => { const status = statuses.get(number), { r, g, b } = status !== 'UNKNOWN' && palette[status] || natural; list.forEach(i => colour.setXYZ(i, r, g, b)); });
    colour.needsUpdate = true;
  };
}
