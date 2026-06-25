import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import { getRequestListener } from '@hono/node-server';
import crypto from 'node:crypto';
import { firestore, getFieldValue } from '../lib/firebase.js';
import {
  r2PresignPut,
  r2PresignGet,
  r2PublicUrl,
  r2Delete,
  r2Head,
} from '../lib/r2.js';
import {
  COOKIE_NAME,
  constantTimeEqual,
  signJwt,
  verifyJwt,
} from '../lib/auth.js';
import { nowSec, randomId, safeExt, searchTerms, slugify } from '../lib/utils.js';
import { DEFAULT_CATEGORIES, type App, type Category, type Screenshot } from '../lib/types.js';

export const config = { runtime: 'nodejs' };

const app = new Hono().basePath('/api');

// --- Security: restrict CORS to same origin only ---
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '';
    if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) return origin;
    // Allow same-origin requests from the Vercel deployment
    if (origin.endsWith('.vercel.app') || origin === 'https://goldenstore.me' || origin === 'https://www.goldenstore.me') return origin;
    return '';
  },
  credentials: true,
}));

// --- Security: rate limiter (in-memory, per IP) ---
const rateLimits = new Map<string, { count: number; reset: number }>();
function rateLimit(ip: string, key: string, maxRequests: number, windowSec: number): boolean {
  const k = `${key}:${ip}`;
  const now = Date.now();
  const entry = rateLimits.get(k);
  if (!entry || now > entry.reset) {
    rateLimits.set(k, { count: 1, reset: now + windowSec * 1000 });
    return true;
  }
  entry.count++;
  if (entry.count > maxRequests) return false;
  return true;
}
// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimits) {
    if (now > v.reset) rateLimits.delete(k);
  }
}, 5 * 60 * 1000);

function getClientIp(c: any): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') || 'unknown';
}

// --- Security: add security headers to all responses ---
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// --- Security: body size limit (1MB) ---
const MAX_BODY_SIZE = 1024 * 1024;
app.use('*', async (c, next) => {
  const cl = c.req.header('content-length');
  if (cl && Number(cl) > MAX_BODY_SIZE) {
    return c.json({ error: 'payload_too_large' }, 413);
  }
  await next();
});

// ---------------- helpers ----------------

async function requireAdmin(c: any, next: any) {
  const token = getCookie(c, COOKIE_NAME);
  const secret = process.env.JWT_SECRET || '';
  if (!token || !secret) return c.json({ error: 'unauthorized' }, 401);
  const payload = verifyJwt(token, secret);
  if (!payload || payload.role !== 'admin') return c.json({ error: 'unauthorized' }, 401);
  c.set('user', { sub: String(payload.sub) });
  await next();
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let i = 1;
  while (true) {
    const db = await firestore();
    const snap = await db.collection('apps').where('slug', '==', slug).limit(1).get();
    if (snap.empty) return slug;
    i++;
    slug = `${base}-${i}`;
    if (i > 200) return `${base}-${randomId().slice(0, 6)}`;
  }
}

function ratingAverage(d: any): number {
  const count = Number(d.rating_count || 0);
  const sum = Number(d.rating_sum || 0);
  if (count <= 0) return 0;
  return Math.round((sum / count) * 10) / 10;
}

function appPublic(doc: any, includeInternalKeys = false): App & { id: string } {
  const d = doc.data() as App;
  const ratingCount = Number((d as any).rating_count || 0);
  const result: any = {
    id: doc.id,
    slug: d.slug,
    name: d.name,
    name_lower: d.name_lower,
    search_terms: [],
    package_name: d.package_name,
    short_description: d.short_description,
    description: d.description,
    category: d.category,
    type: (d as any).type === 'game' ? 'game' : 'app',
    developer: d.developer,
    version_name: d.version_name,
    version_code: d.version_code,
    min_sdk: d.min_sdk,
    size_bytes: d.size_bytes,
    rating: ratingAverage(d),
    rating_count: ratingCount,
    stars: ratingCount,
    downloads: d.downloads || 0,
    created_at: d.created_at,
    updated_at: d.updated_at,
  };
  if (includeInternalKeys) {
    result.apk_key = d.apk_key;
    result.icon_key = d.icon_key;
    result.feature_key = (d as any).feature_key;
  }
  return result;
}

