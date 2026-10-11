import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createPlotApi } from './plot-api.mjs';

const TEST_PASSWORD = 'local-test-password-only';
const ids = ['A-1', 'A-2', 'B-3'];

async function fixture(t, options = {}) {
  const stateDir = await mkdtemp('/private/tmp/rivergreen-server-test-');
  const api = await createPlotApi({ stateDir, plotIds: ids, password: null, ...options });
  t.after(async () => { await api.close(); await rm(stateDir, { recursive: true, force: true }); });
  return { api, stateDir };
}

async function request(api, method, path, body, options = {}) {
  const raw = body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body);
  const req = Readable.from(raw === null ? [] : [Buffer.from(raw)]);
  req.method = method;
  req.url = path;
  req.socket = { remoteAddress: options.address || '127.0.0.1', encrypted: options.encrypted || false };
  req.headers = {
    host: options.host || 'localhost:5173',
    origin: 'http://localhost:5173',
    'content-type': 'application/json',
    ...(options.cookie ? { cookie: options.cookie } : {}),
    ...options.headers,
  };
  const headers = {};
  let content;
  const res = { statusCode: 200, setHeader: (key, value) => { headers[key.toLowerCase()] = value; }, end: (value) => { content = value; } };
  await api.handle(req, res);
  return { status: res.statusCode, headers, body: JSON.parse(content) };
}

async function login(api) {
  const response = await request(api, 'POST', '/api/admin/login', { password: TEST_PASSWORD });
  assert.equal(response.status, 200);
  return response.headers['set-cookie'].split(';')[0];
}

test('local first setup hashes the password and protects mutations with a session', async (t) => {
  const { api, stateDir } = await fixture(t);
  assert.deepEqual((await request(api, 'GET', '/api/admin/session')).body, { authenticated: false, setupRequired: true, canSetup: true });
  assert.equal((await request(api, 'POST', '/api/admin/setup', { password: TEST_PASSWORD }, { host: 'example.com', address: '203.0.113.10', headers: { origin: 'http://example.com' } })).status, 403);
  assert.equal((await request(api, 'POST', '/api/admin/setup', { password: 'short' })).status, 400);
  assert.equal((await request(api, 'PUT', '/api/admin/plots/A-2', { status: 'SOLD' })).status, 401);
  const setup = await request(api, 'POST', '/api/admin/setup', { password: TEST_PASSWORD });
  assert.equal(setup.status, 200);
  assert.match(setup.headers['set-cookie'], /HttpOnly; SameSite=Strict; Max-Age=604800/);
  const cookie = setup.headers['set-cookie'].split(';')[0];
  const authFile = await readFile(join(stateDir, 'admin-auth.json'), 'utf8');
  assert.equal(authFile.includes(TEST_PASSWORD), false);
  assert.equal(JSON.parse(authFile).algorithm, 'scrypt');
  assert.equal((await request(api, 'GET', '/api/admin/session', undefined, { cookie })).body.authenticated, true);
  const saved = await request(api, 'PUT', '/api/admin/plots/A-2', { status: 'SOLD' }, { cookie });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.plot.status, 'SOLD');
  assert.equal((await request(api, 'POST', '/api/admin/setup', { password: TEST_PASSWORD })).status, 403);
  assert.equal((await request(api, 'POST', '/api/admin/logout', {}, { cookie })).status, 200);
  assert.equal((await request(api, 'GET', '/api/admin/session', undefined, { cookie })).body.authenticated, false);
});

test('cross-origin and missing-origin mutations are rejected even with a valid session', async (t) => {
  const { api } = await fixture(t, { password: TEST_PASSWORD });
  const cookie = await login(api);
  for (const origin of ['https://other.example', 'null', undefined]) {
    const response = await request(api, 'PUT', '/api/admin/plots/A-2', { status: 'SOLD' }, { cookie, headers: { origin } });
    assert.equal(response.status, 403);
    assert.equal(response.body.error, 'ORIGIN_REJECTED');
  }
  assert.equal((await request(api, 'GET', '/api/plots')).body.overrides.length, 0);
});

test('configured HTTPS origin produces secure cookies and seven-day sessions expire', async (t) => {
  let now = Date.parse('2026-10-07T00:00:00Z');
  const { api } = await fixture(t, { password: TEST_PASSWORD, appOrigin: 'https://rivergreen.example', clock: () => now });
  const response = await request(api, 'POST', '/api/admin/login', { password: TEST_PASSWORD }, { headers: { origin: 'https://rivergreen.example' } });
  assert.equal(response.status, 200);
  assert.match(response.headers['set-cookie'], /; Secure$/);
  const cookie = response.headers['set-cookie'].split(';')[0];
  now += 8 * 24 * 60 * 60 * 1000;
  assert.equal((await request(api, 'GET', '/api/admin/session', undefined, { cookie })).body.authenticated, false);
});

test('validated concurrent saves preserve every plot and survive a server restart', async (t) => {
  const { api, stateDir } = await fixture(t, { password: TEST_PASSWORD });
  const cookie = await login(api);
  const responses = await Promise.all([
    request(api, 'PUT', '/api/admin/plots/A-1', { status: 'RESERVED', dimensions: '30 × 60' }, { cookie }),
    request(api, 'PUT', '/api/admin/plots/A-2', { status: 'AVAILABLE', area_sqft: '1800', total_price: 9000000, notes: 'Corner plot' }, { cookie }),
    request(api, 'PUT', '/api/admin/plots/B-3', { status: 'SOLD', facing: 'East' }, { cookie }),
  ]);
  assert.ok(responses.every((response) => response.status === 200));
  const publicState = (await request(api, 'GET', '/api/plots')).body;
  assert.equal(publicState.overrides.length, 3);
  assert.ok(publicState.updatedAt);
  assert.equal(publicState.overrides.find((plot) => plot.plot_number === 'A-2').area_sqft, 1800);
  assert.deepEqual((await readdir(stateDir)).sort(), ['plot-records.json']);
  await api.close();
  const restarted = await createPlotApi({ stateDir, plotIds: ids, password: TEST_PASSWORD });
  t.after(() => restarted.close());
  assert.deepEqual((await request(restarted, 'GET', '/api/plots')).body, publicState);
  assert.equal((await request(restarted, 'GET', '/api/admin/session', undefined, { cookie })).body.authenticated, false);
});

