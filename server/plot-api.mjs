import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ApiError, atomicJson, createPlotStore, readJson } from './plot-store.mjs';

export const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const derive = promisify(scrypt);
const COOKIE = 'rivergreen_admin';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 256;

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await derive(password, salt, 64)).toString('hex');
  return { algorithm: 'scrypt', salt, hash, createdAt: new Date().toISOString() };
}

function passwordInput(value) {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) throw new ApiError(400, `Use a password between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters.`);
  return value;
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new ApiError(415, 'Use application/json for this request.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > 256 * 1024) throw new ApiError(413, 'This request is too large.');
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ApiError(400, 'The request body is not valid JSON.'); }
}

export async function createPlotApi({
  stateDir = process.env.PLOT_STATE_DIR || join(PROJECT_ROOT, 'server-state'),
  password = process.env.PLOT_ADMIN_PASSWORD,
  appOrigin = process.env.PLOT_APP_ORIGIN,
  plotIds,
  clock = () => Date.now(),
} = {}) {
  const canonical = plotIds || (await readJson(join(PROJECT_ROOT, 'src/data/plotIds.json')))?.plotIds;
  if (!Array.isArray(canonical)) throw new Error('The canonical plot manifest is missing.');
  const store = await createPlotStore({ stateDir, plotIds: canonical, clock });
  const authPath = join(stateDir, 'admin-auth.json');
  let auth = password ? await hashPassword(passwordInput(password)) : await readJson(authPath);
  if (auth && (auth.algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(auth.salt) || !/^[a-f0-9]{128}$/.test(auth.hash))) throw new Error('The administrator password file has an invalid format.');
  const expectedOrigin = appOrigin ? new URL(appOrigin).origin : null;
  const sessions = new Map();
  const attempts = new Map();
  let setupQueue = Promise.resolve();

  const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
  const sessionKey = (req) => {
    const entry = (req.headers.cookie || '').split(';').find((part) => part.trim().startsWith(`${COOKIE}=`));
    return entry ? tokenHash(entry.trim().slice(COOKIE.length + 1)) : null;
  };
  const authenticated = (req) => {
    const key = sessionKey(req);
    const expires = key ? sessions.get(key) : null;
    if (!expires || expires <= clock()) { if (key) sessions.delete(key); return false; }
    return true;
  };
  const canSetup = (req) => {
    const address = req.socket?.remoteAddress;
    const localAddress = address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
    let host;
    try { host = new URL(`http://${req.headers.host}`).hostname; } catch { return false; }
    return !auth && !password && localAddress && ['localhost', '127.0.0.1', '[::1]'].includes(host);
  };
  const requireOrigin = (req) => {
    const protocol = req.socket?.encrypted ? 'https:' : 'http:';
    let origin;
    try { origin = new URL(req.headers.origin).origin; } catch { throw new ApiError(403, 'A matching same-origin request is required.', 'ORIGIN_REJECTED'); }
    const allowed = expectedOrigin || `${protocol}//${req.headers.host}`;
    if (origin !== allowed || req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'A matching same-origin request is required.', 'ORIGIN_REJECTED');
  };
  const cookie = (req, token, expire = false) => {
    const secure = req.socket?.encrypted || expectedOrigin?.startsWith('https://');
    return `${COOKIE}=${expire ? '' : token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${expire ? 0 : SESSION_DURATION / 1000}${secure ? '; Secure' : ''}`;
  };
  const issueSession = (req, res) => {
    for (const [key, expires] of sessions) if (expires <= clock()) sessions.delete(key);
    if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value);
    const token = randomBytes(32).toString('base64url');
    sessions.set(tokenHash(token), clock() + SESSION_DURATION);
    res.setHeader('Set-Cookie', cookie(req, token));
  };
  const requireAuth = (req) => { if (!authenticated(req)) throw new ApiError(401, 'Sign in to edit plot details.', 'AUTH_REQUIRED'); };
  const checkRate = (req) => {
    const key = req.socket?.remoteAddress || 'unknown';
    const now = clock();
    for (const [ip, attempt] of attempts) if (attempt.until <= now) attempts.delete(ip);
    if (attempts.size >= 1000 && !attempts.has(key)) attempts.delete(attempts.keys().next().value);
    const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    if (attempt.count >= 10) throw new ApiError(429, 'Too many sign-in attempts. Try again in 15 minutes.', 'RATE_LIMITED');
    attempt.count += 1;
    attempts.set(key, attempt);
    return key;
  };

  async function handle(req, res, next = () => json(res, 404, { success: false, error: 'NOT_FOUND', message: 'API route not found.' })) {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { return json(res, 400, { success: false, error: 'INVALID_REQUEST', message: 'Invalid URL.' }); }
    if (!url.pathname.startsWith('/api/')) return next();
    try {
      const path = url.pathname;
      if (req.method === 'GET' && path === '/api/plots') return json(res, 200, store.publicState());
      if (req.method === 'GET' && path === '/api/admin/session') return json(res, 200, { authenticated: authenticated(req), setupRequired: !auth, canSetup: canSetup(req) });
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) requireOrigin(req);

      if (req.method === 'POST' && path === '/api/admin/setup') {
        if (!canSetup(req)) throw new ApiError(403, 'Initial password setup is available only on the local machine.', 'SETUP_UNAVAILABLE');
        const body = await readBody(req);
        const proposed = passwordInput(body?.password);
        const setup = setupQueue.then(async () => {
          if (auth) throw new ApiError(409, 'An administrator password has already been configured.', 'ALREADY_CONFIGURED');
          const created = await hashPassword(proposed);
          await atomicJson(authPath, created);
          auth = created;
        });
        setupQueue = setup.catch(() => {});
        await setup;
        issueSession(req, res);
        return json(res, 200, { success: true, authenticated: true });
      }
      if (req.method === 'POST' && path === '/api/admin/login') {
        if (!auth) throw new ApiError(403, 'Set up the administrator password on the local machine first.', 'SETUP_REQUIRED');
        const ip = checkRate(req);
        const body = await readBody(req);
        if (typeof body?.password !== 'string' || body.password.length > PASSWORD_MAX) throw new ApiError(401, 'The password is incorrect.', 'INVALID_PASSWORD');
        const hash = await derive(body.password, auth.salt, 64);
        if (!timingSafeEqual(hash, Buffer.from(auth.hash, 'hex'))) throw new ApiError(401, 'The password is incorrect.', 'INVALID_PASSWORD');
        attempts.delete(ip);
        issueSession(req, res);
        return json(res, 200, { success: true, authenticated: true });
      }
      if (req.method === 'POST' && path === '/api/admin/logout') {
        sessions.delete(sessionKey(req));
        res.setHeader('Set-Cookie', cookie(req, '', true));
        return json(res, 200, { success: true, authenticated: false });
      }
      if (req.method === 'PUT' && path === '/api/admin/plots') {
        requireAuth(req);
        return json(res, 200, await store.importRecords(await readBody(req)));
      }
      const match = path.match(/^\/api\/admin\/plots\/([^/]+)$/);
      if (match && ['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        requireAuth(req);
        let id;
        try { id = decodeURIComponent(match[1]); } catch { throw new ApiError(400, 'Invalid plot number.'); }
        return json(res, 200, req.method === 'DELETE' ? await store.remove(id) : await store.upsert(id, await readBody(req)));
      }
      return json(res, 404, { success: false, error: 'NOT_FOUND', message: 'API route not found.' });
    } catch (error) {
      if (!(error instanceof ApiError)) console.error('Plot API request failed:', error.code || error.name);
      return json(res, error.status || 500, { success: false, error: error.code || 'SERVER_ERROR', message: error instanceof ApiError ? error.message : 'Unable to save or load plot details. Please try again.' });
    }
  }

  return { handle, close: async () => { sessions.clear(); attempts.clear(); await store.flush(); } };
}
