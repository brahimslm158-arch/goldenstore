import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import { handle } from 'hono/vercel';
import crypto from 'node:crypto';
import { firestore, FieldValue } from '../lib/firebase';
import {
  r2PresignPut,
  r2PresignGet,
  r2PublicUrl,
  r2Delete,
  r2Head,
} from '../lib/r2';
import {
  COOKIE_NAME,
  constantTimeEqual,
  signJwt,
  verifyJwt,
} from '../lib/auth';
import { nowSec, randomId, safeExt, searchTerms, slugify } from '../lib/utils';
import { DEFAULT_CATEGORIES, type App, type Category, type Screenshot } from '../lib/types';

export const config = { runtime: 'nodejs' };

const app = new Hono().basePath('/api');

app.use('*', cors({ origin: (o) => o ?? '*', credentials: true }));

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
    const snap = await firestore().collection('apps').where('slug', '==', slug).limit(1).get();
    if (snap.empty) return slug;
    i++;
    slug = `${base}-${i}`;
    if (i > 200) return `${base}-${randomId().slice(0, 6)}`;
  }
}

function appPublic(doc: FirebaseFirestore.DocumentSnapshot): App & { id: string } {
  const d = doc.data() as App;
  return {
    id: doc.id,
    slug: d.slug,
    name: d.name,
    name_lower: d.name_lower,
    search_terms: [],
    package_name: d.package_name,
    short_description: d.short_description,
    description: d.description,
    category: d.category,
    developer: d.developer,
    version_name: d.version_name,
    version_code: d.version_code,
    min_sdk: d.min_sdk,
    size_bytes: d.size_bytes,
    apk_key: d.apk_key,
    icon_key: d.icon_key,
    featured: !!d.featured,
    downloads: d.downloads || 0,
    created_at: d.created_at,
    updated_at: d.updated_at,
  };
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
  const snap = await firestore().collection('apps').select('category').get();
  const counts: Record<string, number> = {};
  snap.forEach((d) => {
    const cat = (d.data() as any).category || 'other';
    counts[cat] = (counts[cat] || 0) + 1;
  });
  const categories: Category[] = DEFAULT_CATEGORIES.map((c) => ({ ...c, count: counts[c.slug] || 0 }));
  return c.json({ categories });
});

app.get('/apps', async (c) => {
  const q = (c.req.query('q') || '').trim().toLowerCase();
  const category = (c.req.query('category') || '').trim();
  const sort = (c.req.query('sort') || 'recent').trim();
  const featuredOnly = c.req.query('featured') === '1';
  const limit = Math.min(Number(c.req.query('limit') || '24') || 24, 60);
  const offset = Math.max(Number(c.req.query('offset') || '0') || 0, 0);

  let query: FirebaseFirestore.Query = firestore().collection('apps');
  if (category) query = query.where('category', '==', category);
  if (featuredOnly) query = query.where('featured', '==', true);
  if (q) {
    const token = q.split(/\s+/).filter((w) => w.length >= 2)[0];
    if (token) query = query.where('search_terms', 'array-contains', token);
  }

  if (sort === 'popular') query = query.orderBy('downloads', 'desc');
  else if (sort === 'name') query = query.orderBy('name_lower', 'asc');
  else query = query.orderBy('created_at', 'desc');

  const total = (await query.count().get()).data().count;
  const snap = await query.limit(limit).offset(offset).get();
  const apps = snap.docs.map((d) => {
    const a = appPublic(d);
    return { ...a, icon_url: icon_url(a.icon_key) };
  });
  return c.json({ apps, total });
});

app.get('/apps/:slug', async (c) => {
  const slug = c.req.param('slug');
  const snap = await firestore().collection('apps').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return c.json({ error: 'not_found' }, 404);
  const doc = snap.docs[0];
  const ap = appPublic(doc);
  const ssSnap = await firestore()
    .collection('apps')
    .doc(doc.id)
    .collection('screenshots')
    .orderBy('position', 'asc')
    .get();
  const screenshots = ssSnap.docs.map((s) => {
    const sd = s.data() as Screenshot;
    return { id: s.id, position: sd.position, url: icon_url(sd.r2_key) };
  });
  return c.json({
    app: { ...ap, icon_url: icon_url(ap.icon_key) },
    screenshots,
  });
});

app.get('/apps/:slug/download', async (c) => {
  const slug = c.req.param('slug');
  const snap = await firestore().collection('apps').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return c.json({ error: 'not_found' }, 404);
  const doc = snap.docs[0];
  const a = doc.data() as App;
  if (!a.apk_key) return c.json({ error: 'apk_not_available' }, 404);
  await doc.ref.update({ downloads: FieldValue.increment(1) });
  const filename = `${a.slug || 'app'}-${a.version_name || ''}.apk`.replace(/-+/g, '-');
  const url = await r2PresignGet(a.apk_key, 300);
  return c.redirect(`${url}&response-content-disposition=${encodeURIComponent(
    `attachment; filename="${filename}"`,
  )}`);
});

// ---------------- auth ----------------

app.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const username = String(body.username || '');
  const password = String(body.password || '');
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.JWT_SECRET || '';
  if (!adminPass || !secret) return c.json({ error: 'server_not_configured' }, 500);
  if (!constantTimeEqual(username, adminUser) || !constantTimeEqual(password, adminPass)) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }
  const token = signJwt({ sub: adminUser, role: 'admin' }, secret);
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return c.json({ ok: true, user: { username: adminUser } });
});