// Public URL for the wide feature graphic (same R2 public bucket as icons).
function feature_url(feature_key?: string): string | null {
  if (!feature_key) return null;
  try {
    return r2PublicUrl(feature_key);
  } catch {
    return null;
  }
}

function icon_url(icon_key?: string): string | null {
  if (!icon_key) return null;
  try {
    return r2PublicUrl(icon_key);
  } catch {
    return null;
  }
}

// ---------------- public ----------------

app.get('/store', (c) => {
  return c.json({
    name: process.env.STORE_NAME || 'Goldenstore',
    domain: process.env.STORE_DOMAIN || 'goldenstore.me',
  });
});

app.get('/categories', async (c) => {
  // Get app counts per category
  const db = await firestore();
  const snap = await db.collection('apps').select('category').get();
  const counts: Record<string, number> = {};
  snap.forEach((d: any) => {
    const cat = (d.data() as any).category || 'other';
    counts[cat] = (counts[cat] || 0) + 1;
  });
  const categories: Category[] = DEFAULT_CATEGORIES.map((c) => ({ ...c, count: counts[c.slug] || 0 }));
  return c.json({ categories });
});

app.get('/apps', async (c) => {
  const q = (c.req.query('q') || '').trim().toLowerCase();
  const category = (c.req.query('category') || '').trim();
  const type = (c.req.query('type') || '').trim();
  const sort = (c.req.query('sort') || 'recent').trim();
  const starredOnly = c.req.query('starred') === '1';
  const limit = Math.min(Number(c.req.query('limit') || '24') || 24, 60);
  const offset = Math.max(Number(c.req.query('offset') || '0') || 0, 0);

  const db = await firestore();
  let query: any = db.collection('apps');
  if (category) query = query.where('category', '==', category);
  if (type) query = query.where('type', '==', type);
  if (starredOnly) query = query.where('stars', '>', 0);
  if (q) {
    const token = q.split(/\s+/).filter((w) => w.length >= 2)[0];
    if (token) query = query.where('search_terms', 'array-contains', token);
  }

  if (sort === 'popular') query = query.orderBy('downloads', 'desc');
  else if (sort === 'stars' || sort === 'rating') query = query.orderBy('rating', 'desc');
  else if (sort === 'name') query = query.orderBy('name_lower', 'asc');
  else query = query.orderBy('created_at', 'desc');

  let total: number;
  let snap: any;
  try {
    total = (await query.count().get()).data().count;
    snap = await query.limit(limit).offset(offset).get();
  } catch (err: any) {
    if (err?.code === 9 || err?.code === 3 || /index/i.test(err?.message ?? '')) {
      // Composite index not yet created — fall back to unordered fetch + in-memory sort
      let fallback: any = db.collection('apps');
      if (category) fallback = fallback.where('category', '==', category);
      if (type) fallback = fallback.where('type', '==', type);
      if (starredOnly) fallback = fallback.where('stars', '>', 0);
      if (q) {
        const token = q.split(/\s+/).filter((w) => w.length >= 2)[0];
        if (token) fallback = fallback.where('search_terms', 'array-contains', token);
      }
      const allSnap = await fallback.get();
      let docs = allSnap.docs;
      if (sort === 'popular') docs.sort((a: any, b: any) =>
        ((b.data().downloads || 0) - (a.data().downloads || 0)) || (ratingAverage(b.data()) - ratingAverage(a.data())));
      else if (sort === 'stars' || sort === 'rating') docs.sort((a: any, b: any) =>
        (ratingAverage(b.data()) - ratingAverage(a.data())) || ((b.data().rating_count || 0) - (a.data().rating_count || 0)));
      else if (sort === 'name') docs.sort((a: any, b: any) => (a.data().name_lower || '').localeCompare(b.data().name_lower || ''));
      else docs.sort((a: any, b: any) => (b.data().created_at || 0) - (a.data().created_at || 0));
      total = docs.length;
      docs = docs.slice(offset, offset + limit);
      snap = { docs };
    } else {
      throw err;
    }
  }
  const apps = snap.docs.map((d: any) => {
    const a = appPublic(d);
    return { ...a, icon_url: icon_url((d.data() as App).icon_key), feature_url: feature_url((d.data() as App).feature_key) };
  });
  return c.json({ apps, total });
});

