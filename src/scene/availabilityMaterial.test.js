import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createKit, HEIGHTS, SCALE, lawnMaterial } from './kit.js';
import { availabilityMaterial } from './availabilityMaterial.js';
import buildGround from './ground.js';

const plan = JSON.parse(readFileSync(new URL('../data/threePlotGeometry.json', import.meta.url)));
const shader = () => ({ uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <map_fragment>\n#include <color_fragment>\n#include <tonemapping_fragment>' });

test('available plots use the exact park grass uniforms and booked colours bypass scene tone mapping', () => {
  const kit = createKit({ capabilities: { getMaxAnisotropy: () => 1 } }, plan);
  const parkShader = shader(), plotShader = shader();
  lawnMaterial(kit).onBeforeCompile(parkShader);
  availabilityMaterial(kit).onBeforeCompile(plotShader);
  for (const name of ['uLawnDark', 'uLawnLight', 'uLawnDry']) assert.deepEqual(plotShader.uniforms[name].value, parkShader.uniforms[name].value);
  assert.deepEqual(parkShader.uniforms.uLawnDark.value, new THREE.Color('#009933'));
  assert.ok(parkShader.fragmentShader.includes('gl_FragColor.rgb = uLawnDark;'));
  assert.ok(plotShader.fragmentShader.includes('mix(vec3(1.0), grass, vPlotAvailable)'));
  assert.ok(plotShader.fragmentShader.includes('#include <tonemapping_fragment>\ngl_FragColor.rgb = mix(vColor.rgb, uLawnDark, vPlotAvailable)'));
  kit.dispose();
});

test('booking transitions remove park grass and update booked colour without leaving green behind', () => {
  const kit = createKit({ capabilities: { getMaxAnisotropy: () => 1 } }, plan);
  kit.canvasTexture = () => kit.track(new THREE.Texture());
  const root = new THREE.Group(), statuses = { AVAILABLE: '#009933', RESERVED: '#cc0000', SOLD: '#cc0000' };
  const ground = buildGround({ THREE, kit, plan, root, world: kit.world, SCALE, HEIGHTS, statusColours: statuses });
  const overlay = root.getObjectByName('Plot availability colours'), grass = overlay.geometry.getAttribute('aPlotAvailable'), colour = overlay.geometry.getAttribute('color');
  ground.paintPlots(new Map([['A-1', 'AVAILABLE']]));
  assert.ok([...grass.array].some(value => value === 1));
  ground.paintPlots(new Map([['A-1', 'RESERVED']]));
  assert.ok([...grass.array].every(value => value === 0));
  const booked = new THREE.Color(statuses.RESERVED); let visible = 0;
  for (let i = 0; i < colour.count; i++) if (colour.getW(i) > 0) {
    visible++;
    assert.ok(Math.abs(colour.getX(i) - booked.r) < 1e-6 && Math.abs(colour.getY(i) - booked.g) < 1e-6 && Math.abs(colour.getZ(i) - booked.b) < 1e-6);
  }
  assert.ok(visible > 0);
  ground.paintPlots(new Map([['A-1', 'UNKNOWN']]));
  assert.ok([...colour.array].filter((_, i) => i % 4 === 3).every(value => value === 0));
  kit.dispose();
});