app.post('/logout', (c) => {
  setCookie(c, COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
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
  const snap = await firestore().collection('apps').get();
  let totalDownloads = 0;
  let totalSize = 0;
  const apps: any[] = [];
  snap.forEach((d) => {
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
  const snap = await firestore().collection('apps').orderBy('created_at', 'desc').get();
  const apps = snap.docs.map((d) => {
    const a = appPublic(d);
    return { ...a, icon_url: icon_url(a.icon_key) };
  });
  return c.json({ apps });
});

app.get('/admin/apps/:id', async (c) => {
  const id = c.req.param('id');
  const doc = await firestore().collection('apps').doc(id).get();
  if (!doc.exists) return c.json({ error: 'not_found' }, 404);
  const a = appPublic(doc);
  const ssSnap = await doc.ref.collection('screenshots').orderBy('position', 'asc').get();
  const screenshots = ssSnap.docs.map((s) => {
    const sd = s.data() as Screenshot;
    return { id: s.id, position: sd.position, r2_key: sd.r2_key, url: icon_url(sd.r2_key) };
  });
  return c.json({ app: { ...a, icon_url: icon_url(a.icon_key) }, screenshots });
});

// Step 1: client requests a presigned upload URL for R2
app.post('/admin/upload-url', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const kind = String(body.kind || ''); // 'apk' | 'icon' | 'screenshot'
  const filename = String(body.filename || '');
  const contentType = String(body.content_type || 'application/octet-stream');
  const slugHint = slugify(String(body.slug_hint || 'app'));

  if (!['apk', 'icon', 'screenshot'].includes(kind)) {
    return c.json({ error: 'invalid_kind' }, 400);
  }
  const ext = safeExt(filename, kind === 'apk' ? 'apk' : kind === 'icon' ? 'png' : 'jpg');
  const ts = Date.now();
  const rand = randomId().slice(0, 6);
  const folder = kind === 'apk' ? 'apk' : kind === 'icon' ? 'icon' : 'ss';
  const key = `${folder}/${slugHint}-${ts}-${rand}.${ext}`;
  const url = await r2PresignPut(key, contentType, 900);
  return c.json({ url, key });
});

// Step 2: after R2 upload, client posts metadata to create the app
app.post('/admin/apps', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const name = String(body.name || '').trim();
  const package_name = String(body.package_name || '').trim();
  const apk_key = String(body.apk_key || '').trim();
  if (!name || !package_name || !apk_key) {
    return c.json({ error: 'name_package_apk_required' }, 400);
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
    developer: String(body.developer || '').trim() || undefined,
    version_name: String(body.version_name || '').trim() || undefined,
    version_code: body.version_code != null ? Number(body.version_code) : undefined,
    min_sdk: body.min_sdk != null ? Number(body.min_sdk) : undefined,
    size_bytes: head.size,
    apk_key,
    icon_key: body.icon_key ? String(body.icon_key) : undefined,
    featured: !!body.featured,
    downloads: 0,
    created_at: now,
    updated_at: now,
  };

  const ref = await firestore().collection('apps').add(docData);

  // Add screenshots if provided
  const screenshotKeys: string[] = Array.isArray(body.screenshot_keys) ? body.screenshot_keys : [];
  for (let i = 0; i < screenshotKeys.length; i++) {
    const r2_key = String(screenshotKeys[i]);
    if (!r2_key) continue;
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
  const ref = firestore().collection('apps').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return c.json({ error: 'not_found' }, 404);
  const update: Partial<App> = { updated_at: nowSec() };
  if ('name' in body) {
    update.name = String(body.name);
    update.name_lower = update.name.toLowerCase();
  }
  if ('package_name' in body) update.package_name = String(body.package_name);
  if ('short_description' in body) update.short_description = String(body.short_description) || undefined;
  if ('description' in body) update.description = String(body.description) || undefined;
  if ('category' in body) update.category = String(body.category);
  if ('developer' in body) update.developer = String(body.developer) || undefined;
  if ('version_name' in body) update.version_name = String(body.version_name) || undefined;
  if ('version_code' in body) update.version_code = Number(body.version_code) || undefined;
  if ('min_sdk' in body) update.min_sdk = Number(body.min_sdk) || undefined;
  if ('featured' in body) update.featured = !!body.featured;

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
  const head = await r2Head(newKey);
  if (!head) return c.json({ error: 'apk_not_found' }, 400);

  const ref = firestore().collection('apps').doc(id);
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

  const ref = firestore().collection('apps').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return c.json({ error: 'not_found' }, 404);
  const old = snap.data() as App;

  await ref.update({ icon_key: newKey, updated_at: nowSec() });

  if (old.icon_key && old.icon_key !== newKey) {
    await r2Delete(old.icon_key).catch(() => {});
  }
  return c.json({ ok: true });
});

// Add screenshots
app.post('/admin/apps/:id/screenshots', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({} as any));
  const keys: string[] = Array.isArray(body.screenshot_keys) ? body.screenshot_keys : [];
  if (keys.length === 0) return c.json({ error: 'no_screenshots' }, 400);

  const ref = firestore().collection('apps').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return c.json({ error: 'not_found' }, 404);

  const existing = await ref.collection('screenshots').get();
  let pos = existing.size;
  const now = nowSec();
  for (const k of keys) {
    if (!k) continue;
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
  const ssRef = firestore().collection('apps').doc(id).collection('screenshots').doc(sid);
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
  const ref = firestore().collection('apps').doc(id);
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
  await ref.delete();
  return c.json({ ok: true });
});

// 404 fallback
app.notFound((c) => c.json({ error: 'not_found' }, 404));
app.onError((err, c) => {
  console.error('[api error]', err);
  return c.json({ error: 'internal_error', message: err.message }, 500);
});

export default handle(app);