app.get('/apps/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = await firestore();
  const snap = await db.collection('apps').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return c.json({ error: 'not_found' }, 404);
  const doc = snap.docs[0];
  const ap = appPublic(doc);
  const rawData = doc.data() as App;
  const ssSnap = await db
    .collection('apps')
    .doc(doc.id)
    .collection('screenshots')
    .orderBy('position', 'asc')
    .get();
  const screenshots = ssSnap.docs.map((s: any) => {
    const sd = s.data() as Screenshot;
    return { id: s.id, position: sd.position, url: icon_url(sd.r2_key) };
  });
  return c.json({
    app: { ...ap, icon_url: icon_url(rawData.icon_key), feature_url: feature_url(rawData.feature_key) },
    screenshots,
  });
});

app.get('/apps/:slug/download', async (c) => {
  const ip = getClientIp(c);
  const slug = c.req.param('slug');
  if (!rateLimit(ip, 'download', 30, 60)) {
    return c.json({ error: 'rate_limit_exceeded' }, 429);
  }
  const db = await firestore();
  const snap = await db.collection('apps').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return c.json({ error: 'not_found' }, 404);
  const doc = snap.docs[0];
  const a = doc.data() as App;
  if (!a.apk_key) return c.json({ error: 'apk_not_available' }, 404);

  // Rate-limit download counter: max 1 increment per IP per app per 10 min
  if (rateLimit(ip, `dl-count:${slug}`, 1, 600)) {
    const FV = await getFieldValue();
    await doc.ref.update({ downloads: FV.increment(1) });
  }

  const filename = `${a.slug || 'app'}-${a.version_name || ''}.apk`.replace(/-+/g, '-');
  const disposition = `attachment; filename="${filename}"`;
  const url = await r2PresignGet(a.apk_key, 300, disposition);

  // Same-origin streaming mode: proxy the bytes through this function so the
  // browser can read a real Content-Length and report genuine download progress.
  if (c.req.query('stream') === '1') {
    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      return c.json({ error: 'download_failed' }, 502);
    }
    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.android.package-archive');
    headers.set('Content-Disposition', disposition);
    const len = upstream.headers.get('content-length');
    if (len) headers.set('Content-Length', len);
    headers.set('Cache-Control', 'no-store');
    return new Response(upstream.body, { headers });
  }

  return c.redirect(url);
});

// ---------------- star / vote ----------------

function serverFingerprint(c: any): string {
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';
  const ua = c.req.header('user-agent') || '';
  const lang = c.req.header('accept-language') || '';
  return `${ip}||${ua}||${lang}`;
}

function computeVoteHash(clientFp: string, serverFp: string): string {
  return crypto
    .createHash('sha256')
    .update(`${clientFp}::${serverFp}`)
    .digest('hex');
}

