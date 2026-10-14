# River Green Colony, Shamli

A dedicated River Green website built with React, Vite, Tailwind CSS, GSAP ScrollTrigger, Framer Motion, Locomotive Scroll v5, and Three.js. Its public booking proxy connects the 3D map to OM ASSOCIATES inventory, Razorpay checkout and staff approvals. See [the integration guide](../WEBSITE_INTEGRATION.md) for setup and current defaults. For Vercel at `www.rivergreencolony.com`, use [the production deployment guide](DEPLOYMENT.md).

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Vite, normally http://127.0.0.1:5173. Development and preview include the booking proxy through the Vite plugin. Start the Booking API on port 8001 for live status.

```sh
npm run build
npm run preview
```

For the production Node server:

```sh
npm run build
npm start
```

`npm start` serves `dist/` and the API together, defaulting to http://127.0.0.1:5173. `HOST` and `PORT` can change the listener. `npm run build` also prerenders the whole page into `dist/index.html` (`scripts/prerender.mjs`), so search engines and AI crawlers that do not run JavaScript read the full content; the browser hydrates this markup and keeps the first paint visible while attaching interactions. The build fails if prerendering fails, so production never silently ships an empty page to crawlers. Bookings require the Node proxy or the included Vercel API function, connected to the deployed Booking API. Website Management writes to the shared database; static-only hosting cannot process checkout.

This implementation has not been published or connected to the existing Defence Garden website and does not claim official endorsement.

## The experience

