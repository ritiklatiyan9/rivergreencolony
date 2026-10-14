# River Green booking deployment

Deploy this folder, `Rivergreen Website`, as the Vercel project root. The included `vercel.json` builds `dist` and includes the `/api/booking/` Node function. Uploading only `dist` does not include booking APIs.

The server function defaults to the confirmed deployment:

| Setting | Value |
| --- | --- |
| Website | `https://www.rivergreencolony.com` |
| Booking API | `https://sales-backend-ponq.onrender.com` |
| Bookings project | OM ASSOCIATES, site **5** |
| Existing token | **₹101** |

Vercel requires no payment secrets. Optional overrides are `BOOKING_API_URL`, `PLOT_APP_ORIGIN`, and `SITE_URL`, as shown in `.env.production.example`. Checkout writes are restricted to the confirmed website origin. Other Vercel preview domains can view the page but do not accept checkout writes unless their origin is explicitly configured for a separate test deployment.

On the existing **Bookings API Render service**, set `WEBSITE_SITE_ID=5`, keeping its existing database and Razorpay credentials. Website booking and live status are already enabled for OM ASSOCIATES in the shared database. Keep its existing `WEBSITE_REQUEST_TOKEN_SECRET`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET` configured on that API only. Do not change the token amount or migrate existing booking records for this deployment.

After saving the API environment and restarting that service, run `npm run check:booking:production`. This checks the real public API without creating an order, reserving a plot, or charging a payment. It must report OM ASSOCIATES, site 5, 200 map cells, and enabled booking/payment configuration before production checkout is ready.

Then deploy this website on Vercel and attach `www.rivergreencolony.com`. Open `/api/booking/config` on that domain to confirm the same project settings. A uniquely mapped Company plot offers the ₹101 booking-request form. Duplicate, Booked, Registry and other ineligible plots stay unavailable. Paid requests go to **Booking Software → Website Management → OM ASSOCIATES** for staff review; payment does not automatically approve a booking.

Configure the Razorpay webhook on the Bookings API at `https://sales-backend-ponq.onrender.com/public/website/webhook`, with a matching `RAZORPAY_WEBHOOK_SECRET`, for `payment.captured`, `order.paid`, `refund.processed`, and `payment.refunded`. This lets the API recover payment results when a visitor closes the browser. Checkout callback verification and staff reconciliation remain available independently.

For local development, `.env.local` points to `http://127.0.0.1:8001`. Start the existing Bookings backend before opening the website, and run `npm run check:booking` to verify that local API.

Production checks in this session: the Render API health endpoint responded successfully, but its public website endpoints reported that the website project was not configured. The local API connected to the shared OM ASSOCIATES settings, which already enabled booking with a ₹101 token and live credentials. The Render environment was left unchanged at the user’s request. No real order or payment was created while verifying this setup.

## Search indexing after deployment

The production build includes the River Green G-and-leaf favicon, Apple/web icons, full prerendered page content, canonical and sharing links, JSON-LD, `robots.txt`, `sitemap.xml`, `sitemap.html` and `llms.txt`. These changes become public only after deploying this folder.

Keep `SITE_URL=https://www.rivergreencolony.com` at build time and, when using the Node server, at runtime. If the domain changes, rebuild with the new origin; the server rejects mismatched builds. Run `npm run test:seo` and `npm run build` before deploying.

On the deployed domain, confirm the home canonical points to `https://www.rivergreencolony.com/`, `/favicon-96.png` is accessible, `/robots.txt` advertises `https://www.rivergreencolony.com/sitemap.xml`, and `/plot-manager` returns `X-Robots-Tag: noindex, nofollow`.

Submit `https://www.rivergreencolony.com/sitemap.xml` in the verified Google Search Console property and request indexing of the home page with URL Inspection. Google decides ranking and sitelinks; metadata and sitemaps help discovery but do not guarantee a top position. Keep the Google Business Profile name, address, phone and website consistent, and add a link from the official Defence Garden project page.
