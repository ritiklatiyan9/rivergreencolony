import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingDeploymentOptions } from './booking-deployment.mjs';

test('Vercel connects to the hosted API and confirmed production origin without local env files', () => {
  assert.deepEqual(bookingDeploymentOptions({}), {
    upstream: 'https://sales-backend-ponq.onrender.com',
    appOrigin: 'https://www.rivergreencolony.com',
    expectedSiteId: 5,
    expectedSiteName: 'OM ASSOCIATES',
  });
});

test('local and explicit deployments keep their server settings and the OM project guard', () => {
  const local = bookingDeploymentOptions({ BOOKING_API_URL: 'http://127.0.0.1:8001' }, { production: false });
  assert.equal(local.upstream, 'http://127.0.0.1:8001');
  assert.equal(local.appOrigin, undefined);
  const custom = bookingDeploymentOptions({ BOOKING_API_URL: 'https://booking.example', PLOT_APP_ORIGIN: 'https://colony.example', RAZORPAY_KEY_SECRET: 'never-forward-this' });
  assert.equal(custom.appOrigin, 'https://colony.example');
  assert.equal(custom.upstream, 'https://booking.example');
  assert.equal(custom.expectedSiteId, 5);
  assert.equal(JSON.stringify(custom).includes('never-forward-this'), false);
});