- An editorial layout inspired by Mejuma Tuscany: warm cream and sand sections, forest-green accents, semibold Cormorant Garamond serif headings and Golos Text for labels, controls and body copy. Both active fonts are open licensed and self-hosted. A short forest-green loader raises the letters of the actual home heading from clipped masks, then expands and settles that same heading while its cover lifts away. It uses a bounded readiness wait and a 1.2-second transition; click, scroll or keyboard navigation skips it. Section URLs, including /login#overview, play the entrance before moving to their requested section. Reduced-motion visits open directly on the page. A compact 78px desktop / 72px phone header aligns the original wordmark and Defence Garden motto. It hides on downward scrolling and returns on upward scrolling; open navigation, dialogs and keyboard focus keep it accessible. Desktop uses smooth scrolling; mobile retains native touch scrolling. Section links (header, mobile menu, footer and page buttons) glide to their section on every device, landing just below the header, and the visitor's own touch, wheel or key input stops the glide.
- A full-screen architectural entrance hero with a white serif heading and a smaller location line over open blue sky, restrained planting and visible shop wings. The photograph fills the hero and uses compositor-based parallax; the loader provides the opening transition. Separate desktop and phone compositions use responsive super-resolution exports up to 3840px and 1440px wide. A single photographic layer and limited parallax preserve clarity. A centred community introduction leads into everyday-life imagery, 3D, gallery and location. The plot map is the final section immediately before the River Green Colony footer.
- Reveals: headline words rise out of masks, selected statements gain emphasis word by word as the page scrolls, photographs fade and settle using opacity and transforms, and desktop images use restrained parallax. Reduced-motion support, static rendering in hidden tabs and a bounded completion guard keep content readable if animation frames pause.
- Mejuma-inspired motion: practical project links sit directly below the hero; everyday-life perspectives stay readable beside a sticky photograph that changes with scrolling on wide screens, while narrow screens show each image with its text. Navigation marks the current section, dividers draw into place and reveals use shorter timings. Reduced motion retains immediate content and functional section tracking. Heavy scene imports begin near the experience section, WebGL starts near the actual canvas, and unchanged availability polls keep stable snapshots instead of repainting the map.
- All 11 project-gallery photographs with realistic AI lighting and color enhancements, in source order, category filters, and a keyboard-accessible lightbox. Property-style cards align concise image details beneath each photograph. Four numbered visit steps explain how to explore the layout, talk to the team, walk the colony and make a decision. Original files remain available in `public/images/`. The actual project film remains available through an optional film dialog.
- The original 2D project plan with all 200 plot and shop cells, labels, dimensions, roads, boundary, roundabout, landscaping, and decorative vehicle routes. Visitors can pan, pinch, zoom, reset, search, expand the map, and inspect a selected space. Selecting a space opens a booking form in the sidebar (name, mobile, optional message) that prepares a WhatsApp booking request to +91 97603 02690; nothing is stored on the site. The section heading is “Book Your Plot Now!”.
- A full-width interactive 3D colony using all 200 original polygons and 15 exact road shapes, rendered as a realistic drone view: a perspective camera, a sky with drifting clouds and horizon haze, sun shadows, ambient occlusion on capable desktops, procedurally shaded lawns, light concrete roads with terracotta brick edge bands, and open farmland with sugarcane, crop fields and only a few tree lines outside the colony. The town of Shamli spreads to the west and north-west on the horizon (left in the default view; dense low-rise houses, a sugar mill, water towers, mobile towers, a temple and a mosque) with farms to the east, and Shamli Road runs into town past a green "← शामली / SHAMLI" sign west of the entrance. It opens on the Interior plaza view, zoomed in on the fountain; the toolbar above the view switches between Aerial view, Plan view (the whole colony on any screen), Interior plaza and Entrance, and the page's chapter copy follows the selection. The view can be explored freely from every angle: drag to orbit all the way round, from just above the ground to straight down; right-drag, Shift-drag or two fingers pan anywhere on the map; pinch or Ctrl/⌘ + scroll zooms toward the point under the fingers or cursor, which stays put, so any corner can be reached and then orbited; a two-finger twist turns around the point between the fingers; double-click or double-tap flies to a spot; and zoom has no limits in or out. A short tip explains the gestures the first time the view appears in a visit, and again when a plain scroll or a one-finger swipe moves the page instead of the map. Zoom in, zoom out, view-from-higher, view-from-lower and Reset sit in a control pad pinned to the right edge of the view that stays on screen while the page scrolls past it; Reset returns to the Interior plaza. Arrow keys orbit, Shift + arrows pan, + / − zoom and Home resets; a plain mouse wheel and a single-finger vertical swipe keep scrolling the page.
- The plaza follows the official printed plan: the fountain is centered at original plan coordinates `[670, 612.5]` in the middle of a circular roundabout (its diameter is the plan's roundabout width, 180). The circle cuts a concave arc from each of the four corner gardens, which have clipped hedges along their straight edges and lamp posts, a paved walk and benches along the arc. The fountain is modelled on River Green's real fountain in the defencegarden.com photographs: a low round pool wall in polished black granite tiles (with red-brown granite panels where the red paver stripes meet it), a blue-and-white mosaic pool, a broad dome of stacked dark slate with a misty central plume, and a ring of 22 foaming jets round the dome's foot. The roundabout plaza is paved in grey interlocking pavers with red paver stripes on the boulevard axis, and steel pipe railings line the garden arcs. Coconut palms with coconut clusters line both sides of the boulevard just off each kerb (not on the median, at the client's request), clear of every crossing, street lamp, villa wall and the plaza; the boulevard keeps its white dashed centre line. At the north end the boulevard runs straight onto the Chakroad along the colony's north edge, with a row of alternating mango and neem trees on its far side; there is no wall or gate on that side. At the south, the entrance arch spans the boulevard flush with the fronts of the two shops that flank it (S17 and S18, about `[670, 1200]`), so it joins both shop wings; the white compound wall runs along the west, east and south sides and leaves the entrance road open at `[670, 1270]`, with Shamli Road outside.
- Villas stand on the plots from the client's site survey: A-15, A-47, B-58, B-38, B-24, A-55, B-44, B-1, B-14, A-34 and C-9, plus one villa across B-61 and B-62 and one across A-41 and A-42 (`VILLA_SITES` in `src/scene/sitePlots.js`); every other plot keeps its soil surface. Each villa site has a compound wall with an open sliding gate, kept inside its own plot(s) even where the map view widens the east bank's plots into trapezoids, a paved forecourt where one to three cars (BMW, Range Rover, Mahindra Scorpio) park nose to the house, front-garden shrubs and trees, and its plot numbers on the villa roof. Plots and shop roofs show live availability from the same records as the 2D map: #009933 green for Available and parks, and blue for both Booked and Registry. The same palette applies to every shop roof, including registered S1–S3, with a thin black border around each unit. Plots to confirm keep their soil surface. A counted legend sits in the toolbar. Clicking a plot or shop, or using Find plot, opens its details and website booking modal. Checkout follows the management settings and current ledger status. Light traffic (six cars, five motorcycles with riders), pedestrians, people on benches, swaying trees, drifting clouds and the fountain's water animate unless reduced motion is requested. Canopy trees clear all road polygons and the roundabout; the roadside coconut palms stand just off the boulevard's kerbs, their high fronds arching over it above the traffic; young fruit trees line plot edges and the corner park is planted. Rendering adapts to the device (resolution, shadow detail, ambient occlusion and planting density) and steps down automatically when frames run slow. Architecture and landscaping are visual interpretations based on the project photographs, a reference rendering and the printed plan; the plot geometry comes from the original plan.
- Live OM ASSOCIATES availability, areas and prices on the clickable 3D map. Available (Company) and parks use #009933 green; Booked and Registry both use blue. A single current ownership row supplies the status even when resale history shares its number; multiple current rows and unrecognized statuses display **Confirm availability**. Duplicate identities remain blocked from payment. Active non-cancelled bookings display Booked immediately even before accounting status sync. No unavailable details or prices are invented.
- A location card, opt-in Google Maps view, FAQs, and an accessible visit-request dialog. The dialog prepares a WhatsApp message for the visitor to send; it does not store enquiries or confirm a visit automatically.
- Responsive layouts, visible focus states, modal focus management, reduced-motion support, and a 3D fallback when WebGL is unavailable.