app.post('/apps/:slug/star', async (c) => {
  const ip = getClientIp(c);
  // Rate limit: max 10 star attempts per IP per minute (anti-spam burst guard)
  if (!rateLimit(ip, 'star', 10, 60)) {
    return c.json({ error: 'rate_limit_exceeded' }, 429);
  }
  const slug = c.req.param('slug');

  const body = await c.req.json().catch(() => ({} as any));
  const clientFp = String(body.fp || '').trim();
  if (!clientFp || clientFp.length < 16 || clientFp.length > 256) {
    return c.json({ error: 'invalid_fingerprint' }, 400);
  }
  const rating = Math.round(Number(body.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return c.json({ error: 'invalid_rating' }, 400);
  }
  const comment = String(body.comment || '').trim().slice(0, 2000);
  const name = String(body.name || '').trim().slice(0, 60);
  const uid = String(body.uid || '').trim().slice(0, 128);
  let photo_url = String(body.photo_url || '').trim();
  if (!/^https:\/\//.test(photo_url)) photo_url = '';
  photo_url = photo_url.slice(0, 500);

  const db = await firestore();
  const snap = await db.collection('apps').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return c.json({ error: 'not_found' }, 404);
  const doc = snap.docs[0];

  const sFp = serverFingerprint(c);
  const voteHash = computeVoteHash(clientFp, sFp);
  // Also store a server-only hash to prevent same IP+UA from voting with different client FPs
  const serverOnlyHash = crypto.createHash('sha256').update(sFp).digest('hex');

  // Check for duplicate votes before writing.
  const votesRef = doc.ref.collection('star_votes');
  if (uid) {
    // Signed-in users: exactly one rating/review per account.
    const existingByUid = await votesRef.where('uid', '==', uid).limit(1).get();
    if (!existingByUid.empty) {
      return c.json({ error: 'already_voted', rating: ratingAverage(doc.data()), rating_count: Number((doc.data() as any).rating_count || 0) }, 409);
    }
  } else {
    // Anonymous fallback: dedupe by device fingerprint.
    const existingByHash = await votesRef.where('hash', '==', voteHash).limit(1).get();
    if (!existingByHash.empty) {
      return c.json({ error: 'already_voted', rating: ratingAverage(doc.data()), rating_count: Number((doc.data() as any).rating_count || 0) }, 409);
    }
    const existingByServer = await votesRef.where('server_hash', '==', serverOnlyHash).limit(1).get();
    if (!existingByServer.empty) {
      return c.json({ error: 'already_voted', rating: ratingAverage(doc.data()), rating_count: Number((doc.data() as any).rating_count || 0) }, 409);
    }
  }

  // Write the vote and update the running average atomically.
  await votesRef.add({
    hash: voteHash,
    server_hash: serverOnlyHash,
    uid: uid || null,
    rating,
    comment,
    name,
    photo_url: photo_url || null,
    ts: nowSec(),
  });
  const result = await db.runTransaction(async (tx: any) => {
    const fresh = await tx.get(doc.ref);
    const data = (fresh.data() || {}) as any;
    const newSum = Number(data.rating_sum || 0) + rating;
    const newCount = Number(data.rating_count || 0) + 1;
    const avg = Math.round((newSum / newCount) * 10) / 10;
    tx.update(doc.ref, {
      rating_sum: newSum,
      rating_count: newCount,
      rating: avg,
      stars: newCount,
    });
    return { rating: avg, rating_count: newCount };
  });

  const review = (comment || name)
    ? { name: name || 'مستخدم', rating, comment, photo_url: photo_url || null, ts: nowSec() }
    : null;
  return c.json({ ok: true, ...result, review });
});

app.post('/apps/:slug/star-check', async (c) => {
  const slug = c.req.param('slug');
  const body = await c.req.json().catch(() => ({} as any));
  const clientFp = String(body.fp || '').trim();
  const uid = String(body.uid || '').trim().slice(0, 128);
  if ((!clientFp || clientFp.length < 16) && !uid) {
    return c.json({ voted: false });
  }

  const db = await firestore();
  const snap = await db.collection('apps').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return c.json({ error: 'not_found' }, 404);
  const doc = snap.docs[0];

  const ratingAvg = ratingAverage(doc.data());
  const ratingCount = Number((doc.data() as any).rating_count || 0);
  const mine = (v: any) => c.json({
    voted: true,
    my_rating: Number(v.rating || 0),
    my_comment: v.comment || '',
    my_name: v.name || '',
    my_photo: v.photo_url || '',
    rating: ratingAvg,
    rating_count: ratingCount,
  });

  // Signed-in users are matched by account id first.
  if (uid) {
    const existingByUid = await doc.ref.collection('star_votes').where('uid', '==', uid).limit(1).get();
    if (!existingByUid.empty) return mine(existingByUid.docs[0].data());
    return c.json({ voted: false, rating: ratingAvg, rating_count: ratingCount });
  }

  const sFp = serverFingerprint(c);
  const voteHash = computeVoteHash(clientFp, sFp);
  const serverOnlyHash = crypto.createHash('sha256').update(sFp).digest('hex');
  const existingByHash = await doc.ref.collection('star_votes').where('hash', '==', voteHash).limit(1).get();
  if (!existingByHash.empty) return mine(existingByHash.docs[0].data());
  const existingByServer = await doc.ref.collection('star_votes').where('server_hash', '==', serverOnlyHash).limit(1).get();
  if (!existingByServer.empty) return mine(existingByServer.docs[0].data());
  return c.json({ voted: false, my_rating: 0, my_comment: '', my_name: '', my_photo: '', rating: ratingAvg, rating_count: ratingCount });
});

// List reviews (votes that include a written comment) + rating distribution.
app.get('/apps/:slug/reviews', async (c) => {
  const slug = c.req.param('slug');
  const limit = Math.min(Number(c.req.query('limit') || '50') || 50, 100);
  const db = await firestore();
  const snap = await db.collection('apps').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return c.json({ error: 'not_found' }, 404);
  const doc = snap.docs[0];

  const votesSnap = await doc.ref.collection('star_votes').get();
  const dist: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  const reviews: { name: string; rating: number; comment: string; photo_url: string | null; ts: number }[] = [];
  votesSnap.forEach((v: any) => {
    const d = v.data() as any;
    const r = Math.round(Number(d.rating) || 0);
    if (r >= 1 && r <= 5) dist[String(r)]++;
    const comment = String(d.comment || '').trim();
    if (comment) {
      const photo = String(d.photo_url || '').trim();
      reviews.push({
        name: String(d.name || '').trim() || 'مستخدم',
        rating: r,
        comment,
        photo_url: /^https:\/\//.test(photo) ? photo : null,
        ts: Number(d.ts || 0),
      });
    }
  });
  reviews.sort((a, b) => b.ts - a.ts);

  return c.json({
    reviews: reviews.slice(0, limit),
    total: reviews.length,
    dist,
    rating: ratingAverage(doc.data()),
    rating_count: Number((doc.data() as any).rating_count || 0),
  });
});

// ---------------- auth ----------------

function isSecureRequest(c: any): boolean {
  // Trust Vercel/CDN forwarded headers; fall back to URL scheme.
  const proto = c.req.header('x-forwarded-proto');
  if (proto) return proto.split(',')[0].trim() === 'https';
  try {
    return new URL(c.req.url).protocol === 'https:';
  } catch {
    return false;
  }
}

app.post('/login', async (c) => {
  const ip = getClientIp(c);
  // Rate limit: max 5 login attempts per IP per 5 minutes
  if (!rateLimit(ip, 'login', 5, 300)) {
    return c.json({ error: 'rate_limit_exceeded' }, 429);
  }

  const body = await c.req.json().catch(() => ({} as any));
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const username = String(body.username ?? adminUser);
  const password = String(body.password ?? '');
  const adminPass = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.JWT_SECRET || '';
  if (!adminPass || !secret) return c.json({ error: 'server_not_configured' }, 500);

  const userOk = constantTimeEqual(username, adminUser);
  const passOk = !!password && constantTimeEqual(password, adminPass);
  if (!userOk || !passOk) {
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  const token = signJwt({ sub: adminUser, role: 'admin' }, secret);
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureRequest(c),
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return c.json({ ok: true, user: { username: adminUser } });
});

app.post('/logout', (c) => {
  setCookie(c, COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecureRequest(c),
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
  });
  return c.json({ ok: true });
});

app.get('/me', (c) => {
  const token = getCookie(c, COOKIE_NAME);
  const secret = process.env.JWT_SECRET || '';
  if (!token || !secret) return c.json({ authenticated: false });
  const payload = verifyJwt(token, secret);
  if (!payload) return c.json({ authenticated: false });
  return c.json({ authenticated: true, user: { username: payload.sub, role: payload.role } });
});

// ---------------- admin ----------------

app.use('/admin/*', requireAdmin);

app.get('/admin/stats', async (c) => {
  const db = await firestore();
  const snap = await db.collection('apps').get();
  let totalDownloads = 0;
  let totalSize = 0;
  const apps: any[] = [];
  snap.forEach((d: any) => {
    const a = d.data() as App;
    totalDownloads += a.downloads || 0;
    totalSize += a.size_bytes || 0;
    apps.push({
      id: d.id,
      slug: a.slug,
      name: a.name,
      downloads: a.downloads || 0,
      icon_url: icon_url(a.icon_key),
    });
  });
  apps.sort((a, b) => b.downloads - a.downloads);
  return c.json({
    total_apps: snap.size,
    total_downloads: totalDownloads,
    total_size_bytes: totalSize,
    top_apps: apps.slice(0, 5),
  });
});

app.get('/admin/apps', async (c) => {
  const db = await firestore();
  const snap = await db.collection('apps').orderBy('created_at', 'desc').get();
  const apps = snap.docs.map((d: any) => {
    const a = appPublic(d, true);
    return { ...a, icon_url: icon_url(a.icon_key), feature_url: feature_url((a as any).feature_key) };
  });
  return c.json({ apps });
});

app.get('/admin/apps/:id', async (c) => {
  const id = c.req.param('id');
  const db = await firestore();
  const doc = await db.collection('apps').doc(id).get();
  if (!doc.exists) return c.json({ error: 'not_found' }, 404);
  const a = appPublic(doc, true);
  const ssSnap = await doc.ref.collection('screenshots').orderBy('position', 'asc').get();
  const screenshots = ssSnap.docs.map((s: any) => {
    const sd = s.data() as Screenshot;
    return { id: s.id, position: sd.position, r2_key: sd.r2_key, url: icon_url(sd.r2_key) };
  });
  return c.json({ app: { ...a, icon_url: icon_url(a.icon_key), feature_url: feature_url((a as any).feature_key) }, screenshots });
});

// Step 1: client requests a presigned upload URL for R2
app.post('/admin/upload-url', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const kind = String(body.kind || ''); // 'apk' | 'icon' | 'screenshot'
  const filename = String(body.filename || '');
  const contentType = String(body.content_type || 'application/octet-stream');
  const slugHint = slugify(String(body.slug_hint || 'app'));

  // Validate content-type to prevent serving malicious HTML/JS from R2
  const ALLOWED_CONTENT_TYPES: Record<string, string[]> = {
    apk: ['application/vnd.android.package-archive', 'application/octet-stream'],
    icon: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    screenshot: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    feature: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  };

  if (!['apk', 'icon', 'screenshot', 'feature'].includes(kind)) {
    return c.json({ error: 'invalid_kind' }, 400);
  }
  if (ALLOWED_CONTENT_TYPES[kind] && !ALLOWED_CONTENT_TYPES[kind].includes(contentType)) {
    return c.json({ error: 'invalid_content_type' }, 400);
  }
  const ext = safeExt(filename, kind === 'apk' ? 'apk' : kind === 'feature' ? 'jpg' : kind === 'icon' ? 'png' : 'jpg');
  const ts = Date.now();
  const rand = randomId().slice(0, 6);
  const folder = kind === 'apk' ? 'apk' : kind === 'icon' ? 'icon' : kind === 'feature' ? 'feature' : 'ss';
  const key = `${folder}/${slugHint}-${ts}-${rand}.${ext}`;
  const url = await r2PresignPut(key, contentType, 900);
  return c.json({ url, key });
});

// Validate that R2 keys match expected folder prefixes (prevent path traversal)
function isValidR2Key(key: string, expectedPrefix: string): boolean {
  if (!key || key.includes('..') || key.startsWith('/')) return false;
  return key.startsWith(`${expectedPrefix}/`);
}

// Step 2: after R2 upload, client posts metadata to create the app
app.post('/admin/apps', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const name = String(body.name || '').trim();
  const package_name = String(body.package_name || '').trim();
  const apk_key = String(body.apk_key || '').trim();
  if (!name || !package_name || !apk_key) {
    return c.json({ error: 'name_package_apk_required' }, 400);
  }
  // Input length limits to prevent abuse
  if (name.length > 200 || package_name.length > 200) {
    return c.json({ error: 'input_too_long' }, 400);
  }
  if (String(body.description || '').length > 10000 || String(body.short_description || '').length > 500) {
    return c.json({ error: 'input_too_long' }, 400);
  }
  if (!isValidR2Key(apk_key, 'apk')) {
    return c.json({ error: 'invalid_apk_key' }, 400);
  }
  if (body.icon_key && !isValidR2Key(String(body.icon_key), 'icon')) {
    return c.json({ error: 'invalid_icon_key' }, 400);
  }
  if (body.feature_key && !isValidR2Key(String(body.feature_key), 'feature')) {
    return c.json({ error: 'invalid_feature_key' }, 400);
  }

  // Verify the file exists in R2 to get size
  const head = await r2Head(apk_key);
  if (!head) return c.json({ error: 'apk_not_found_in_r2' }, 400);

  const base = slugify(name);
  const slug = await ensureUniqueSlug(base);
  const now = nowSec();

  const docData: App = {
    slug,
    name,
    name_lower: name.toLowerCase(),
    search_terms: searchTerms(name, body.developer, body.short_description, package_name),
    package_name,
    short_description: String(body.short_description || '').trim() || undefined,
    description: String(body.description || '').trim() || undefined,
    category: String(body.category || 'other'),
    type: String(body.type || 'app') === 'game' ? 'game' : 'app',
    developer: String(body.developer || '').trim() || undefined,
    version_name: String(body.version_name || '').trim() || undefined,
    version_code: body.version_code != null ? Number(body.version_code) : undefined,
    min_sdk: body.min_sdk != null ? Number(body.min_sdk) : undefined,
    size_bytes: head.size,
    apk_key,
    icon_key: body.icon_key ? String(body.icon_key) : undefined,
    feature_key: body.feature_key ? String(body.feature_key) : undefined,
    stars: 0,
    rating_sum: 0,
    rating_count: 0,
    rating: 0,
    downloads: 0,
    created_at: now,
    updated_at: now,
  };

  const db = await firestore();
  const ref = await db.collection('apps').add(docData);

  // Add screenshots if provided
  const screenshotKeys: string[] = Array.isArray(body.screenshot_keys) ? body.screenshot_keys.slice(0, 20) : [];
  for (let i = 0; i < screenshotKeys.length; i++) {
    const r2_key = String(screenshotKeys[i]);
    if (!r2_key || !isValidR2Key(r2_key, 'ss')) continue;
    await ref.collection('screenshots').add({
      app_id: ref.id,
      r2_key,
      position: i,
      created_at: now,
    } as Screenshot);
  }

  return c.json({ ok: true, id: ref.id, slug });
});

