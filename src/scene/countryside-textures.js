// Canvas textures for the countryside: the sugarcane wall (stalks and arching
// leaves, darker toward the ground, ragged leaf tips along the top) and a
// leaf tuft for the uneven cane tops.
const leaf = (c, x, y, length, angle, droop, width, colour) => {
  const ex = x + Math.cos(angle) * length, ey = y - Math.sin(angle) * length;
  const mx = x + Math.cos(angle) * length * .55, my = y - Math.sin(angle) * length * .75;
  c.strokeStyle = colour; c.lineCap = 'round';
  for (const [w, f] of [[width, 0], [width * .55, .35]]) { c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, ex + (ex - x) * f * .2, ey + droop * (1 + f)); c.stroke(); }
};

export function leafTexture(kit) {
  const random = kit.rng(733);
  const shade = (dark) => { const g = 100 + random() * 70 + (1 - dark) * 70, r = g * (.62 + random() * .2), b = g * (.32 + random() * .12); return `rgb(${r | 0},${g | 0},${b | 0})`; };
  return kit.canvasTexture(512, 256, (c, width, height) => {
    c.clearRect(0, 0, width, height);
    c.fillStyle = '#4a6326'; c.fillRect(0, 84, width, height);
    // Stalks.
    for (let i = 0; i < 70; i += 1) { const x = random() * width; c.strokeStyle = `rgba(${120 + random() * 40 | 0},${125 + random() * 30 | 0},${60 + random() * 20 | 0},.75)`; c.lineWidth = 2 + random() * 2; c.beginPath(); c.moveTo(x, height); c.lineTo(x + (random() - .5) * 10, 60 + random() * 60); c.stroke(); }
    // Leaves, layered from the dark lower canopy to the sunlit upper one.
    for (let i = 0; i < 520; i += 1) {
      const t = i / 520, y = height - t * (height - 84) + (random() - .5) * 30, x = random() * width;
      for (const ox of [-width, 0, width]) leaf(c, x + ox, y, 30 + random() * 60, Math.PI * (.15 + random() * .7), 10 + random() * 30, 2 + random() * 3, shade(1 - t));
    }
    // Ragged leaf tips above the canopy line.
    for (let i = 0; i < 300; i += 1) { const x = random() * width; for (const ox of [-width, 0, width]) leaf(c, x + ox, 86 + random() * 26, 30 + random() * 60, Math.PI * (.25 + random() * .5), 4 + random() * 14, 2 + random() * 2, `rgb(${150 + random() * 50 | 0},${175 + random() * 40 | 0},${70 + random() * 30 | 0})`); }
    // Darken toward the ground (inside of the stand).
    c.globalCompositeOperation = 'source-atop';
    const g = c.createLinearGradient(0, height, 0, 90); g.addColorStop(0, 'rgba(14,20,8,.6)'); g.addColorStop(.5, 'rgba(14,20,8,.1)'); g.addColorStop(1, 'rgba(14,20,8,0)');
    c.fillStyle = g; c.fillRect(0, 0, width, height); c.globalCompositeOperation = 'source-over';
  }, { wrap: true });
}

export function tuftTexture(kit) {
  const random = kit.rng(919);
  return kit.canvasTexture(256, 256, (c, width, height) => {
    c.clearRect(0, 0, width, height);
    for (let i = 0; i < 26; i += 1) {
      const side = random() < .5 ? -1 : 1, angle = Math.PI / 2 + side * (.15 + random() * .9);
      const g = 140 + random() * 80; leaf(c, width / 2 + (random() - .5) * 30, height, 120 + random() * 110, angle, 20 + random() * 60, 4 + random() * 4, `rgb(${g * (.7 + random() * .2) | 0},${g | 0},${g * .4 | 0})`);
    }
  }, { wrap: false });
}

// Sugarcane canopy seen from above: 10 rows per tile, arching blades from each
// row line, darker soil gaps between rows. Mapped in world space along the rows.
export const CANE_TILE = 1.1;
export function caneTopTexture(kit) {
  const random = kit.rng(4411);
  return kit.canvasTexture(512, 512, (c, size) => {
    c.fillStyle = '#34461d'; c.fillRect(0, 0, size, size);
    const rows = 10, gap = size / rows;
    for (let pass = 0; pass < 3; pass += 1) for (let r = 0; r < rows; r += 1) for (let i = 0; i < 150; i += 1) {
      const x = random() * size, y = (r + .5) * gap + (random() - .5) * gap * .3;
      const angle = (random() < .5 ? 0 : Math.PI) + (random() - .5) * 2.3, length = 22 + random() * 36;
      const g = 95 + pass * 45 + random() * 40, colour = `rgb(${g * (.72 + random() * .2) | 0},${g | 0},${g * (.34 + random() * .14) | 0})`;
      for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
        c.strokeStyle = colour; c.lineCap = 'round'; c.lineWidth = 1.5 + random() * 2.5; c.beginPath(); c.moveTo(x + ox, y + oy);
        const ex = x + ox + Math.cos(angle) * length, ey = y + oy + Math.sin(angle) * length;
        c.quadraticCurveTo(x + ox + Math.cos(angle) * length * .5 + (random() - .5) * 14, y + oy + Math.sin(angle) * length * .4, ex, ey); c.stroke();
      }
    }
  }, { wrap: true });
}
