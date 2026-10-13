import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const bootstrap = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(match => match[1].includes('__finishRivergreenEntry'))[1];
function open(url, reduced = false) {
  const location = new URL(url), classes = new Set(), events = [], timeouts = [];
  const window = { history: { scrollRestoration: 'auto' }, scrollTo() {}, addEventListener() {}, dispatchEvent: event => events.push(event) };
  const document = { documentElement: { classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) } } };
  vm.runInNewContext(bootstrap, { window, document, location, matchMedia: () => ({ matches: reduced }), performance: { now: () => 0 }, setTimeout: fn => timeouts.push(fn), CustomEvent: class { constructor(type, data) { this.type = type; this.detail = data.detail; } } });
  return { window, classes, events, timeouts };
}
test('the exact /login#overview URL plays the entrance and retains its section destination', () => {
  const page = open('http://127.0.0.1:5173/login#overview');
  assert.ok(page.classes.has('is-entering'));
  assert.equal(page.window.__rivergreenEntryHash, '#overview');
  assert.equal(page.window.history.scrollRestoration, 'manual');
  page.window.__finishRivergreenEntry();
  assert.equal(page.window.history.scrollRestoration, 'auto');
  assert.equal(page.classes.has('is-entering'), false);
  assert.equal(page.events[0].detail.reason, 'complete');
  page.window.__finishRivergreenEntry(); assert.equal(page.events.length, 1);
});
test('manager and reduced-motion visits remain immediately accessible', () => {
  assert.equal(open('http://127.0.0.1:5173/plot-manager').classes.size, 0);
  assert.equal(open('http://127.0.0.1:5173/login#overview', true).classes.size, 0);
});
test('a stalled application releases the loader within the bootstrap deadline', () => {
  const page = open('http://127.0.0.1:5173/login#overview');
  page.timeouts[0]();
  assert.equal(page.classes.has('is-entering'), false);
  assert.equal(page.events[0].detail.reason, 'fallback');
});