app.patch('/admin/apps/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({} as any));
  const db = await firestore();
  const ref = db.collection('apps').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return c.json({ error: 'not_found' }, 404);
  // Input length limits
  if (('name' in body && String(body.name).length > 200) ||
      ('package_name' in body && String(body.package_name).length > 200) ||
      ('description' in body && String(body.description).length > 10000) ||
      ('short_description' in body && String(body.short_description).length > 500)) {
    return c.json({ error: 'input_too_long' }, 400);
  }
  // Prevent admin from tampering with stars/downloads via PATCH
  const update: Partial<App> = { updated_at: nowSec() };
  if ('name' in body) {
    update.name = String(body.name);
    update.name_lower = update.name.toLowerCase();
  }
  if ('package_name' in body) update.package_name = String(body.package_name);
  if ('short_description' in body) update.short_description = String(body.short_description) || undefined;
  if ('description' in body) update.description = String(body.description) || undefined;
  if ('category' in body) update.category = String(body.category);
  if ('type' in body) update.type = String(body.type) === 'game' ? 'game' : 'app';
  if ('developer' in body) update.developer = String(body.developer) || undefined;
  if ('version_name' in body) update.version_name = String(body.version_name) || undefined;
  if ('version_code' in body) update.version_code = Number(body.version_code) || undefined;
  if ('min_sdk' in body) update.min_sdk = Number(body.min_sdk) || undefined;
  // Recompute search terms if relevant fields changed
  if ('name' in body || 'developer' in body || 'short_description' in body || 'package_name' in body) {
    const merged = { ...(snap.data() as App), ...update };
    update.search_terms = searchTerms(
      merged.name,
      merged.developer,
      merged.short_description,
      merged.package_name,
    );
  }

  await ref.update(update as any);
  return c.json({ ok: true });
});

