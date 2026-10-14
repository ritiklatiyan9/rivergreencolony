import { createFrontApronLandscape } from '../data/frontApronLandscape.js';
import { lawnMaterial } from './kit.js';
import { createBatch } from './architecture-common.js';
import { broadleaf } from './vegetation-trees.js';
import { makeFoliageTextures, TILE } from './vegetation-textures.js';

export function buildFrontApronLandscape(ctx, parent) {
  const { THREE, kit, HEIGHTS, frontage } = ctx, apron = frontage.commercialApron;
  const beds = createFrontApronLandscape(apron);
  const group = new THREE.Group(); group.name = 'Landscaped forecourt gardens'; parent.add(group);
  const grass = lawnMaterial(kit), stone = kit.material('#d7d2c5', { roughness: .9 });
  const batch = createBatch(THREE, kit, group), floor = HEIGHTS.garden + .012;
  const { atlas } = makeFoliageTextures(kit);
  const foliage = kit.material('#ffffff', { map: atlas, vertexColors: true, alphaTest: .42, side: THREE.DoubleSide, roughness: .85 });
  foliage.onBeforeCompile = shader => {
    shader.uniforms.uFrontWind = ctx.wind || { value: 0 };
    shader.vertexShader = 'uniform float uFrontWind; attribute float aLeaf;\n' + shader.vertexShader
      .replace('#include <color_vertex>', `vColor = color;
        #ifdef USE_INSTANCING_COLOR
        vColor *= mix(vec3(1.0), instanceColor, aLeaf);
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.x += aLeaf * sin(uFrontWind * 1.2 + position.y * 3.0) * 0.008 * position.y;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  foliage.customProgramCacheKey = () => 'forecourt-leaves-v1';
  const plants = (geometry, items, name, heightFor) => {
    const shape = kit.geometry(geometry), p = shape.getAttribute('position');
    let spread = 0;
    for (let i = 0; i < p.count; i++) spread = Math.max(spread, Math.hypot(p.getX(i), p.getZ(i)));
    const mesh = kit.track(new THREE.InstancedMesh(shape, foliage, Math.max(1, items.length)));
    mesh.count = items.length; mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    const dummy = new THREE.Object3D(), tint = new THREE.Color();
    items.forEach((item, i) => {
      const horizontal = item.radius / (spread + .012), height = heightFor(item);
      dummy.position.set(item.point[0], floor, item.point[1]);
      dummy.rotation.set(0, i * 2.399, 0); dummy.scale.set(horizontal, height, horizontal); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, tint.setRGB(1.04 + i % 3 * .035, 1.12, .98));
    });
    mesh.instanceMatrix.needsUpdate = true; group.add(mesh);
  };
  for (const bed of beds) {
    const shape = new THREE.Shape();
    bed.polygon.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)); shape.closePath();
    const geometry = kit.geometry(new THREE.ShapeGeometry(shape)); geometry.rotateX(-Math.PI / 2);
    const lawn = kit.mesh(geometry, grass, group, { cast: false }); lawn.position.y = floor; lawn.name = `${bed.name} grass`;
    lawn.userData.roadsideOpening = bed.opening;
    bed.boundary.forEach(([a, b]) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      batch.addBox(stone, [length, .06, .045], [(a[0] + b[0]) / 2, floor + .018, (a[1] + b[1]) / 2], -Math.atan2(dz, dx));
    });
  }
  batch.build();
  const trees = beds.flatMap(bed => bed.trees), shrubs = beds.flatMap(bed => bed.shrubs);
  for (let variant = 0; variant < 2; variant++) plants(broadleaf({ seed: 61 + variant * 14,
    tile: variant ? TILE.neem : TILE.mango, rx: .42, ry: .33, clumps: 8, cards: 350, card: .08, trunkRadius: .025, branches: 4 }),
    trees.filter(tree => tree.variant === variant), variant ? 'Forecourt neem trees' : 'Forecourt shade trees', tree => tree.height);
  plants(broadleaf({ seed: 89, tiles: [TILE.bloom, TILE.mango, TILE.bloom], rx: .5, ry: .4, lift: .02,
    clumps: 5, cards: 110, card: .13, coreDetail: 0, trunkRadius: .012, branches: 2 }), shrubs, 'Forecourt flowering plants', () => .15);
  return group;
}