## Colony and free map surroundings

“Explore the Colony” opens the existing Three.js colony over Esri World Imagery
satellite tiles rendered with MapLibre. The default view rotates 90° clockwise.
It opens in Choose a plot with the colony and nearby area visible; Reset restores
this view. River Green imagery is available through tile level 18. The source
stops requesting new tiles there and reuses them at closer camera zooms, so
the provider's unavailable level-19 tiles cannot cover the surroundings.
The model and surroundings share one camera
and graphics context, so they stay together during pan, zoom, tilt and rotation.
The generated countryside, outside town and roadside tree rows are omitted in
this view. Plot colours still use the shared availability records.

Click **Aerial view** to start a looping drone tour: a full 360° panorama,
the entrance and H-shop frontage, the palm-lined avenue, fountain, gardens
and residential streets. Flight targets follow the rendered road centres and
their boulevard junctions. Pause/Resume, Next stop and Restart controls remain
on the map. Dragging, zooming, keyboard navigation or opening plot details
pauses the tour; selecting another view stops it. Background tabs, an offscreen
map and page scrolling suspend the flight clock. Reduced motion provides static
stops through Next stop. The standalone Colony only view supports the same tour.
Run `npm run test:motion` for the itinerary, clock and motion checks.

The front apron adds the supplied layout's angled H12-to-H1 shop row, with
H1 nearest the main road. Dark-grey interlocking paving has brick edging, a
brick band along the shop fronts and a brick ring around the small front island.
Continuous grass strips, shade trees and flowering plants follow the forecourt
borders with joined corners. Low stone edging bounds the lawns while the paved
centre, gate opening and road-side access stay clear.
The real outside road comes from the satellite imagery; no extra road surface
is drawn over it. The existing gate, S shops and interior registration stay
fixed. H frontage is traced architectural geometry, separate from the existing
200 booking-map IDs; its labels do not create inventory or booking availability.