// Replace APK
app.post('/admin/apps/:id/apk', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({} as any));
  const newKey = String(body.apk_key || '');
  if (!newKey) return c.json({ error: 'apk_key_required' }, 400);
  if (!isValidR2Key(newKey, 'apk')) return c.json({ error: 'invalid_apk_key' }, 400);
  const head = await r2Head(newKey);
  if (!head) return c.json({ error: 'apk_not_found' }, 400);

  const db = await firestore();
  const ref = db.collection('apps').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return c.json({ error: 'not_found' }, 404);
  const old = snap.data() as App;

  await ref.update({
    apk_key: newKey,
    size_bytes: head.size,
    version_name: body.version_name ? String(body.version_name) : old.version_name,
    version_code: body.version_code != null ? Number(body.version_code) : old.version_code,
    updated_at: nowSec(),
  });

  if (old.apk_key && old.apk_key !== newKey) {
    await r2Delete(old.apk_key).catch(() => {});
  }
  return c.json({ ok: true });
});

// Replace icon
app.post('/admin/apps/:id/icon', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({} as any));
  const newKey = String(body.icon_key || '');
  if (!newKey) return c.json({ error: 'icon_key_required' }, 400);
  if (!isValidR2Key(newKey, 'icon')) return c.json({ error: 'invalid_icon_key' }, 400);

  const db = await firestore();
  const ref = db.collection('apps').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return c.json({ error: 'not_found' }, 404);
  const old = snap.data() as App;

  await ref.update({ icon_key: newKey, updated_at: nowSec() });

  if (old.icon_key && old.icon_key !== newKey) {
    await r2Delete(old.icon_key).catch(() => {});
  }
  return c.json({ ok: true });
});

