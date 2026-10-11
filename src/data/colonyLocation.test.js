import test from 'node:test';
import { mercatorPoint, prepareMapPlan } from './colonySiteFit.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLONY_MAP_ANCHOR, COLONY_MAP_HEADING, COLONY_MAP_METRES_PER_UNIT, COLONY_PLAN_SCALE, DEFAULT_COLONY_MAP_STYLE_URL, GOOGLE_MAPS_EMBED_URL, GOOGLE_MAPS_URL, RIVER_GREEN_FOUNTAIN, RIVER_GREEN_LOCATION, RIVER_GREEN_SITE_BOUNDARY, colonyPointToLatLng, getColonyMapConfig } from './colonyLocation.js';

const plan = JSON.parse(readFileSync(new URL('./threePlotGeometry.json', import.meta.url)));
const toRadians = value => value * Math.PI / 180;
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);

function distanceBetween(a, b) {
  const deltaLat = toRadians(b.lat - a.lat), deltaLng = toRadians(b.lng - a.lng);
  const haversine = Math.sin(deltaLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 6378137 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

test('directions and satellite embed use the supplied destination pin', () => {
  assert.ok(GOOGLE_MAPS_URL.includes('!2m2!1d77.2956644!2d29.4697908'));
  assert.ok(GOOGLE_MAPS_URL.includes('?entry=ttu&g_ep='));
  const embed = new URL(GOOGLE_MAPS_EMBED_URL);
  assert.equal(embed.searchParams.get('q'), `${RIVER_GREEN_LOCATION.lat},${RIVER_GREEN_LOCATION.lng}`);
  assert.equal(embed.searchParams.get('t'), 'k');
  assert.equal(embed.searchParams.get('output'), 'embed');
});

test('free map is configured by default and nominal placement stays finite', () => {
  const config = getColonyMapConfig();
  assert.deepEqual(config.location, COLONY_MAP_ANCHOR);
  assert.equal(config.styleUrl, DEFAULT_COLONY_MAP_STYLE_URL);
  assert.deepEqual(Object.keys(config).sort(), ['altitude', 'fitToSite', 'heading', 'location', 'metresPerUnit', 'styleUrl']);
  assert.equal(config.metresPerUnit, COLONY_MAP_METRES_PER_UNIT);
  assert.equal(config.altitude, .35);
  close(config.heading, COLONY_MAP_HEADING);
  assert.equal(config.fitToSite, true);
  assert.ok(Number.isFinite(colonyPointToLatLng(plan.roundabout.center, plan, config).lat));
});

test('blank, nonnumeric, nonfinite and out-of-range settings retain defaults', () => {
  for (const value of ['', '  ', 'not a number', 'NaN', 'Infinity', Infinity, NaN, null, false]) {
    const config = getColonyMapConfig({ VITE_COLONY_MAP_LAT: value, VITE_COLONY_MAP_LNG: value, VITE_COLONY_MAP_HEADING: value, VITE_COLONY_MAP_METRES_PER_UNIT: value, VITE_COLONY_MAP_ALTITUDE: value });
    assert.deepEqual(config.location, COLONY_MAP_ANCHOR);
    close(config.heading, COLONY_MAP_HEADING);
    assert.equal(config.metresPerUnit, COLONY_MAP_METRES_PER_UNIT);
    assert.equal(config.altitude, .35);
  }
  const config = getColonyMapConfig({ VITE_COLONY_MAP_LAT: '91', VITE_COLONY_MAP_LNG: '-181', VITE_COLONY_MAP_METRES_PER_UNIT: '0', VITE_COLONY_MAP_ALTITUDE: '-1' });
  assert.deepEqual(config.location, COLONY_MAP_ANCHOR);
  assert.equal(config.metresPerUnit, COLONY_MAP_METRES_PER_UNIT);
  assert.equal(config.altitude, .35);
});

test('explicit placement overrides accept zero and normalize clockwise heading', () => {
  const config = getColonyMapConfig({ VITE_COLONY_MAP_LAT: '0', VITE_COLONY_MAP_LNG: '0', VITE_COLONY_MAP_HEADING: '-450', VITE_COLONY_MAP_METRES_PER_UNIT: '5.5', VITE_COLONY_MAP_ALTITUDE: '0' });
  assert.deepEqual(config.location, { lat: 0, lng: 0 });
  assert.equal(config.heading, 270);
  assert.equal(config.metresPerUnit, 5.5);
  assert.equal(config.altitude, 0);
  assert.equal(getColonyMapConfig({ VITE_COLONY_MAP_HEADING: '720' }).heading, 0);
});

test('custom styles accept HTTPS or local HTTP and reject unsafe or malformed URLs', () => {
  for (const styleUrl of ['https://example.com/colony-style.json', 'http://localhost:5173/style.json', 'http://127.0.0.1:5173/style.json', 'http://[::1]:5173/style.json']) {
    assert.equal(getColonyMapConfig({ VITE_COLONY_MAP_STYLE_URL: ` ${styleUrl} ` }).styleUrl, styleUrl);
  }
  for (const styleUrl of ['', ' ', null, false, 123, 'not a URL', '/style.json', 'http://example.com/style.json', 'http://localhost.example.com/style.json', 'ftp://example.com/style.json', 'javascript:alert(1)', 'data:application/json,{}', 'https://user:pass@example.com/style.json']) {
    assert.equal(getColonyMapConfig({ VITE_COLONY_MAP_STYLE_URL: styleUrl }).styleUrl, DEFAULT_COLONY_MAP_STYLE_URL);
  }
});

test('plan deltas match scene scale, north orientation and configured rotation', () => {
  const config = { ...getColonyMapConfig(), fitToSite: false, heading: 0 }, [x, y] = plan.roundabout.center;
  const north = colonyPointToLatLng([x, y - 100], plan, config);
  const east = colonyPointToLatLng([x + 100, y], plan, config);
  assert.ok(north.lat > config.location.lat);
  close(north.lng, config.location.lng);
  assert.ok(east.lng > config.location.lng);
  close(distanceBetween(config.location, north), 100 * COLONY_PLAN_SCALE * config.metresPerUnit, 1e-6);
  close(distanceBetween(config.location, east), 100 * COLONY_PLAN_SCALE * config.metresPerUnit, 1e-6);
  const turned = { ...config, heading: 90 };
  const turnedNorth = colonyPointToLatLng([x, y - 100], plan, turned);
  const turnedEast = colonyPointToLatLng([x + 100, y], plan, turned);
  close(turnedNorth.lng, east.lng);
  close(turnedNorth.lat, east.lat);
  assert.ok(turnedEast.lat < config.location.lat);
  close(turnedEast.lng, config.location.lng);
});

test('date-line and polar placements remain finite, malformed points fail clearly', () => {
  const [x, y] = plan.roundabout.center;
  for (const location of [{ lat: 0, lng: 180 }, { lat: 90, lng: 0 }, { lat: -90, lng: 0 }]) {
    const point = colonyPointToLatLng([x + 100, y], plan, { ...getColonyMapConfig(), fitToSite: false, location });
    assert.ok(Number.isFinite(point.lat) && Math.abs(point.lat) <= 90);
    assert.ok(Number.isFinite(point.lng) && Math.abs(point.lng) <= 180);
  }
  assert.ok(colonyPointToLatLng([x + 100, y], plan, { ...getColonyMapConfig(), fitToSite: false, location: { lat: 0, lng: 180 } }).lng < 0);
  for (const point of [[NaN, 1], [1, Infinity], ['1', 2], [1], null]) assert.throws(() => colonyPointToLatLng(point, plan), TypeError);
  assert.throws(() => colonyPointToLatLng([1, 2], {}), TypeError);
  assert.throws(() => colonyPointToLatLng([1, 2], plan, { ...getColonyMapConfig(), metresPerUnit: -1 }), TypeError);
});

test('manual placement preserves fountain and entrance separation at the shared scale', () => {
  const config = { ...getColonyMapConfig(), fitToSite: false };
  const fountain = colonyPointToLatLng(plan.roundabout.center, plan, config);
  const entrance = colonyPointToLatLng(plan.entrance.center, plan, config);
  const planDistance = Math.hypot(plan.entrance.center[0] - plan.roundabout.center[0], plan.entrance.center[1] - plan.roundabout.center[1]);
  close(distanceBetween(fountain, entrance), planDistance * COLONY_PLAN_SCALE * config.metresPerUnit, 1e-6);
});


test('site fit coincides with all satellite corners and keeps clipped roads and plots inside', () => {
  const config = getColonyMapConfig(), fittedPlan = prepareMapPlan(plan);
  plan.boundary.forEach((point, i) => {
    const location = colonyPointToLatLng(point, plan, config);
    assert.ok(distanceBetween(location, RIVER_GREEN_SITE_BOUNDARY[i]) < .001);
  });
  const polygon = RIVER_GREEN_SITE_BOUNDARY.map(mercatorPoint);
  const direction = Math.sign(polygon.reduce((sum, a, i) => { const b = polygon[(i + 1) % polygon.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0));
  const points = [...fittedPlan.roads.flatMap(road => road.polygon), ...fittedPlan.plots.flatMap(plot => plot.geometry.polygon)];
  for (const point of points) {
    const [x, y] = mercatorPoint(colonyPointToLatLng(point, plan, config));
    polygon.forEach((a, i) => {
      const b = polygon[(i + 1) % polygon.length], clearance = direction * ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]));
      assert.ok(clearance >= -1e-17, `${point} exceeds fitted edge ${i}`);
    });
  }
});

test('dimension overrides retain one scale and cannot stretch individual axes or enlarge the footprint', () => {
  const larger = getColonyMapConfig({ VITE_COLONY_MAP_METRES_PER_UNIT: '12', VITE_COLONY_MAP_WIDTH_SCALE: '1.2', VITE_COLONY_MAP_LENGTH_SCALE: '1.2' });
  assert.equal(larger.metresPerUnit, COLONY_MAP_METRES_PER_UNIT);
  const smaller = getColonyMapConfig({ VITE_COLONY_MAP_METRES_PER_UNIT: '5', VITE_COLONY_MAP_WIDTH_SCALE: '.5', VITE_COLONY_MAP_LENGTH_SCALE: '.75' });
  assert.equal(smaller.metresPerUnit, 5);
  assert.ok(!('widthScale' in smaller) && !('lengthScale' in smaller));
});
