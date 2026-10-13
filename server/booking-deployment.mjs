// Public deployment coordinates only. Payment credentials stay on Bookings.
export const BOOKING_PROJECT = Object.freeze({
  apiUrl: 'https://sales-backend-ponq.onrender.com',
  websiteOrigin: 'https://www.rivergreencolony.com',
  siteId: 5,
  siteName: 'OM ASSOCIATES',
});

export function bookingDeploymentOptions(env = process.env, { production = true } = {}) {
  return {
    upstream: env.BOOKING_API_URL || BOOKING_PROJECT.apiUrl,
    appOrigin: env.PLOT_APP_ORIGIN || (production ? BOOKING_PROJECT.websiteOrigin : undefined),
    expectedSiteId: BOOKING_PROJECT.siteId,
    expectedSiteName: BOOKING_PROJECT.siteName,
  };
}