// Replace / set the wide feature graphic
app.post('/admin/apps/:id/feature', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({} as any));
  const newKey = String(body.feature_key || '');
  if (!newKey) return c.json({ error: 'feature_key_required' }, 400);
  if (!isValidR2Key(newKey, 'feature')) return c.json({ error: 'invalid_feature_key' }, 400);

  const db = await firestore();
  const ref = db.collection('apps').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return c.json({ error: 'not_found' }, 404);
  const old = snap.data() as App;

  await ref.update({ feature_key: newKey, updated_at: nowSec() });

  if (old.feature_key && old.feature_key !== newKey) {
    await r2Delete(old.feature_key).catch(() => {});
  }
  return c.json({ ok: true });
});

// Add screenshots
app.post('/admin/apps/:id/screenshots', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({} as any));
  const keys: string[] = Array.isArray(body.screenshot_keys) ? body.screenshot_keys.slice(0, 20) : [];
  if (keys.length === 0) return c.json({ error: 'no_screenshots' }, 400);

  const db = await firestore();
  const ref = db.collection('apps').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return c.json({ error: 'not_found' }, 404);

  const existing = await ref.collection('screenshots').get();
  let pos = existing.size;
  const now = nowSec();
  for (const k of keys) {
    if (!k || !isValidR2Key(String(k), 'ss')) continue;
    await ref.collection('screenshots').add({
      app_id: id,
      r2_key: String(k),
      position: pos++,
      created_at: now,
    });
  }
  await ref.update({ updated_at: now });
  return c.json({ ok: true, added: keys.length });
});

