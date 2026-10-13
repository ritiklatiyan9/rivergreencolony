import { updateMapCamera } from './colonyMapCamera.js';

// MapLibre clears its shared framebuffer on every repaint. Pause decorative
// animation during page scroll, but always redraw the colony on a map frame.
export function createColonyMapFrame(transform) {
  let lastTime = 0, animationTime = 0;
  return ({ model, renderer, args, canvas, time, paused = false, reducedMotion = false }) => {
    const delta = lastTime ? Math.max(0, Math.min((time - lastTime) / 1000, .05)) : 0;
    lastTime = time;
    const step = paused || reducedMotion ? 0 : delta;
    animationTime += step;
    updateMapCamera(model.camera, args, transform);
    renderer.resetState();
    renderer.setViewport(0, 0, canvas.width, canvas.height);
    model.update(reducedMotion ? 0 : animationTime, step);
    renderer.render(model.scene, model.camera);
  };
}