test('unknown IDs, nonpublic fields, invalid values and malformed JSON do not alter records', async (t) => {
  const { api } = await fixture(t, { password: TEST_PASSWORD });
  const cookie = await login(api);
  assert.equal((await request(api, 'PUT', '/api/admin/plots/A-999', { status: 'SOLD' }, { cookie })).status, 404);
  for (const input of [{ status: 'BOUGHT' }, { area_sqft: -1 }, { total_price: 'NaN' }, { notes: 'x'.repeat(1001) }, { buyer_name: 'Synthetic field' }, { plot_number: 'A-1', status: 'SOLD' }, []]) {
    assert.equal((await request(api, 'PUT', '/api/admin/plots/A-2', input, { cookie })).status, 400);
  }
  assert.equal((await request(api, 'PUT', '/api/admin/plots/A-2', '{broken', { cookie })).status, 400);
  assert.equal((await request(api, 'PUT', '/api/admin/plots/A-2', { notes: 'x'.repeat(300000) }, { cookie })).status, 413);
  assert.deepEqual((await request(api, 'GET', '/api/plots')).body.overrides, []);
});

test('bulk import is all-or-nothing, merges without erasing other overrides, and reset persists', async (t) => {
  const { api, stateDir } = await fixture(t, { password: TEST_PASSWORD });
  const cookie = await login(api);
  await request(api, 'PUT', '/api/admin/plots/A-2', { status: 'AVAILABLE', dimensions: '30 × 60', notes: 'Keep until cleared' }, { cookie });
  const before = (await request(api, 'GET', '/api/plots')).body;
  const badImport = await request(api, 'PUT', '/api/admin/plots', { overrides: [{ plot_number: 'A-1', status: 'SOLD' }, { plot_number: 'B-3', total_price: -1 }] }, { cookie });
  assert.equal(badImport.status, 400);
  assert.deepEqual((await request(api, 'GET', '/api/plots')).body, before);
  assert.equal((await request(api, 'PUT', '/api/admin/plots', { overrides: [{ plot_number: 'A-2' }, { plot_number: 'A.2' }] }, { cookie })).status, 400);
  const imported = await request(api, 'PUT', '/api/admin/plots', { overrides: [{ plot_number: 'B-3', status: 'SOLD', total_price: 5000000 }] }, { cookie });
  assert.equal(imported.status, 200);
  assert.equal(imported.body.overrides.length, 2);
  const cleared = await request(api, 'PUT', '/api/admin/plots/A-2', { notes: null }, { cookie });
  assert.equal(cleared.body.plot.notes, null);
  assert.equal(cleared.body.plot.dimensions, '30 × 60');
  assert.equal((await request(api, 'DELETE', '/api/admin/plots/B-3', undefined, { cookie })).status, 200);
  assert.equal((await request(api, 'GET', '/api/plots')).body.overrides.length, 1);
  assert.equal(JSON.parse(await readFile(join(stateDir, 'plot-records.json'), 'utf8')).overrides[0].plot_number, 'A-2');
});

test('cleared source details remain explicit overrides after a restart until the plot is reset', async (t) => {
  const { api, stateDir } = await fixture(t, { password: TEST_PASSWORD });
  const cookie = await login(api);
  const saved = await request(api, 'PUT', '/api/admin/plots/A-2', { status: 'AVAILABLE', facing: '', dimensions: null, area_sqft: '' }, { cookie });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.plot.facing, null);
  assert.equal(saved.body.plot.dimensions, null);
  assert.equal(saved.body.plot.area_sqft, null);
  await api.close();
  const restarted = await createPlotApi({ stateDir, plotIds: ids, password: TEST_PASSWORD });
  t.after(() => restarted.close());
  const persisted = (await request(restarted, 'GET', '/api/plots')).body.overrides[0];
  assert.equal(persisted.facing, null);
  assert.equal(persisted.dimensions, null);
  assert.equal(persisted.area_sqft, null);
  const nextCookie = await login(restarted);
  await request(restarted, 'DELETE', '/api/admin/plots/A-2', undefined, { cookie: nextCookie });
  assert.deepEqual((await request(restarted, 'GET', '/api/plots')).body.overrides, []);
});

test('saved setup password works after restart and failed sign-ins are rate-limited', async (t) => {
  const { api, stateDir } = await fixture(t);
  await request(api, 'POST', '/api/admin/setup', { password: TEST_PASSWORD });
  await api.close();
  const restarted = await createPlotApi({ stateDir, plotIds: ids, password: null });
  t.after(() => restarted.close());
  assert.equal((await request(restarted, 'GET', '/api/admin/session')).body.setupRequired, false);
  await login(restarted);
  for (let count = 0; count < 10; count += 1) assert.equal((await request(restarted, 'POST', '/api/admin/login', { password: 'incorrect' })).status, 401);
  assert.equal((await request(restarted, 'POST', '/api/admin/login', { password: 'incorrect' })).status, 429);
});
