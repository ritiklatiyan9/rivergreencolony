// Measuring a page while Lenis is easing resets its destination. Coalesce real
// layout changes and wait for the visitor's scroll to settle before refreshing.
export function createLayoutRefresh({ readSize, isScrolling, refresh, schedule = setTimeout, cancel = clearTimeout, delay = 180 }) {
  let size = readSize();
  let pending = false;
  let timer;
  let disposed = false;
  const changed = (next) => Object.keys(next).some(key => Math.abs(next[key] - size[key]) > 2);
  const queue = () => { cancel(timer); timer = schedule(flush, delay); };
  function flush() {
    timer = undefined;
    if (disposed || !pending) return;
    if (isScrolling()) { queue(); return; }
    pending = false;
    size = readSize();
    refresh();
    // Refresh can synchronously change inline styles; use the settled size.
    size = readSize();
  }
  return {
    request(force = false) {
      if (disposed || (!force && !changed(readSize()))) return;
      pending = true;
      queue();
    },
    touch() { if (pending && !disposed) queue(); },
    dispose() { disposed = true; cancel(timer); },
  };
}
