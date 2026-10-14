# River Green booking deployment

Deploy this folder, `Rivergreen Website`, as the Vercel project root. The included `vercel.json` builds `dist` and includes the `/api/booking/` Node function. Uploading only `dist` does not include booking APIs.

The server function defaults to the confirmed deployment:

| Setting | Value |
| --- | --- |
| Website | `https://www.rivergreencolony.com` |
| Booking API | `https://sales-backend-ponq.onrender.com` |
| Bookings project | OM ASSOCIATES, site **5** |
| Current saved token | **₹100** |

Vercel requires no payment secrets. Optional overrides are `BOOKING_API_URL`, `PLOT_APP_ORIGIN`, and `SITE_URL`, as shown in `.env.production.example`. Checkout writes are restricted to the confirmed website origin. Other Vercel preview domains can view the page but do not accept checkout writes unless their origin is explicitly configured for a separate test deployment.

The existing **Bookings API Render service** now has `WEBSITE_SITE_ID=5` and the live Razorpay environment settings saved. Website booking and live status are enabled for OM ASSOCIATES in the shared database. Keep its stable `WEBSITE_REQUEST_TOKEN_SECRET`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET` configured on that API only, and retain the existing database connection. Preserve the current saved ₹100 token and existing booking records.

After saving the API environment and restarting that service, run `npm run check:booking:production`. This checks the real public API without creating an order, reserving a plot, or charging a payment. It must report OM ASSOCIATES, site 5, 200 map cells, and enabled booking/payment configuration before production checkout is ready.

The public website is already deployed on Vercel at `www.rivergreencolony.com`, and its `/api/booking/config` and `/api/booking/plots` endpoints reach this Render API. Open `/api/booking/config` on that domain to confirm the same project settings after future deployments. A uniquely mapped, unheld Company plot offers the current ₹100 booking-request form. Duplicate, Booked, Registry and other ineligible plots stay unavailable. Paid requests go to **Booking Software → Website Management → OM ASSOCIATES** for staff review; payment does not automatically approve a booking.

The live Razorpay webhook is configured and active at `https://sales-backend-ponq.onrender.com/public/website/webhook`, with matching `RAZORPAY_WEBHOOK_SECRET` on Render and Razorpay. It subscribes to `payment.captured`, `order.paid`, and `refund.processed`, so captured payments and completed refunds reach the server when a visitor closes the browser. Keep the existing secret stable. The webhook ID is saved as `RAZORPAY_WEBSITE_WEBHOOK_ID` in the ignored local backend environment for maintenance; the server does not require that ID. Checkout callback verification and staff reconciliation also remain available.

The local website's `.env.local` now points `BOOKING_API_URL` to `https://sales-backend-ponq.onrender.com`, so the local 3D map and checkout use the real OM ASSOCIATES API too. Run `npm run check:booking` to check that configured connection. To intentionally use the local Bookings backend for development, override `BOOKING_API_URL=http://127.0.0.1:8001` and start that backend first.

Production verification on 14 October 2026, after the Render environment save and deployment of backend commit `13f755e`: both the Render public API and website proxy returned HTTP 200 for configuration and plots, with OM ASSOCIATES site 5, live Razorpay keys, enabled bookings/status display and the saved ₹100 token. Both returned 200 map cells: 95 Registry, 41 Booked, 63 Company and one Unknown. At verification, 62 cells were bookable and one had an existing hold; those counts change as customers book. All 31 duplicate inventory numbers still blocked checkout while displaying their current ownership status, including A-6 as Registry and A-16 as Booked. Razorpay accepted a read-only authenticated request using the live keys. Before activating the webhook, a correctly signed empty integration healthcheck returned HTTP 200 with `ignored: true`, and an invalid signature returned HTTP 400; neither changed database records. Razorpay's webhook listing then confirmed the active endpoint and exactly the three configured event subscriptions. No order, reservation or payment was created by these checks. A completed live payment remains for the user's manual test.

## Search indexing after deployment

The production build includes the River Green G-and-leaf favicon, Apple/web icons, full prerendered page content, canonical and sharing links, JSON-LD, `robots.txt`, `sitemap.xml`, `sitemap.html` and `llms.txt`. These changes become public only after deploying this folder.

Keep `SITE_URL=https://www.rivergreencolony.com` at build time and, when using the Node server, at runtime. If the domain changes, rebuild with the new origin; the server rejects mismatched builds. Run `npm run test:seo` and `npm run build` before deploying.

On the deployed domain, confirm the home canonical points to `https://www.rivergreencolony.com/`, `/favicon-96.png` is accessible, `/robots.txt` advertises `https://www.rivergreencolony.com/sitemap.xml`, and `/plot-manager` returns `X-Robots-Tag: noindex, nofollow`.

Submit `https://www.rivergreencolony.com/sitemap.xml` in the verified Google Search Console property and request indexing of the home page with URL Inspection. Google decides ranking and sitelinks; metadata and sitemaps help discovery but do not guarantee a top position. Keep the Google Business Profile name, address, phone and website consistent, and add a link from the official Defence Garden project page.
