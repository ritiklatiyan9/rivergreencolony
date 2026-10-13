import { BOOKING_PROJECT } from '../server/booking-deployment.mjs';

const production = process.argv.includes('--production');
if (!production) {
  try { process.loadEnvFile?.('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const base = new URL(process.env.BOOKING_API_URL || BOOKING_PROJECT.apiUrl);
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Use a Booking API URL without credentials.');
async function read(path) {
  const response = await fetch(new URL(`${base.pathname.replace(/\/$/, '')}${path}`, base.origin), { redirect: 'error', signal: AbortSignal.timeout(45000), headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.message || `Booking API returned HTTP ${response.status}.`);
  return data;
}
try {
  const [health, config, inventory] = await Promise.all([read('/health'), read('/public/website/config'), read('/public/website/plots')]);
  if (health.service !== 'booking-api') throw new Error('This URL is not the Bookings API.');
  if (Number(config.site_id) !== BOOKING_PROJECT.siteId || config.site_name?.trim().toUpperCase() !== BOOKING_PROJECT.siteName || Number(inventory.site_id) !== BOOKING_PROJECT.siteId) throw new Error('Set WEBSITE_SITE_ID=5 on the Bookings backend for OM ASSOCIATES.');
  if (!config.booking_enabled || !config.status_display_enabled || !config.payment_ready) throw new Error('Enable website bookings and live status, and configure Razorpay on the Bookings backend.');
  if (!Array.isArray(inventory.plots) || inventory.plots.length !== 200) throw new Error('The API inventory does not match the 200-cell website layout.');
  console.log(JSON.stringify({ api: base.origin, project: config.site_name, site_id: config.site_id, booking_enabled: config.booking_enabled, token_rupees: config.booking_amount, payment_mode: config.test_mode ? 'test' : 'live', mapped_cells: inventory.plots.length, bookable_cells: inventory.plots.filter(plot => plot.bookable).length }, null, 2));
  console.log('Read-only connection check passed. No booking, reservation or payment was created.');
} catch (error) {
  console.error(`Booking connection check failed: ${error.message}`);
  process.exitCode = 1;
}
