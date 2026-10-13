import * as THREE from 'three';
import { MercatorCoordinate } from 'maplibre-gl';
import { NEARBY_PLACES, PLACE_CATEGORIES } from '../data/nearbyPlaces.js';

// Fixed illustrative dimensions in map metres. Camera movement never changes
// a structure's position, height, orientation or proportions.
export const UNIPOLE = Object.freeze({ width: 92, faceHeight: 34, frameWidth: 96, frameHeight: 38, depth: 3.2, scale: 1.5 });

export function unipolePlacement(place, transform, anchor, heading) {
  const coordinate = MercatorCoordinate.fromLngLat([place.lng, place.lat], 0);
  const position = new THREE.Vector3(coordinate.x, coordinate.y, coordinate.z).applyMatrix4(transform.clone().invert());
  const mercatorScale = new THREE.Vector3().setFromMatrixScale(transform).x;
  const unitsPerMetre = coordinate.meterInMercatorCoordinateUnits() / mercatorScale;
  return { position, scale: unitsPerMetre, yaw: THREE.MathUtils.degToRad(heading) };
}

function faceTexture(place) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 384;
  const c = canvas.getContext('2d');
  c.scale(.5, .5);
  const colour = PLACE_CATEGORIES[place.category].colour;
  c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(0, 0, 2048, 768, 34); c.fill();
  c.strokeStyle = '#c7c9c0'; c.lineWidth = 3; c.strokeRect(35, 35, 1978, 698);
  c.fillStyle = colour; c.fillRect(80, 215, 10, 343);
  c.fillStyle = colour; c.font = '500 43px Arial, sans-serif'; c.textAlign = 'left';
  c.fillText(PLACE_CATEGORIES[place.category].label.toUpperCase(), 115, 119);
  c.textAlign = 'right'; c.fillText(String(place.number).padStart(2, '0'), 1930, 119);
  c.strokeStyle = '#d5d9d2'; c.lineWidth = 2; c.beginPath(); c.moveTo(115, 168); c.lineTo(1930, 168); c.stroke();
  const words = place.name.split(' '); let lines = [place.name];
  if (place.name.length > 17) {
    let best = Infinity;
    for (let i = 1; i < words.length; i += 1) {
      const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
      const score = Math.abs(pair[0].length - pair[1].length);
      if (score < best) { best = score; lines = pair; }
    }
  }
  let size = lines.length === 1 ? 166 : 147;
  do { c.font = `600 ${size}px Arial, sans-serif`; if (lines.every(line => c.measureText(line).width <= 1810)) break; size -= 4; } while (size > 90);
  c.fillStyle = '#183d32'; c.textAlign = 'center'; c.textBaseline = 'middle';
  lines.forEach((line, i) => c.fillText(line, 1024, lines.length === 1 ? 390 : 310 + i * 174));
  c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.font = '500 39px Arial, sans-serif'; c.fillStyle = '#65756b';
  c.fillText('SHAMLI', 115, 680);
  c.textAlign = 'right'; c.fillText('AROUND RIVER GREEN', 1930, 680);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

function frameGeometry() {
  const w = UNIPOLE.frameWidth / 2, h = UNIPOLE.frameHeight / 2, r = 2.3;
  const s = new THREE.Shape(); s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h); s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
  const geometry = new THREE.ExtrudeGeometry(s, { depth: UNIPOLE.depth, bevelEnabled: true, bevelSize: .45, bevelThickness: .45, bevelSegments: 2, steps: 1, curveSegments: 6 });
  geometry.translate(0, 0, -UNIPOLE.depth / 2); return geometry;
}

