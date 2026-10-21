import { Router, type Request, type Response, type RequestHandler } from 'express';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

type Config = { username: string; password: string; secret: string };
const cookieName = 'akamaru_session';
const lifetime = 12 * 60 * 60 * 1000;
const equal = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

export function createAuth(config?: () => Config, now = Date.now) {
  const router = Router();
  const failures = new Map<string, { count: number; until: number }>();
  const settings = config || (() => ({ username: process.env.AUTH_USERNAME || '', password: process.env.AUTH_PASSWORD || '', secret: process.env.AUTH_SESSION_SECRET || '' }));
  const configured = (c: Config) => !!c.username.trim() && c.username.length <= 80 && c.password.length >= 12 && /^[a-f0-9]{64}$/i.test(c.secret);
  function signature(body: string, c: Config) {
    // Changing either credential also invalidates existing sessions.
    const key = createHmac('sha256', Buffer.from(c.secret, 'hex')).update(`${c.username}\0${c.password}`).digest();
    return createHmac('sha256', key).update(body).digest('base64url');
  }
  function session(req: Request, c: Config): number | null {
    if (!configured(c)) return null;
    const value = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!value || value.length > 250) return null;
    const [version, expires, nonce, tag, extra] = value.split('.');
    if (version !== 'v1' || extra || !/^\d{13}$/.test(expires || '') || !/^[\w-]{32}$/.test(nonce || '') || !/^[\w-]{43}$/.test(tag || '')) return null;
    const expiry = Number(expires);
    if (expiry <= now() || expiry > now() + lifetime || !equal(signature(`${version}.${expires}.${nonce}`, c), tag)) return null;
    return expiry;
  }
  function sameOrigin(req: Request) {
    try {
      const origin = new URL(req.get('Origin') || '');
      return ['http:', 'https:'].includes(origin.protocol) && origin.origin === req.get('Origin') && origin.host === req.get('Host') && req.get('X-Akamaru-Request') === 'auth';
    } catch { return false; }
  }
  function setCookie(req: Request, res: Response, value: string, maxAge: number) {
    const secure = req.secure || req.get('Origin')?.startsWith('https://') || req.get('X-Forwarded-Proto') === 'https';
    res.cookie(cookieName, value, { httpOnly: true, secure: !!secure, sameSite: 'strict', path: '/', maxAge });
  }
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
  router.get('/session', (req, res) => {
    const c = settings(), expiresAt = session(req, c);
    res.json({ configured: configured(c), authenticated: !!expiresAt, ...(expiresAt ? { expiresAt } : {}) });
  });
  router.post('/login', (req, res) => {
    if (!sameOrigin(req)) { res.status(403).json({ error: 'Invalid login request.' }); return; }
    const c = settings();
    if (!configured(c)) { res.status(503).json({ error: 'Login is not configured on this server.' }); return; }
    const key = req.get('CF-Connecting-IP') || req.ip || 'unknown';
    const failed = failures.get(key);
    if (failed && failed.until > now() && failed.count >= 10) {
      res.setHeader('Retry-After', String(Math.ceil((failed.until - now()) / 1000)));
      res.status(429).json({ error: 'Too many login attempts. Please try again in a few minutes.' }); return;
    }
    const { username, password } = req.body || {};
    const validUser = typeof username === 'string' && username.length <= 80 && equal(username, c.username);
    const validPassword = typeof password === 'string' && password.length <= 512 && equal(password, c.password);
    if (!validUser || !validPassword) {
      if (failures.size >= 1000) failures.delete(failures.keys().next().value!);
      failures.set(key, { count: failed && failed.until > now() ? failed.count + 1 : 1, until: failed && failed.until > now() ? failed.until : now() + 10 * 60 * 1000 });
      res.status(401).json({ error: 'Incorrect username or password.' }); return;
    }
    failures.delete(key);
    const expiresAt = now() + lifetime;
    const body = `v1.${expiresAt}.${randomBytes(24).toString('base64url')}`;
    setCookie(req, res, `${body}.${signature(body, c)}`, lifetime);
    res.json({ authenticated: true, expiresAt });
  });
  router.post('/logout', (req, res) => {
    if (!sameOrigin(req)) { res.status(403).json({ error: 'Invalid logout request.' }); return; }
    setCookie(req, res, '', 0);
    res.json({ authenticated: false });
  });
  const requireSession: RequestHandler = (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const c = settings();
    if (!configured(c)) { res.status(503).json({ error: 'Login is not configured on this server.' }); return; }
    if (!session(req, c)) { res.status(401).json({ error: 'Sign in to continue.' }); return; }
    next();
  };
  return { router, requireSession };
}
