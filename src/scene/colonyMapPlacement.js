import * as THREE from 'three';
import { COLONY_PLAN_SCALE } from '../data/colonyLocation.js';

// One similarity transform for the entire model: identical scale on every
// axis, followed by rotation and translation. No vertex/material deformation.
export function createColonyMapTransform(plan, config, anchor, metresInMercator) {
  const scale = metresInMercator * config.metresPerUnit;
  const centre = [(plan.roundabout.center[0] - plan.width / 2) * COLONY_PLAN_SCALE,
    (plan.roundabout.center[1] - plan.height / 2) * COLONY_PLAN_SCALE];
  return new THREE.Matrix4().makeTranslation(anchor.x, anchor.y, anchor.z)
    .multiply(new THREE.Matrix4().makeScale(scale, -scale, scale))
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
    .multiply(new THREE.Matrix4().makeRotationY(-THREE.MathUtils.degToRad(config.heading)))
    .multiply(new THREE.Matrix4().makeTranslation(-centre[0], 0, -centre[1]));
}
