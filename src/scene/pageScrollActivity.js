// Decorative WebGL frames yield while the document scrolls. Canvas gestures
// don't emit document scroll events, so interactive orbit/zoom stays responsive.
export function observePageScroll({ isVisible, pause, resume, target = window, schedule = setTimeout, cancel = clearTimeout }) {
  let timer, active = false, disposed = false;
  const scroll = () => {
    if (disposed || !isVisible()) return;
    if (!active) { active = true; pause(); }
    cancel(timer);
    timer = schedule(() => { active = false; if (!disposed) resume(); }, 180);
  };
  target.addEventListener('scroll', scroll, { passive: true });
  return { get active() { return active; }, dispose() {
    disposed = true; cancel(timer); target.removeEventListener('scroll', scroll);
  } };
}
