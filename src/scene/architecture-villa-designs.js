// Modern two-storey villa designs as parts in villa space: origin at the centre
// of the front wall on the lawn, +z toward the road, y up, x across. A part is
// [materialKey, [sx, sy, sz], [x, y, z], shape = 'box', rotation = [rx, ry, rz]].
// Pure data: architecture-villas.js instances it, sitePlots.js reads `label`.
const P = .03, F1 = .285, RF = .54, T = .022; // plinth top, first floor, roof, slab

export function villaDesign(variant, w, d, doorX) {
  const parts = [], L = -w / 2, R = w / 2, B = -d;
  const box = (key, size, pos, shape = 'box', rot) => parts.push([key, size, pos, shape, rot]);
  const shell = (x0, x1, z0, z1, y0, y1, key = 'plaster') => box(key, [x1 - x0, y1 - y0, z1 - z0], [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]);
  const slab = (x0, x1, z0, z1, y, t = T) => box('trim', [x1 - x0, t, z1 - z0], [(x0 + x1) / 2, y, (z0 + z1) / 2]);
  const parapet = (x0, x1, z0, z1, y, h = .045, t = .014) => {
    for (const z of [z0 + t / 2, z1 - t / 2]) { box('plaster', [x1 - x0, h, t], [(x0 + x1) / 2, y + h / 2, z]); box('trim', [x1 - x0 + .006, .006, t + .008], [(x0 + x1) / 2, y + h + .003, z]); }
    for (const x of [x0 + t / 2, x1 - t / 2]) { box('plaster', [t, h, z1 - z0 - 2 * t], [x, y + h / 2, (z0 + z1) / 2]); box('trim', [t + .008, .006, z1 - z0], [x, y + h + .003, (z0 + z1) / 2]); }
  };
  // Openings on a face: f (+z at z = plane), b (-z), l (-x at x = plane), r (+x). c runs along the face.
  const on = (face, plane, c, y, out, [su, sy, so], key) => {
    if (face === 'f') box(key, [su, sy, so], [c, y, plane + out]);
    else if (face === 'b') box(key, [su, sy, so], [c, y, plane - out]);
    else box(key, [so, sy, su], [plane + (face === 'r' ? out : -out), y, c]);
  };
  const window = (face, plane, c, y, ww, wh) => {
    on(face, plane, c, y, .004, [ww + .014, wh + .014, .01], 'iron');
    on(face, plane, c, y, .007, [ww, wh, .01], 'glass');
    on(face, plane, c, y, .011, [.005, wh, .006], 'iron');
    if (wh > .17) on(face, plane, c, y + wh * .2, .011, [ww, .005, .006], 'iron');
    on(face, plane, c, y - wh / 2 - .008, .012, [ww + .03, .008, .024], 'trim'); // sill
    on(face, plane, c, y + wh / 2 + .018, .022, [ww + .05, .008, .044], 'trim'); // sunshade (chajja)
  };
  const door = (face, plane, c, dw) => {
    on(face, plane, c, P + .1, .004, [dw + .016, .2, .01], 'iron');
    on(face, plane, c, P + .099, .008, [dw, .192, .01], 'wood');
    on(face, plane, c + dw * .32, P + .1, .014, [.006, .03, .006], 'metal');
    on(face, plane, c, P + .228, .055, [dw + .13, .012, .11], 'trim'); // entrance canopy
    on(face, plane, c - dw / 2 - .035, P + .17, .01, [.016, .03, .012], 'light');
  };
  const steps = (c) => { box('granite', [.2, .015, .055], [c, .0075, .0275]); box('granite', [.2, P, .028], [c, P / 2, .014]); };
  const railing = (x0, x1, z, y) => {
    box('iron', [x1 - x0, .006, .01], [(x0 + x1) / 2, y + .072, z]); box('iron', [x1 - x0, .005, .006], [(x0 + x1) / 2, y + .012, z]);
    for (let x = x0 + .006; x <= x1 - .005; x += .024) box('iron', [.004, .062, .004], [x, y + .041, z]);
  };
  const glassRail = (x0, x1, z, y, alongX = true) => {
    const len = x1 - x0, c = (x0 + x1) / 2;
    box('railGlass', alongX ? [len, .066, .005] : [.005, .066, len], alongX ? [c, y + .04, z] : [z, y + .04, c]);
    box('metal', alongX ? [len, .006, .012] : [.012, .006, len], alongX ? [c, y + .076, z] : [z, y + .076, c]);
  };
  const louvres = (x0, x1, z, y0, y1) => { for (let x = x0; x <= x1 + 1e-6; x += .026) box('wood', [.009, y1 - y0, .03], [x, (y0 + y1) / 2, z]); };
  const clad = (key, x0, x1, y0, y1, z, t = .012) => box(key, [x1 - x0, y1 - y0, t], [(x0 + x1) / 2, (y0 + y1) / 2, z + t / 2]);
  const cabin = (x, z, y) => {
    box('plaster', [.21, .19, .2], [x, y + .095, z]); box('trim', [.235, .012, .225], [x, y + .196, z]);
    box('wood', [.07, .15, .008], [x + .04, y + .075, z + .102]);
    box('grey', [.06, .02, .06], [x - .03, y + .212, z - .02]); box('tank', [.1, .085, .1], [x - .03, y + .265, z - .02], 'cyl');
  };
  const solar = (x0, x1, z0, z1, y) => {
    for (let x = x0 + .07; x <= x1 - .07; x += .15) for (let z = z0 + .06; z <= z1 - .06; z += .13) {
      box('metal', [.012, .03, .012], [x, y + .015, z + .03]); box('solar', [.13, .006, .11], [x, y + .04, z], 'box', [-.32, 0, 0]);
    }
  };
  const pot = (x, z, y) => { box('pot', [.034, .032, .034], [x, y + .016, z], 'cyl'); box('plant', [.05, .045, .05], [x, y + .05, z], 'ball'); };

  box('concrete', [w + .03, P, d + .03], [0, P / 2, -d / 2]);
  let label;
  if (variant === 0) {
    // Cantilever: a stone-clad ground floor, a timber-screened first-floor box
    // projecting over the entrance side, and a glass-railed terrace.
    const s = L + w * .62, back = B + d * .42;
    shell(L, R, B, 0, P, F1); shell(L, s, B, .07, F1, RF); shell(s, R, B, back, F1, RF);
    slab(L - .02, R + .02, B - .02, .02, F1); slab(L - .02, s + .02, B - .02, .09, RF); slab(s, R + .02, B - .02, back + .02, RF);
    parapet(L - .02, s + .02, B - .02, .09, RF + .011); parapet(s, R + .02, B - .02, back + .02, RF + .011);
    glassRail(s + .012, R + .016, .014, F1 + .011); glassRail(back + .02, .014, R + .012, F1 + .011, false);
    window('f', back, (s + R) / 2, F1 + .125, (R - s) * .7, .19);
    window('f', .07, (L + s) / 2, F1 + .13, (s - L) * .6, .17);
    louvres((L + s) / 2 - (s - L) * .36, (L + s) / 2 + (s - L) * .36, .086, F1 + .03, RF - .03);
    clad('stone', L, L + w * .34, P, F1 - .011, 0);
    window('f', 0, L + w * .52, P + .125, w * .2, .16);
    pot(R - .04, -.05, F1 + .011); pot(s + .05, -.05, F1 + .011);
    cabin(L + .15, B + .15, RF + .011); solar(s, R, B + .02, back, RF + .011);
    label = { x0: L + .12, x1: s - .08, depth: .2, height: RF + .016 };
  } else if (variant === 1) {
    // Frame: a deep white frame holds the glazed first-floor balcony; timber
    // around the entrance; a charcoal strip carries the tall stair window.
    shell(L, R, B, 0, P, RF);
    slab(L - .015, R + .015, B - .015, .015, F1, .016); slab(L - .02, R + .02, B - .02, .02, RF);
    parapet(L - .02, R + .02, B - .02, .02, RF + .011);
    const f0 = -w * .02, f1 = R + .015, t = .03;
    box('trim', [f1 - f0, t, .12], [(f0 + f1) / 2, F1, .06]); box('trim', [f1 - f0, t, .12], [(f0 + f1) / 2, RF - .004, .06]);
    for (const x of [f0 + t / 2, f1 - t / 2]) box('trim', [t, RF - F1, .12], [x, (F1 + RF) / 2, .06]);
    window('f', 0, (f0 + f1) / 2, F1 + .125, (f1 - f0) * .74, .2);
    railing(f0 + t, f1 - t, .112, F1 + .015);
    pot(f0 + t + .03, .06, F1 + .015);
    clad('wood', doorX - .075, doorX + .11, P, F1 - .01, 0);
    clad('grey', L + w * .38 - .05, L + w * .38 + .05, P, RF + .05, 0);
    window('f', .012, L + w * .38, (P + RF) / 2, .04, .38);
    window('f', 0, L + w * .2, P + .125, w * .22, .16);
    cabin(R - .16, B + .15, RF + .011); solar(L + .05, R - .3, B + .02, B + .32, RF + .011);
    label = { x0: L + .12, x1: R - .12, depth: .22, height: RF + .016 };
  } else {
    // Balconies: the first floor steps back behind a full-width railed balcony
    // under a deep roof overhang; a stone corner pier and a charcoal base band.
    const set = -.13;
    shell(L, R, B, 0, P, F1); shell(L, R, B, set, F1, RF);
    slab(L - .02, R + .02, B - .02, .03, F1); railing(L - .01, R + .01, .024, F1 + .011);
    for (const x of [L - .004, R + .004]) box('iron', [.006, .006, -set + .02], [x, F1 + .083, (set + .024) / 2]);
    slab(L - .025, R + .025, B - .025, .035, RF);
    parapet(L - .025, R + .025, B - .025, .035, RF + .011);
    for (const c of [L + w * .26, R - w * .26]) window('f', set, c, F1 + .125, w * .3, .2);
    clad('stone', L, L + .07, P, RF, .002, .016);
    clad('grey', L + .07, R, P, P + .05, 0, .006);
    window('f', 0, L + w * .3, P + .135, w * .26, .15);
    pot(L + .06, -.03, F1 + .011); pot(R - .06, -.03, F1 + .011);
    cabin(L + .17, B + .15, RF + .011); solar(L + .3, R - .03, B + .02, set - .02, RF + .011);
    label = { x0: L + .1, x1: R - .1, depth: .3, height: RF + .016 };
  }
  door('f', variant === 1 ? .012 : 0, doorX, .085); steps(doorX);
  // All variants: windows on the back and both sides, an outdoor AC unit.
  for (const y of [P + .125, F1 + .125]) {
    for (const c of [-w * .25, w * .25]) window('b', B, c, y, w * .2, .14);
    window('l', L, -d * .35, y, d * .2, .13); window('l', L, -d * .72, y, d * .2, .13);
    window('r', R, -d * .78, y, d * .18, .13);
  }
  box('metal', [.03, .05, .075], [R + .016, P + .2, -d * .45]);
  return { parts, label };
}