// Delete screenshot
app.delete('/admin/apps/:id/screenshots/:sid', async (c) => {
  const id = c.req.param('id');
  const sid = c.req.param('sid');
  const db = await firestore();
  const ssRef = db.collection('apps').doc(id).collection('screenshots').doc(sid);
  const snap = await ssRef.get();
  if (!snap.exists) return c.json({ error: 'not_found' }, 404);
  const ss = snap.data() as Screenshot;
  await ssRef.delete();
  if (ss.r2_key) await r2Delete(ss.r2_key).catch(() => {});
  return c.json({ ok: true });
});

// Delete app
app.delete('/admin/apps/:id', async (c) => {
  const id = c.req.param('id');
  const db = await firestore();
  const ref = db.collection('apps').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return c.json({ error: 'not_found' }, 404);
  const a = snap.data() as App;

  // Delete subcollection screenshots
  const ssSnap = await ref.collection('screenshots').get();
  for (const s of ssSnap.docs) {
    const sd = s.data() as Screenshot;
    if (sd.r2_key) await r2Delete(sd.r2_key).catch(() => {});
    await s.ref.delete();
  }
  if (a.apk_key) await r2Delete(a.apk_key).catch(() => {});
  if (a.icon_key) await r2Delete(a.icon_key).catch(() => {});
  if (a.feature_key) await r2Delete(a.feature_key).catch(() => {});
  await ref.delete();
  return c.json({ ok: true });
});

// 404 fallback
app.notFound((c) => c.json({ error: 'not_found' }, 404));
app.onError((err, c) => {
  console.error('[api error]', err);
  return c.json({ error: 'internal_error' }, 500);
});

export default getRequestListener(app.fetch);
