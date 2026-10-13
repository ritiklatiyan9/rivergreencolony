import test from 'node:test';
import assert from 'node:assert/strict';
import { observePageScroll } from './pageScrollActivity.js';

test('decorative rendering pauses once through a scroll burst and resumes only after settling', () => {
  const target = new EventTarget(), timers = new Map(); let id = 0, visible = true, pauses = 0, resumes = 0;
  const state = observePageScroll({ target, isVisible: () => visible, pause: () => pauses++, resume: () => resumes++,
    schedule: fn => { timers.set(++id, fn); return id; }, cancel: key => timers.delete(key) });
  for (let i = 0; i < 10; i++) target.dispatchEvent(new Event('scroll'));
  assert.equal(pauses, 1); assert.equal(resumes, 0); assert.equal(timers.size, 1); assert.equal(state.active, true);
  const flush = () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); };
  flush(); assert.equal(resumes, 1); assert.equal(state.active, false);
  visible = false; target.dispatchEvent(new Event('scroll')); assert.equal(pauses, 1);
  visible = true; target.dispatchEvent(new Event('scroll')); state.dispose(); flush();
  assert.equal(resumes, 1); assert.equal(timers.size, 0);
});
