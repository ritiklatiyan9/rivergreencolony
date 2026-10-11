// Green highway direction sign on Shamli Road beside the colony entrance:
// "← शामली / SHAMLI" in white on NH green with a white border, on two
// galvanised posts, west of the entrance: the town lies west of the colony.
const DEVANAGARI = '"Noto Sans Devanagari", "Kohinoor Devanagari", "Devanagari Sangam MN", "Nirmala UI", Mangal, sans-serif';

export function buildSign(ctx, parent, { x = -2.75, z = 12.66, yaw = .22, width = .42, height = .23, clearance = .2 } = {}) {
  const { THREE, kit } = ctx;
  const face = kit.canvasTexture(768, 420, (g, w, h) => {
    g.fillStyle = '#0b6a3b'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f4f6f2'; g.lineWidth = 12; g.beginPath(); if (g.roundRect) g.roundRect(18, 18, w - 36, h - 36, 26); else g.rect(18, 18, w - 36, h - 36); g.stroke();
    g.fillStyle = '#f7f8f4'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold 138px ${DEVANAGARI}`; g.fillText('शामली', w * .6, h * .37);
    g.font = 'bold 104px "Helvetica Neue", Arial, sans-serif'; g.fillText('SHAMLI', w * .6, h * .74);
    // Arrow pointing west (left), drawn as a shape so no font is needed.
    const ax = w * .26, ay = h * .55, len = w * .19, s = h * .12;
    g.beginPath(); g.moveTo(ax, ay - s * .38); g.lineTo(ax - len + s, ay - s * .38); g.lineTo(ax - len + s, ay - s); g.lineTo(ax - len, ay);
    g.lineTo(ax - len + s, ay + s); g.lineTo(ax - len + s, ay + s * .38); g.lineTo(ax, ay + s * .38); g.closePath(); g.fill();
  }, { wrap: false });
  // The face looks south, away from the high north-west sun: a little emissive keeps it legible.
  const faceMaterial = kit.material('#ffffff', { map: face, emissive: '#ffffff', emissiveMap: face, emissiveIntensity: .35, roughness: .5 });
  const metal = kit.material('#9a9fa3', { roughness: .45, metalness: .6 });
  const sign = new THREE.Group(); sign.position.set(x, 0, z); sign.rotation.y = yaw; parent.add(sign);
  const panel = kit.mesh(kit.geometry(new THREE.PlaneGeometry(width, height)), faceMaterial, sign); panel.position.set(0, clearance + height / 2, .007);
  // Back plate and two posts in one geometry.
  const back = new THREE.BoxGeometry(width + .01, height + .01, .012).translate(0, clearance + height / 2, 0);
  const posts = [-1, 1].map(s => new THREE.BoxGeometry(.022, clearance + height, .022).translate(s * width * .3, (clearance + height) / 2, -.017));
  const frame = new THREE.BufferGeometry(), parts = [back, ...posts], pos = [], nor = [];
  parts.forEach((g) => { const p = g.toNonIndexed(), a = p.getAttribute('position'), n = p.getAttribute('normal'); pos.push(...a.array); nor.push(...n.array); p.dispose(); g.dispose(); });
  frame.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); frame.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  kit.mesh(kit.geometry(frame), metal, sign);
  return sign;
}
