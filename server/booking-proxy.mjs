// The website only exposes the booking API's public, customer-safe endpoints.
// Gateway credentials and staff authentication never pass through this proxy.
export function createBookingProxy({ upstream = process.env.BOOKING_API_URL, appOrigin = process.env.PLOT_APP_ORIGIN, fetchImpl = fetch, cacheMs = 2000 } = {}) {
  const attempts = new Map();
  const publicCache = new Map(), publicReads = new Map();
  let base;
  if (upstream) {
    base = new URL(upstream);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('BOOKING_API_URL must be an HTTP(S) server URL without credentials.');
  }
  const json = (res, code, value) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  };
  return async function bookingProxy(req, res, next) {
    const url = new URL(req.url || '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/booking/')) return next();
    const path = url.pathname.slice('/api/booking'.length);
    const allowed = (req.method === 'GET' && (/^\/(config|plots)$/.test(path) || /^\/requests\/[a-zA-Z0-9_-]{32,128}$/.test(path)))
      || (req.method === 'POST' && (['/orders', '/payments/verify'].includes(path) || /^\/requests\/[a-zA-Z0-9_-]{32,128}\/reconcile$/.test(path)));
    if (!allowed) return json(res, 404, { message: 'This booking endpoint is unavailable.' });
    if (!base) return json(res, 503, { message: 'Online booking is being prepared. Please contact the River Green team.' });
    if (req.method === 'POST') {
      // The public backend sees this server as one caller. Apply the visitor
      // checkout limit here using the actual socket, never a browser header.
      const now = Date.now(), ip = req.socket?.remoteAddress || 'unknown', kind = path === '/orders' ? 'order' : 'verify';
      for (const [key, entry] of attempts) if (entry.until < now) attempts.delete(key);
      const key = `${ip}:${kind}`, entry = attempts.get(key) || { count: 0, until: now + (kind === 'order' ? 600000 : 60000) };
      if (attempts.size >= 10000 || ++entry.count > (kind === 'order' ? 20 : 60)) return json(res, 429, { message: 'Too many booking attempts. Please wait and try again.' });
      attempts.set(key, entry);
    }
    try {
      let body;
      if (req.method === 'POST') {
        const expected = appOrigin ? new URL(appOrigin).origin : `${req.socket?.encrypted ? 'https' : 'http'}://${req.headers.host}`;
        if (req.headers.origin !== expected || req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { message: 'Open this booking form on the River Green website.' });
        if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) return json(res, 415, { message: 'Use a JSON booking request.' });
        if (req.body != null) body = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        else {
          const chunks = []; let size = 0;
          for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > 16384) return json(res, 413, { message: 'This booking request is too large.' }); chunks.push(Buffer.from(chunk)); }
          body = Buffer.concat(chunks).toString('utf8');
        }
        if (Buffer.byteLength(body) > 16384) return json(res, 413, { message: 'This booking request is too large.' });
        JSON.parse(body);
      }
      // No visitor-selected upstream, query string, cookies, JWT or private headers.
      const target = new URL(`${base.pathname.replace(/\/$/, '')}/public/website${path}`, base.origin);
      const publicRead = req.method === 'GET' && ['/config', '/plots'].includes(path);
      const cached = publicRead && publicCache.get(path);
      if (cached && cached.until > Date.now()) return json(res, 200, cached.data);
      const fetchData = async () => {
        const response = await fetchImpl(target, { method: req.method, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body, redirect: 'error', signal: AbortSignal.timeout(20000) });
        const data = await response.json();
        if (publicRead && response.status === 200) publicCache.set(path, { data, until: Date.now() + cacheMs });
        return { status: response.status, data };
      };
      if (publicRead && !publicReads.has(path)) publicReads.set(path, fetchData().finally(() => publicReads.delete(path)));
      const response = await (publicRead ? publicReads.get(path) : fetchData());
      json(res, response.status, response.data);
    } catch (error) {
      json(res, error instanceof SyntaxError ? 400 : 503, { message: error instanceof SyntaxError ? 'Enter valid booking details.' : 'The booking service is temporarily unavailable. Please try again.' });
    }
  };
}