No API key, registration or billing account is needed for the default map.
Provider attribution stays visible. “Colony only” opens the existing standalone
visualisation; “Google satellite” opens a separate live satellite map of the
same place. The satellite iframe has its own camera and does not contain the
custom 3D model. Directions use the Google Maps URL supplied for River Green.
If the free map fails to load, the explorer returns to the standalone colony.

The surrounding map includes the owner's 20 supplied Shamli landmarks in
`src/data/nearbyPlaces.js`. Actual Three.js unipoles have a vertical tapered metal
column, concrete base, bevelled champagne frame and white printed faces with
coloured category accents on both sides. The complete structures are enlarged
to 1.5× their initial dimensions. Heights and proportions stay fixed; perspective
and apparent size follow the map camera. Every base uses its supplied coordinate.
The dimensions are illustrative landmark markers rather than proposed physical
structures. Cricket Academy and Government hospital have staggered heights at
their separate, nearly identical coordinates. “Nearby places” shows the whole
area, including Ring Road Shamli; the selector and clicking a 3D sign fly closer.
“Hide banners” hides the structures. These belong to “3D + surroundings”.

The supplied Google directions pin remains unchanged. Four visible paved
perimeter corners from Esri imagery are recorded in `RIVER_GREEN_SITE_BOUNDARY`,
excluding the outside forecourt. A single projective registration maps the
layout plane onto all four corners, preserving straight road edges. Drawing
strokes extending outside the source boundary are clipped in a map-only copy;
all 200 plot IDs and 15 roads are retained, and the original plan is unchanged.

Complete houses, shop units, fountain and moving rigs use one local rotation
and uniform scale per assembly, keeping circles circular and preventing windows,
roofs or limbs from separating. The end shop's complete assembly is translated
inward to stay within the perimeter, including its roof label. Site surfaces
and parapets use the same boundary clip for visible geometry and shadows.
Material patterns use the original drawing coordinates. Camera bearing remains
independent of this fit. The source drawing's interior landmarks differ from the
imagery by around 8–9m; registration prioritizes the perimeter and preserves
the original interior layout. Satellite corners are visual measurements,
not surveyed parcel boundaries.

The four fountain gardens retain their registered outer edges; their inner
recesses, walks, railings, lamps and benches are calculated around the fountain's
protected circular frame. Inverse registration returns those paths to the
surface shader's coordinate system, avoiding elliptical paths around a round
pool. Benches keep their full proportions and face the fountain.

3D modules preload as the section approaches, alongside map initialization.
The custom layer starts at `style.load`, without waiting for all satellite tiles.
Map lighting uses a small daylight panorama and 64px environment faces instead
of rendering a 256px cloud sky into six faces. The standalone sky is retained;
unchanged plot statuses do not trigger another shadow-map render.

`VITE_COLONY_MAP_FIT_TO_SITE` defaults to `true`. Set it to `false` to use the
manual anchor, heading and single scale in `.env.example`. Legacy independent
width/length overrides are ignored. `VITE_COLONY_MAP_STYLE_URL` can replace the
satellite style while preserving provider attribution.

Implementation: `src/scene/colonyMapScene.js` owns the MapLibre custom layer,
`src/data/colonySiteFit.js` calculates registration and containment,
`src/scene/colonyMapFit.js` applies surface and protected assembly placement,
and `src/scene/colonyMapPlacement.js` supplies the base georeference frame.
Run `npm run test:map` for corner, containment, geometry, shader and camera checks.

