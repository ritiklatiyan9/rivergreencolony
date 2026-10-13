import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('availability polling shares requests, keeps unchanged snapshots stable and fails closed', async (t) => {
  // Vite resolves the store's JSON imports as it does in the browser. All
  // booking responses below are local fixtures; no service is contacted.
  const vite = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true },
  });
  t.after(() => vite.close());
  const store = await vite.ssrLoadModule('/src/data/plotStore.js');
  let config = { status_display_enabled: true, booking_enabled: true, payment_ready: true, booking_amount: 101 };
  let plots = [{ number: 'A-1', status: 'COMPANY', bookable: true, held: false, area_sqyd: 100 }];
  let failed = false, calls = 0, gated = true, release;
  const gate = new Promise(resolve => { release = resolve; });
  t.mock.method(globalThis, 'fetch', async (path) => {
    calls++;
    if (gated) await gate;
    if (failed) throw new Error('The booking service is unavailable.');
    assert.ok(['/api/booking/config', '/api/booking/plots'].includes(path));
    return new Response(JSON.stringify(path.endsWith('/config') ? config : { status_display_enabled: true, plots }));
  });
  let notifications = 0;
  const unsubscribe = store.subscribePlotRecords(() => { notifications++; });
  t.after(unsubscribe);

  const first = store.refreshPlotRecords();
  const simultaneous = store.refreshPlotRecords();
  assert.equal(calls, 2, 'concurrent refreshes share one config and one plots request');
  gated = false; release();
  await Promise.all([first, simultaneous]);
  const originalRecords = store.getPlotRecords(), originalState = store.getPlotStoreState();
  const originalPlot = originalRecords.find(plot => plot.number === 'A-1');
  const unchangedPlot = originalRecords.find(plot => plot.number !== 'A-1');
  assert.equal(originalPlot.status, 'AVAILABLE');
  assert.equal(originalPlot.bookable, true);
  assert.equal(originalPlot.area_sqft, 900);
  assert.equal(notifications, 1);

  await store.refreshPlotRecords();
  assert.equal(calls, 4, 'explicit refresh always checks the service');
  assert.equal(store.getPlotRecords(), originalRecords);
  assert.equal(store.getPlotStoreState(), originalState);
  assert.equal(notifications, 1, 'an identical poll causes no subscriber update');

  plots = [{ ...plots[0], held: true, bookable: false }];
  await store.refreshPlotRecords();
  const held = store.getPlotRecords().find(plot => plot.number === 'A-1');
  assert.equal(held.held, true);
  assert.equal(held.bookable, false);
  assert.notEqual(held, originalPlot);
  assert.equal(store.getPlotRecords().find(plot => plot.number === unchangedPlot.number), unchangedPlot);
  assert.equal(notifications, 2, 'a changed hold is published immediately');

  config = { ...config, status_display_enabled: false };
  await store.refreshPlotRecords();
  const hidden = store.getPlotRecords().find(plot => plot.number === 'A-1');
  assert.equal(hidden.status, 'UNKNOWN');
  assert.equal(hidden.bookable, false);
  assert.equal(hidden.held, false);

  config = { ...config, status_display_enabled: true };
  plots = [{ ...plots[0], held: false, bookable: true }];
  await store.refreshPlotRecords();
  failed = true;
  await store.refreshPlotRecords();
  const unavailableRecords = store.getPlotRecords(), unavailableState = store.getPlotStoreState();
  assert.equal(unavailableState.serverConnected, false);
  assert.equal(unavailableState.bookingConfig, null);
  assert.ok(unavailableRecords.every(plot => plot.status === 'UNKNOWN' && !plot.bookable && !plot.held));
  const unavailableNotifications = notifications;
  await store.refreshPlotRecords();
  assert.equal(store.getPlotRecords(), unavailableRecords);
  assert.equal(store.getPlotStoreState(), unavailableState);
  assert.equal(notifications, unavailableNotifications, 'repeated failures cause no duplicate rendering');

  failed = false;
  await store.refreshPlotRecords();
  assert.equal(store.getPlotStoreState().serverConnected, true);
  assert.equal(store.getPlotRecords().find(plot => plot.number === 'A-1').bookable, true);
});
