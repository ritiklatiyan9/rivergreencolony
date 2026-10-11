// Keep georeferencing in the camera so procedural materials still see the
// original colony coordinates. MapLibre supplies C = P * V * transform;
// separating P and V also gives Three the real eye position for reflections.
export function updateMapCamera(camera, args, transform) {
  camera.matrixAutoUpdate = false;
  camera.matrixWorldAutoUpdate = false;
  camera.projectionMatrix.fromArray(args.projectionMatrix);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.matrixWorldInverse.fromArray(args.defaultProjectionData.mainMatrix)
    .multiply(transform)
    .premultiply(camera.projectionMatrixInverse);
  camera.matrixWorld.copy(camera.matrixWorldInverse).invert();
  camera.matrix.copy(camera.matrixWorld);
  camera.matrixWorldNeedsUpdate = false;
  camera.position.setFromMatrixPosition(camera.matrixWorld);
  return camera;
}