Sources: [Esri World Imagery](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer),
[Esri attribution guidance](https://support.esri.com/en-us/knowledge-base/what-is-the-correct-way-to-cite-an-arcgis-online-basema-000012040), and
[MapLibre custom-layer camera input](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CustomRenderMethodInput/).

## Connected plot management

Manage website settings, payment verification and booking approval in the Booking Software's `/website-management` module as an existing admin or super-admin. The website's `/plot-manager` route now shows a read-only connected inventory. Website-local overrides and the historical sparse snapshot no longer determine map status.

Configure these server environment values for hosting:

| Variable | Purpose |
| --- | --- |
| `BOOKING_API_URL` | Booking API server address. Local default configuration is `http://127.0.0.1:8001`. Use the deployed API in production. |
| `PLOT_APP_ORIGIN` | The exact site's HTTPS origin, such as `https://your-domain.example`, for customer booking requests. |
| `SITE_URL` | The public site address, such as `https://your-domain.example`, used in the canonical link, Open Graph tags, structured data, `robots.txt`, `sitemap.xml` and `llms.txt`. The build (`scripts/prerender.mjs`) always writes these into `dist/`, defaulting to the production address `https://www.rivergreencolony.com` (`SITE.url` in `src/data/seo.js`), so static hosting such as Vercel serves a real canonical link and the search-engine files, even if prerendering the page fails. All serving modes fall back to `PLOT_APP_ORIGIN`, then `SITE.url`; request and preview hosts never change the public canonical address. Use the same `SITE_URL` for building and running the Node server; it rejects a build with a different origin. |
| `HOST` / `PORT` | Network listener settings required by the hosting environment. |

The browser uses `/api/booking/config` and `/api/booking/plots`. Availability refreshes every five seconds while visible, and on focus/visibility return. The proxy combines concurrent public reads with a two-second cache; private request recovery stays uncached. The Booking API publishes sanitized records without buyer or contact information. Failed connections clear status and disable checkout. Razorpay secrets live only on the Booking backend. The Node server, Vite dev/preview plugin and included Vercel Node function support the same public proxy.

## Edit content

| Content or behavior | Editing path |
| --- | --- |
| Project copy, sections, contacts and enquiries | `src/App.jsx` |
| SEO facts, “At a glance” facts, English FAQs and schema.org structured data | `src/data/seo.js` (`npm run test:seo`) |
| Search-engine files (`robots.txt`, `sitemap.xml` with images, `llms.txt`) and the site origin | `server/seo.mjs` |
| Page title, description, canonical, Open Graph and share image | `index.html` and `public/og-image.jpg` (title and description must match `src/data/seo.js`) |
| Active theme and responsive styling | `src/premium.css` (palette, typography and reveal styles, loaded last) over `src/residence.css`, `src/modern.css`, and `src/styles.css`; the intro curtain is in `index.html`; earlier `daylight.css`, `luxury.css` and `professional.css` themes are inactive |
| Current lightly planted desktop/phone heroes and exact prompts | `public/images/editorial-hero/open-provenance.json`, `open-landscape-prompt.txt` and `open-portrait-prompt.txt` |
| Full HD views, responsive variants, native AI outputs and complete prompt set | `public/images/hd/` and its `provenance.json`; delivery metadata in `src/data/imageAssets.json` |
| Family entrance hero, Full HD layers, mobile portrait and prompts | `public/images/hero-family/` and its `provenance.json` |
| Earlier hero layers and generation provenance | `public/images/hero-layers/` and its `provenance.json` |
| Scrolling, hero parallax, entrance animation, and section reveals | `src/hooks/useSiteMotion.js` |
| Gallery captions, categories, and source order | `src/data/gallery.js` |
| Original 2D layout and decorative vehicles | `src/data/plotLayout.jsx` and `src/data/plotVehicles.jsx` |
| 3D polygons, roads, and canonical plot IDs | `src/data/threePlotGeometry.json` and `src/data/plotIds.json` |
| Sanitized booking inventory and refresh | `src/data/plotStore.js` |
| Historical snapshot (unused for live status) | `src/data/plotAvailability.json` |
| Public booking proxy | `server/booking-proxy.mjs` and `api/booking/[...path].js` |
| Customer booking modal and checkout | `src/components/PlotBookingModal.jsx` and `src/data/websiteBooking.js` |
| 2D map interaction and styling | `src/components/PlotMap.jsx` and `src/components/PlotMap.css` |
| 3D view shell, toolbar, legend and zoom pad | `src/components/CommunityScene.jsx` and `src/components/CommunityScene.css` |
| 3D scene: camera, controls, quality tiers and module loading | `src/scene/colonyScene.js` and `src/scene/kit.js` |
| 3D sky, lighting and post-processing | `src/scene/sky.js` and `src/scene/post.js` |
| 3D roads, lawns, availability colours and plot numbers | `src/scene/ground.js` |
| 3D plaza from the printed plan (roundabout, gardens, fountain, median palms) | `src/scene/plazaLayout.js`, `src/scene/plaza.js`, `src/scene/plaza-fountain.js` and `src/scene/plaza-palms.js` |
| 3D Chakroad and its tree row | `src/scene/chakroad.js` |
| 3D wall, arch, shops, villas, parked cars and street lamps | `src/scene/architecture*.js` |
| Villa plots, forecourts, parked cars and villa gardens (layout) | `src/scene/sitePlots.js` (`node --test src/scene/sitePlots.test.js`) |
| 3D town of Shamli and the road sign | `src/scene/city*.js` |
| 3D trees, palms and hedges | `src/scene/vegetation*.js` (`node --test src/scene/vegetation-layout.test.js`) |
| 3D farmland, sugarcane, tree belts and Shamli Road | `src/scene/countryside*.js` |
| 3D traffic and people | `src/scene/life.js` |
| Authenticated manager | `src/components/PlotManager.jsx` and `src/components/PlotManager.css` |
| Persistent records and authentication API | `server/plot-store.mjs` and `server/plot-api.mjs` |
| Production server and development/preview API integration | `server/index.mjs`, `server/vite-plugin.mjs`, and `vite.config.js` |
| Local variable fonts, licenses, and provenance | `public/fonts/fonts.css` and `public/fonts/font-sources.json` |
| Road-clear planting and entrance opening | `src/data/sceneLandscape.js` (`npm run test:scene`) |

## Search and AI visibility

The page targets searches such as residential plots in Shamli, colonies in Shamli and property on Shamli Road, without inventing prices, distances, approvals or rankings.

- Title “River Green Colony | Residential Plots & Property in Shamli”, a 158-character description, `en-IN` language, a canonical link, Open Graph and Twitter cards with a 1200 × 630 share image (`public/og-image.jpg`, used by WhatsApp and Facebook previews) and `IN-UP` / Shamli geo tags.
- schema.org JSON-LD built from `src/data/seo.js`: the developer (Organization), the website, the colony (Residence, with address, map link, photographs and amenities), its sales office (RealEstateAgent) and an FAQPage. Coordinates (`SITE.geo`, also the `geo.position` meta tag) are the owners’ Google Maps pin (`RIVER_GREEN_LOCATION` in `src/data/colonyLocation.js`), and the map link and `sameAs` point at their Google Maps place, so the page and the Maps listing agree. Alternate names cover searches for River Green and Rivergreen Colony.
- An “At a glance” section (between location and FAQs) states the key facts in English. FAQ answers stay in the page while collapsed, so search engines read them; they include questions searchers ask, such as plots near Shamli and choosing a colony in Shamli, plus property and real estate in Shamli.
- River Green’s original capital G and attached leaf form the branded SVG, ICO and PNG favicons, Apple touch icon and web-manifest icons. Regenerate them with `python3 scripts/generate-favicons.py` (Pillow).
- `robots.txt` excludes `/api/` and advertises the canonical `sitemap.xml`. XML lists only the real public home page, plus the share image, current hero, evening fountain and gallery images. A crawl date is never emitted as a content modification date. `/sitemap.html` provides visitor-friendly section links and is linked in the footer; it uses `noindex, follow`.
- `/plot-manager` has its own empty HTML shell with `noindex, nofollow`, without public structured data. Node, Vite and Vercel also send `X-Robots-Tag`. Robots allows this route to be crawled so search engines can read its `noindex` instruction. Unknown routes on the production Node server return 404; `/login` remains a public home-page alias with the home canonical.

Steps that only the owners can take, and which matter most for “near me” searches: create and verify a Google Business Profile for River Green Colony at the entrance (category: real estate developer or housing development, the same name, address and phone as this site, photographs, and this website); submit `https://www.rivergreencolony.com/sitemap.xml` in Google Search Console (the `rivergreencolony.com` domain property already exists) and request indexing of the home page, then import the site into Bing Webmaster Tools from Search Console; collect genuine buyer reviews; list the project with the same details on property portals and local directories; and link to the site from defencegarden.com.

## Sources and assets

Public project information was inspected on 7 October 2026 using https://defencegarden.com/, https://defencegarden.com/project/1, and their public project bundles. Project-specific details include River Green Society, project 1, Shamli, ongoing status, a 2024 flagship township, landscaped fountain plaza, wide internal roads, and a live plot-booking map.

Sales: **+91 99276 69955**. Email: **defencegarden009@gmail.com**. Directions: **River Green Colony, Shamli Road, Mundet, Shamli, Uttar Pradesh 247776**. The sales team can confirm current availability, measurements, prices, and payment terms. Regulatory numbers and shared-template project measurements are not independently asserted.

`public/images/gallery-manifest.json` records all 11 original gallery URLs, ordering, dimensions, file sizes, and hashes. The originals, project film and prior lighting edits in `public/images/enhanced/` are preserved. The active gallery, features, overview aerial and fountain inset, location aerial, film banner and video poster now use realistic AI visualisations under `public/images/hd/`. Existing unfinished houses are shown completed within their footprints, with construction materials and debris removed. These images illustrate a finished appearance; they do not document current construction progress. Gallery and aerial captions identify them as visualisations.

Full-size landscape delivery assets are 1920 × 1440 (gallery) or 1920 × 1080 (aerials and hero layers); the portrait fountain retains its aspect ratio at 1920 pixels tall. Full-size assets and transparent layers use lossless WebP. The browser selects 640/960/1280px variants through `srcSet` and crop-aware `sizes`; opaque smaller versions use quality 96. The built-in ImageGen tool returned smaller native outputs despite higher-resolution requests. The Full HD files are carefully Lanczos-resampled exports of the AI-restored scenes, not native 4K generations. Scaling does not add genuine source detail. `public/images/hd/source/` retains the selected native outputs; `provenance.json` records every prompt, source, native and delivered dimensions, resampling and file hashes.

The active desktop hero uses `public/images/editorial-hero/open-landscape-3840.webp` with 1280/1920/2560 variants; the phone source uses `open-portrait-1440.webp` with 720/1080 variants. Built-in ImageGen reframed the existing visual with open sky and replaced dense tree canopies with spaced young trees, low hedges and open plots. Real-ESRGAN super-resolution followed by quality-92 WebP exports improves high-density delivery. These are upscaled AI visualisations, not native 4K photographs. Exact prompts, native sources, dimensions, hashes and processing are saved beside them. Previous images and transparent layers are preserved but inactive in the hero. Original photographs and the plot plan remain authoritative.

The fountain amenity panel uses `public/images/fountain-evening/fountain-families.webp`, an evening AI visualisation with two families seated on benches around the actual fountain design. Its 4:5 frame keeps both groups visible on desktop and mobile. Native output, responsive exports and the full built-in ImageGen prompt are preserved in that folder and its `provenance.json`; the 1536 × 1920 export is resampled from the 1122 × 1402 generated source. The original daytime fountain and other amenity photos remain preserved.

`public/branding/river-green-wordmark.png` is a transparent raster reproduction of the physical gate lettering, extracted and cleaned with built-in ImageGen. `public/branding/logo-provenance.json` records its source and generation details. Official Defence Garden logo files remain in `public/images/`.

`public/docs/map-sources.json` records the original plan component, public availability endpoint, retrieval date, and coordinate space. The sparse fallback snapshot was retrieved on 7 October 2026; it does not establish availability for every cell on the layout.

Active typography uses self-hosted Cormorant Garamond variable at 600 for serif headings and 500 for serif statements and Golos Text variable for labels, controls and body copy. Golos Text matches Mejuma's body face; Cormorant Garamond is the user's selected free alternative to its commercial serif fonts. Previous font assets remain available. Official SIL Open Font Licenses and provenance are in `public/fonts/`. The physical gate wordmark remains the logo. Fonts, imagery, video, geometry and 3D load locally. Live external availability, Google Maps, external project links and sending WhatsApp messages require internet access.

## Validation

```sh
npm run test:server
```

`npm run test:seo` checks the structured data, page head, search-engine files and origin handling. Eight backend test cases passed. Separate DOM validation passed 12 public interaction groups and five manager interaction groups with mocked fetch responses. These checks did not configure a real administrator password, alter actual plot records, or send enquiries. DOM interaction checks do not establish WebGL visual quality; graphics are reviewed separately. The 3D colony was reviewed in GPU screenshots of all four views at desktop and phone sizes and at the low quality tier, with no console errors; `npm run test:scene`, `node --test src/scene/vegetation-layout.test.js` and `node --test src/scene/sitePlots.test.js` (parked cars stay on the paving, clear of the houses, steps, plants and each other) pass. The current redesign passes 16 public interaction groups, including scroll-direction header visibility, mobile navigation, dialogs, plot search and booking validation, map placement immediately before the footer, and full River Green Colony branding. The existing four road-clearance tests also passed. The production build passes. The reduced-tree entrance hero, clearer typography, sage gradients and map-to-footer layout were visually reviewed at desktop and narrow widths; hero imagery and text remain visible during the introductory animation.


October 14, 2026 motion/loading update: production build and 87 distinct booking, SEO, scene, map and server tests pass. Built HTML checks confirm an eager hero, visible initial gallery/story content, matching hydration origin/year and no initial Three.js/MapLibre preloads. Live visual and browser interaction verification was unavailable in this session; the historical visual checks above predate this update.


October 14, 2026 loader and scroll refinement: Lenis runs on the GSAP ticker; layout refreshes coalesce actual size changes and wait for wheel/touch scrolling and inertia to settle. Returning from a background tab preserves completed reveals. Full-screen animated clipping, backdrop blur and blend effects were removed, gallery layout measurement is limited to filter changes, and decorative WebGL frames yield while the document scrolls. `npm run test:motion` checks refresh scheduling and WebGL pause/resume behavior. The production loader and its completed home reveal were visually checked in Chrome.

October 14, 2026 typography and information-layout update: added locally hosted Golos Text and the free Cormorant Garamond serif, property-style photo cards, numbered visit steps and scroll-linked statement emphasis. The production build and 30 motion, SEO and booking tests pass. Bootstrap checks cover the exact `/login#overview` URL, reduced motion, the management route and the loader's bounded fallback. The new process layout and typography were visually checked on port 5173 in Chrome.

October 14, 2026 typography refinement: use the official Cormorant variable font with native semibold headings and medium statements, moderate tracking and stronger label weights. The entrance restores the home title to continuous text when complete, allowing natural kerning and ligatures. Scroll-emphasis text starts at 55% opacity to remain easier to read.

October 14, 2026 copy and heading correction: removed the Hindi summary, Hindi FAQs and Hindi metadata aliases. The At a glance heading uses upright Golos Text semibold, aligned on two lines, with no script emphasis.
