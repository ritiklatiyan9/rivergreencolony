import { createBookingProxy } from '../../server/booking-proxy.mjs';
import { bookingDeploymentOptions } from '../../server/booking-deployment.mjs';

// Vercel Node function: the Vite bundle stays static, while public booking
// requests reach the same Booking Software API as the local Node server.
const proxy = createBookingProxy(bookingDeploymentOptions());
export default async function handler(req, res) {
  await proxy(req, res, () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Booking endpoint unavailable.' }));
  });
}
