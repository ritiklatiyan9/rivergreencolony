import test from 'node:test';
import assert from 'node:assert/strict';
import { fountainDropLanding, fountainSurfaceHeight } from './fountainFlow.js';

const profile = [[.55, .05], [.4, .14], [.2, .23], [.02, .264]];

test('falling drops reach the slate profile or pool at the end of their flight', () => {
  for (const [start, velocity] of [
    [[0, .89, 0], [.3, .1, 0]],
    [[.65, .16, 0], [.052, .15, 0]],
  ]) {
    const {duration, landing} = fountainDropLanding(start, velocity, profile, .038);
    assert.ok(duration > 0 && duration < 2);
    const radius = Math.hypot(landing[0], landing[2]);
    assert.ok(Math.abs(landing[1] - fountainSurfaceHeight(radius, profile, .038) - .002) < 1e-8);
    assert.ok(Math.abs(start[1] + velocity[1] * duration - 1.5 * duration ** 2 - (landing[1] - .002)) < 1e-8);
    const before = duration - .01;
    assert.ok(start[1] + velocity[1] * before - 1.5 * before ** 2 > fountainSurfaceHeight(Math.hypot(start[0] + velocity[0] * before, start[2] + velocity[2] * before), profile, .038));
  }
});
