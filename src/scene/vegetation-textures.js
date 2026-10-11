// Canvas-painted foliage textures: one 4x2 atlas shared by every tree, palm
// and shrub (alpha-cut leaf clusters, fronds, bark) plus a tiling boxwood
// leaf texture for the clipped hedges.
export const TILE = { mango: 0, neem: 1, bloom: 2, mat: 3, frond: 4, bark: 5, palmBark: 6, cycas: 7 };

// UV rectangle [u0, v0, u1, v1] of a tile (canvas row 0 is the top, v = 1).
export const tileRect = (index) => { const col = index % 4, row = Math.floor(index / 4); return [col / 4, 1 - (row + 1) / 2, (col + 1) / 4, 1 - row / 2]; };

const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

// One leaf: two curved halves (the upper half catches more light) and a midrib.
function leaf(c, x, y, angle, length, width, colour, light = 1) {
  c.save(); c.translate(x, y); c.rotate(angle);
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(length * .42, -width, length, 0); c.quadraticCurveTo(length * .42, width, 0, 0); c.fillStyle = shade(colour, light); c.fill();
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(length * .42, -width, length, 0); c.closePath(); c.fillStyle = shade(colour, light * 1.12); c.fill();
  c.strokeStyle = shade(colour, light * .72); c.lineWidth = Math.max(.6, width * .12); c.beginPath(); c.moveTo(0, 0); c.lineTo(length * .92, 0); c.stroke();
  c.restore();
}

const GREENS = ['#52862c', '#649636', '#467628', '#73a03c', '#5d8a2e', '#84aa45'];

function mango(c, r) { // broad lanceolate leaves on radiating twigs
  for (let pass = 0; pass < 2; pass += 1) for (let i = 0; i < 34; i += 1) {
    const a = r() * Math.PI * 2, d = 18 + r() * 70, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d * .9;
    leaf(c, x, y, a + (r() - .5) * 1.3, 34 + r() * 30, 7 + r() * 5, GREENS[Math.floor(r() * GREENS.length)], pass ? .95 + r() * .25 : .62 + r() * .2);
  }
}

function neem(c, r) { // pinnate compound leaves: a rachis with many small leaflets
  for (let i = 0; i < 13; i += 1) {
    const a = i / 13 * Math.PI * 2 + r() * .4, colour = GREENS[Math.floor(r() * GREENS.length)], light = .7 + r() * .45, length = 70 + r() * 40;
    const sx = 128 + Math.cos(a) * 14, sy = 128 + Math.sin(a) * 14;
    c.strokeStyle = shade(colour, .55); c.lineWidth = 1.2; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a) * length, sy + Math.sin(a) * length); c.stroke();
    for (let t = .12; t < 1; t += .085) for (const side of [-1, 1]) {
      const x = sx + Math.cos(a) * length * t, y = sy + Math.sin(a) * length * t;
      leaf(c, x, y, a + side * (.9 - t * .3), 14 + (1 - t) * 8, 3.6 + r() * 1.4, colour, light * (.9 + r() * .2));
    }
    leaf(c, sx + Math.cos(a) * length, sy + Math.sin(a) * length, a, 16, 4, colour, light);
  }
}

function bloom(c, r) { // flowering shrub: small leaves and bougainvillea / hibiscus heads
  for (let i = 0; i < 90; i += 1) { const a = r() * Math.PI * 2, d = r() * 92; leaf(c, 128 + Math.cos(a) * d, 128 + Math.sin(a) * d, a + r() - .5, 20 + r() * 14, 5 + r() * 3, GREENS[i % 6], .7 + r() * .4); }
  const petals = ['#c8327a', '#d64a8c', '#d8392e', '#e9b934', '#f1ece2', '#c8327a'];
  for (let i = 0; i < 34; i += 1) {
    const a = r() * Math.PI * 2, d = r() * 86, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d, colour = petals[i % petals.length];
    for (let p = 0; p < 5; p += 1) { const pa = p / 5 * Math.PI * 2 + r(); c.fillStyle = shade(colour, .8 + r() * .35); c.beginPath(); c.arc(x + Math.cos(pa) * 4, y + Math.sin(pa) * 4, 3.6 + r() * 1.8, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#f4d77a'; c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill();
  }
}

function mat(c, r) { // opaque leaf mass for canopy cores
  c.fillStyle = '#2d4d1d'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i += 1) leaf(c, r() * 256, r() * 256, r() * Math.PI * 2, 18 + r() * 16, 5 + r() * 3, GREENS[i % 6], .45 + r() * .4);
}

// Fronds lie along u (base at the left), leaflets fan out from a midrib at v = .5.
function frond(c, r, colours, stiff) {
  for (let x = 6; x < 250; x += stiff ? 3.2 : 4.2) {
    const t = x / 256, reach = 118 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), .55) * (stiff ? .8 : 1);
    for (const side of [-1, 1]) {
      const tipX = x + reach * (stiff ? .35 : .55), tipY = 128 + side * reach, colour = colours[Math.floor(r() * colours.length)], w = stiff ? 1.6 : 2.6;
      c.fillStyle = shade(colour, .8 + r() * .35); c.beginPath(); c.moveTo(x - w, 128); c.quadraticCurveTo(x + reach * .2, 128 + side * reach * .6, tipX, tipY); c.lineTo(x + w, 128); c.fill();
    }
  }
  c.strokeStyle = '#6f7a3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 128); c.lineTo(250, 128); c.stroke();
}

function bark(c, r, rings) {
  c.fillStyle = rings ? '#8a7b66' : '#7a6a57'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i += 1) { c.fillStyle = `rgba(${r() < .5 ? '30,24,18' : '170,155,130'},${.12 + r() * .2})`; c.fillRect(r() * 256, r() * 256, 1 + r() * 3, 8 + r() * 40); }
  if (rings) for (let y = 0; y < 256; y += 14) { c.fillStyle = 'rgba(40,32,24,.55)'; c.fillRect(0, y, 256, 3); c.fillStyle = 'rgba(205,190,160,.3)'; c.fillRect(0, y + 3, 256, 2); }
}

export function makeFoliageTextures(kit) {
  const random = kit.rng(31337);
  const atlas = kit.canvasTexture(1024, 512, (c) => {
    const painters = [mango, neem, bloom, mat, (cc, r) => frond(cc, r, ['#4f7f2c', '#5f8f34', '#6f9c3c', '#86a845'], false), (cc, r) => bark(cc, r, false), (cc, r) => bark(cc, r, true), (cc, r) => frond(cc, r, ['#2f5a22', '#3c6a28', '#46742c'], true)];
    painters.forEach((paint, i) => { c.save(); c.translate((i % 4) * 256, Math.floor(i / 4) * 256); c.beginPath(); c.rect(0, 0, 256, 256); c.clip(); paint(c, random); c.restore(); });
  }, { wrap: false });
  const hedgeMap = kit.canvasTexture(256, 256, (c, size) => {
    c.fillStyle = '#26461a'; c.fillRect(0, 0, size, size);
    for (let i = 0; i < 1500; i += 1) {
      const x = random() * size, y = random() * size, a = random() * Math.PI * 2, colour = ['#3a6626', '#477530', '#2f5a22', '#56853a', '#33602a'][i % 5];
      for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) if (Math.abs(x + ox - size / 2) < size / 2 + 10 && Math.abs(y + oy - size / 2) < size / 2 + 10) leaf(c, x + ox, y + oy, a, 7 + random() * 5, 2.4 + random() * 1.2, colour, .6 + random() * .55);
    }
  });
  return { atlas, hedgeMap };
}