export function createNearbyPlaceBanners({ scene, transform, anchor, heading, makeTexture = faceTexture }) {
  const root = new THREE.Group(); root.name = 'Shamli 3D unipoles'; scene.add(root);
  const resources = new Set(), track = value => { resources.add(value); return value; };
  const steel = track(new THREE.MeshStandardMaterial({ color: '#647277', metalness: .78, roughness: .3 }));
  const dark = track(new THREE.MeshStandardMaterial({ color: '#1d2e2b', metalness: .58, roughness: .42 }));
  const stone = track(new THREE.MeshStandardMaterial({ color: '#c1bbaa', roughness: .85 }));
  const brass = track(new THREE.MeshStandardMaterial({ color: '#a69670', metalness: .65, roughness: .34 }));
  const cube = track(new THREE.BoxGeometry(1, 1, 1));
  const cylinder = track(new THREE.CylinderGeometry(1, 1, 1, 16));
  const tapered = track(new THREE.CylinderGeometry(.72, 1, 1, 16));
  const frame = track(frameGeometry());
  const face = track(new THREE.PlaneGeometry(UNIPOLE.width, UNIPOLE.faceHeight));
  const meshes = [], signs = new Map();
  function mesh(geometry, material, parent, position, scale = [1, 1, 1]) {
    const object = new THREE.Mesh(geometry, material); object.position.set(...position); object.scale.set(...scale); parent.add(object); return object;
  }
  NEARBY_PLACES.forEach(place => {
    const group = new THREE.Group(); group.name = `${place.name} unipole`; group.userData.placeId = place.id;
    const placement = unipolePlacement(place, transform, anchor, heading);
    group.position.copy(placement.position); group.scale.setScalar(placement.scale * UNIPOLE.scale); group.rotation.y = placement.yaw;
    root.add(group);
    const height = place.heightMetres;
    mesh(cube, stone, group, [0, .8, 0], [9, 1.6, 9]);
    mesh(cylinder, dark, group, [0, 1.85, 0], [3.5, .5, 3.5]);
    for (const x of [-2.3, 2.3]) for (const z of [-2.3, 2.3]) mesh(cylinder, brass, group, [x, 2.2, z], [.3, .4, .3]);
    mesh(tapered, steel, group, [0, height / 2 + 2, 0], [1.8, height - 4, 1.8]);
    mesh(cylinder, dark, group, [0, 8, 0], [2, 12, 2]);
    mesh(cylinder, brass, group, [0, 14.4, 0], [2.12, .7, 2.12]);
    mesh(cylinder, brass, group, [0, height - 21, 0], [1.8, 1.2, 1.8]);
    // The head has real depth, bevelled champagne metal and two printed faces.
    const head = new THREE.Group(); head.position.y = height; group.add(head);
    mesh(cube, dark, head, [0, -8, -3.2], [54, 3, 3]);
    const finish = track(brass.clone()); const housing = mesh(frame, finish, head, [0, 0, 0]);
    const texture = track(makeTexture(place));
    const printed = track(new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: .05, toneMapped: false }));
    const front = mesh(face, printed, head, [0, 0, UNIPOLE.depth / 2 + .48]);
    const back = mesh(face, printed, head, [0, 0, -UNIPOLE.depth / 2 - .48]); back.rotation.y = Math.PI;
    mesh(cube, dark, head, [0, UNIPOLE.frameHeight / 2 + 1.1, 0], [94, 1.1, 4]);
    for (const x of [-28, 28]) mesh(cube, brass, head, [x, -21.5, 3.7], [5, 1.8, 2.8]);
    [housing, front, back].forEach(object => { object.userData.placeId = place.id; meshes.push(object); });
    signs.set(place.id, { group, finish });
  });
  root.updateMatrixWorld(true);
  let disposed = false;
  return {
    root,
    select: id => signs.forEach((sign, key) => { sign.finish.emissive.set(key === id ? '#6b5a30' : '#000000'); sign.finish.emissiveIntensity = key === id ? .45 : 0; }),
    setVisible: value => { root.visible = value; },
    pick: ray => root.visible ? ray.intersectObjects(meshes, false)[0]?.object.userData.placeId || null : null,
    dispose: () => { if (disposed) return; disposed = true; root.removeFromParent(); resources.forEach(value => value.dispose()); resources.clear(); root.clear(); },
  };
}
