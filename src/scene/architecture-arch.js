// Entrance portal spanning the boulevard, flush with the fronts of the two
// shops that flank it. The map frontage can place the complete portal at the
// marked outer gate; its pieces always retain one proportional asset frame.
export function buildArch({ THREE, plan, kit, world, SCALE, HEIGHTS, entrancePoint, entranceYaw = 0 }, batch, mat) {
  const random = kit.rng(8128);
  const boulevard = plan.roads.find(road => road.kind === 'boulevard').polygon;
  const left = Math.min(...boulevard.map(p => p[0])), right = Math.max(...boulevard.map(p => p[0]));
  const flanking = plan.plots.filter(plot => plot.number.startsWith('S') && plot.geometry.polygon.some(([x]) => Math.abs(x - left) < 1e-6 || Math.abs(x - right) < 1e-6))
    .map(plot => Math.max(...plot.geometry.polygon.map(([, y]) => y)));
  const [gx, gz] = world(entrancePoint || [(left + right) / 2, flanking.reduce((sum, y) => sum + y, 0) / flanking.length]);
  const half = (right - left) * SCALE / 2, y0 = HEIGHTS.forecourt;
  const c = Math.cos(entranceYaw), s = Math.sin(entranceYaw);
  const at = (x, y, z = 0) => [gx + c * x + s * z, y0 + y, gz - s * x + c * z];
  const box = (material, size, position) => batch.addBox(material, size, position, entranceYaw);
  batch.withAsset([gx, gz], () => {

    const stoneMap = kit.canvasTexture(256, 512, (c, w, h) => {
      c.fillStyle = '#d9cdb4'; c.fillRect(0, 0, w, h);
      for (let row = 0; row < 8; row += 1) for (let col = 0; col < 2; col += 1) {
        const tone = 200 + random() * 30; c.fillStyle = `rgb(${tone + 14},${tone + 2},${tone - 22})`; c.fillRect(col * 128 + 2, row * 64 + 2, 124, 60);
        for (let k = 0; k < 40; k += 1) { c.fillStyle = `rgba(120,95,60,${random() * .12})`; c.fillRect(col * 128 + random() * 124, row * 64 + random() * 60, 1 + random() * 14, 1); }
      }
    }, { wrap: false });
    const stone = kit.material('#ffffff', { map: stoneMap, roughness: .75 });

    // Pillar: granite plinth, plaster core, stone cladding front and back.
    const px = -half - .1, H = .84;
    box(mat.granite, [.25, .05, .25], at(px, .025));
    box(mat.plaster, [.2, H, .2], at(px, H / 2));
    for (const z of [-.103, .103]) box(stone, [.17, H - .1, .006], at(px, .05 + (H - .1) / 2 + .01, z));
    for (const x of [px - .103, px + .103]) box(stone, [.006, H - .1, .17], at(x, .05 + (H - .1) / 2 + .01));
    // Beam with a reveal line, cornice and soffit downlights.
    const span = [px - .1, half + .16], bw = span[1] - span[0], bx = (span[0] + span[1]) / 2;
    box(mat.plaster, [bw, .17, .22], at(bx, H + .085));
    for (const z of [-.111, .111]) {
      box(mat.granite, [bw - .06, .008, .004], at(bx, H + .05, z));
      box(stone, [bw - .06, .05, .004], at(bx, H + .115, z));
    }
    box(mat.trim, [bw + .03, .016, .25], at(bx, H + .178));
    box(mat.trim, [bw + .01, .012, .23], at(bx, H - .006));
    const lamp = kit.material('#fff6dc', { emissive: '#ffe2a8', emissiveIntensity: 1.2 });
    for (let x = -half + .1; x < half; x += .2) box(lamp, [.02, .004, .02], at(x, H - .013));
    // Fin screen on the east side.
    for (let i = 0; i < 6; i += 1) box(mat.plaster, [.016, H, .2], at(half + .015 + i * .027, H / 2));
    box(mat.granite, [.17, .03, .23], at(half + .082, .015));
    // Wall lanterns either side of the pillar's front face.
    for (const z of [-.11, .11]) { box(mat.iron, [.03, .05, .02], at(px, .55, z + Math.sign(z) * .012)); box(lamp, [.018, .03, .004], at(px, .55, z + Math.sign(z) * .023)); }

    // Lettering: one atlas (name + plaque line), standing letters with a darker
    // offset copy behind for thickness, and a granite plaque on the pillar.
    const letters = kit.canvasTexture(1024, 256, (c) => {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '700 150px Georgia, "Times New Roman", serif'; c.fillStyle = '#1f6b3c'; c.fillText('River Green', 512, 100, 1000);
      c.font = '600 40px Georgia, serif'; c.fillStyle = '#d8b56a'; c.fillText('RESIDENTIAL  COLONY', 512, 226, 1000);
    }, { wrap: false });
    const face = kit.material('#ffffff', { map: letters, alphaTest: .45, side: THREE.DoubleSide, roughness: .4 });
    const edge = kit.material('#0e3a20', { map: letters, alphaTest: .45, side: THREE.DoubleSide, roughness: .6 });
    face.userData.noCast = edge.userData.noCast = true;
    const plane = (v0, v1) => { const g = new THREE.PlaneGeometry(1, 1), uv = g.getAttribute('uv'); for (let i = 0; i < uv.count; i += 1) uv.setY(i, v0 + uv.getY(i) * (v1 - v0)); return g; };
    const name = plane(.25, 1), plaque = plane(0, .2);
    for (const [z, finish] of [[.008, face], [0, edge], [-.008, face]]) batch.add(finish, name, at(bx, H + .186 + .1, z), entranceYaw, [bw * .95, .2, 1]);
    box(mat.granite, [.15, .07, .006], at(px, .4, .106));
    batch.add(face, plaque, at(px, .4, .1095), entranceYaw, [.14, .03, 1]);
    name.dispose(); plaque.dispose();
  });
}
