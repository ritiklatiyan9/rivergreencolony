import test from 'node:test';
import assert from 'node:assert/strict';
import { createLayoutRefresh } from './layoutRefresh.js';

function fixture() {
  let size = { width: 1200, height: 8000, viewport: 800 }, scrolling = false, updates = 0;
  const timers = new Map(); let id = 0;
  const controller = createLayoutRefresh({
    readSize: () => ({ ...size }), isScrolling: () => scrolling,
    refresh: () => updates++, schedule: fn => { timers.set(++id, fn); return id; },
    cancel: key => timers.delete(key),
  });
  return { controller, resize: value => { size = { ...size, ...value }; }, scroll: value => { scrolling = value; },
    flush: () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); },
    get updates() { return updates; }, get pending() { return timers.size; } };
}

test('image loads with unchanged geometry never reset scrolling', () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) f.controller.request();
  f.resize({ height: 8001 }); f.controller.request(); f.flush();
  assert.equal(f.updates, 0);
});
test('layout changes wait through native scrolling and smooth inertia, then refresh once', () => {
  const f = fixture(); f.scroll(true); f.resize({ height: 8500 }); f.controller.request();
  f.flush(); f.resize({ height: 9000 }); f.controller.request(); f.controller.touch(); f.flush();
  assert.equal(f.updates, 0); assert.equal(f.pending, 1);
  f.scroll(false); f.flush(); assert.equal(f.updates, 1); assert.equal(f.pending, 0);
  f.controller.request(); f.flush(); assert.equal(f.updates, 1);
});
test('initial refresh is bounded and unmount cancels pending work', () => {
  const f = fixture(); f.controller.request(true); f.flush(); assert.equal(f.updates, 1);
  f.resize({ width: 900 }); f.controller.request(); f.controller.dispose(); f.flush();
  assert.equal(f.updates, 1); assert.equal(f.pending, 0);
});
