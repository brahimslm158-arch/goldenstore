// Golden Store — shared frontend helpers, auth gate, and UI chrome.
// Exposed as window.Store. Public store pages use this (admin keeps common.js).

const STORE = { name: 'Golden Store', domain: 'goldenstore.me' };

/* ----------------------------- Theme (light/dark) ----------------------------- */
const THEME_KEY = 'gs_theme';
function currentTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}
function applyTheme(theme) {
  const th = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', th);
  try { localStorage.setItem(THEME_KEY, th); } catch {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', th === 'light' ? '#ffffff' : '#0d0d0f');
  document.querySelectorAll('.theme-toggle').forEach((b) => syncThemeBtn(b, th));
}
function toggleTheme() { applyTheme(currentTheme() === 'light' ? 'dark' : 'light'); }
function syncThemeBtn(btn, th) {
  btn.innerHTML = '';
  btn.append(ico(th === 'light' ? 'moon' : 'sun', 'icon'));
  btn.setAttribute('aria-label', th === 'light' ? t('الوضع الغامق') : t('الوضع الفاتح'));
  btn.setAttribute('title', th === 'light' ? t('الوضع الغامق') : t('الوضع الفاتح'));
}
function themeToggleBtn() {
  const btn = el('button', { class: 'icon-btn theme-toggle', type: 'button', onclick: toggleTheme });
  syncThemeBtn(btn, currentTheme());
  return btn;
}
function langSwitcherEl() {
  try { if (window.GSI18N && window.GSI18N.switcherEl) return window.GSI18N.switcherEl(); } catch (e) {}
  return document.createComment('lang');
}
// Apply persisted theme as early as possible.
applyTheme(currentTheme());

/* ----------------------------- API ----------------------------- */
async function api(path, opts = {}) {
  const ctrl = new AbortController();
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 15000;
  const timer = timeoutMs > 0 ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let res;
  try {
    res = await fetch(path, {
      credentials: 'include',
      headers: opts.body && !(opts.body instanceof FormData) && typeof opts.body !== 'string'
        ? { 'Content-Type': 'application/json' }
        : opts.headers || {},
      ...opts,
      signal: opts.signal || ctrl.signal,
      body: opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)
        ? JSON.stringify(opts.body)
        : opts.body,
    });
  } catch (e) {
    if (timer) clearTimeout(timer);
    const err = new Error(e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || 'network_error');
    err.status = 0;
    throw err;
  }
  if (timer) clearTimeout(timer);
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText || 'error');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/* --------------------------- DOM helper --------------------------- */
function el(tag, attrs = null, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v);
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) c.forEach((x) => x && node.append(x.nodeType ? x : document.createTextNode(String(x))));
    else if (c.nodeType) node.append(c);
    else node.append(document.createTextNode(String(c)));
  }
  return node;
}

function ico(name, extra = 'icon') { return window.GSIcons.iconEl(name, extra); }
function t(s) { try { return window.GSI18N.t(s); } catch { return s; } }

/* --------------------------- Formatters --------------------------- */
function i18nUnits(kind) {
  try { const u = window.GSI18N && window.GSI18N.units(kind); if (u && u.length) return u; } catch (e) {}
  return kind === 'count' ? ['', 'ألف', 'مليون', 'مليار'] : ['ب', 'ك.ب', 'م.ب', 'ج.ب'];
}
function formatBytes(bytes) {
  const units = i18nUnits('bytes');
  if (!bytes) return `0 ${units[0]}`;
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
function formatCount(n) {
  n = Number(n || 0);
  const u = i18nUnits('count');
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + ' ' + u[3];
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' ' + u[2];
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + ' ' + u[1];
  return String(n);
}
function formatNum(n) { return Number(n || 0).toLocaleString('en-US'); }
function formatDate(ts) {
  if (!ts) return '—';
  const lang = (window.GSI18N && window.GSI18N.lang) || 'ar';
  return new Date(ts * 1000).toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric', numberingSystem: 'latn' });
}

// Real rating helpers — based on actual user votes from the backend.
// rating = average (0–5), rating_count/stars = number of ratings.
function ratingCountOf(app) {
  return Number((app && (app.rating_count != null ? app.rating_count : app.stars)) || 0);
}
function ratingValue(app) {
  return Number((app && app.rating) || 0);
}
// Formatted average for display, or null when the app has no ratings yet.
function ratingOf(app) {
  if (ratingCountOf(app) <= 0) return null;
  return ratingValue(app).toFixed(1);
}

function getQuery(name) { return new URLSearchParams(location.search).get(name) || ''; }

function toast(msg, type = 'info', ms = 3000) {
  let stack = document.querySelector('.toast-stack');
  if (!stack) { stack = el('div', { class: 'toast-stack' }); document.body.append(stack); }
  const t = el('div', { class: `toast ${type}` }, msg);
  stack.append(t);
  setTimeout(() => {
    t.style.transition = 'opacity .2s, transform .2s';
    t.style.opacity = '0'; t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 200);
  }, ms);
}

/* ----------------------------- Cards ----------------------------- */
// Square poster card (horizontal rows)
function posterCard(a) {
  const rt = ratingOf(a);
  return el('a', { href: `/app?slug=${encodeURIComponent(a.slug)}`, class: 'poster' },
    el('div', { class: 'art' }, a.icon_url ? el('img', { src: a.icon_url, alt: a.name, loading: 'lazy' }) : ico('package', 'icon icon-lg')),
    el('div', { class: 'nm' }, a.name),
    rt
      ? el('div', { class: 'rt' }, el('span', null, rt), ico('star', 'icon fill'))
      : el('div', { class: 'rt' }, el('span', null, t('جديد'))),
  );
}

// Full-width list row (recommended / search results)
function listRow(a, opts = {}) {
  const cat = categoryName(a.category);
  const rt = ratingOf(a);
  return el('a', { href: `/app?slug=${encodeURIComponent(a.slug)}`, class: 'approw' },
    el('div', { class: 'art' }, a.icon_url ? el('img', { src: a.icon_url, alt: a.name, loading: 'lazy' }) : ico('package', 'icon icon-lg')),
    el('div', { class: 'info' },
      el('div', { class: 'nm' }, a.name),
      el('div', { class: 'sub' }, a.developer || cat || STORE.name),
      el('div', { class: 'meta-line' },
        rt ? el('span', null, rt) : el('span', null, t('جديد')),
        rt ? ico('star', 'icon fill') : null,
        el('span', null, '•'),
        el('span', null, formatBytes(a.size_bytes || 0)),
      ),
    ),
    opts.installed ? el('span', { class: 'badge' }, ico('check', 'icon icon-sm'), t('مثبّت')) : null,
  );
}

// Curved, auto-advancing "editors' choice" carousel built from feature graphics.
// Slides glide to the left every few seconds and can be paused on hover / picked via dots.
function featureSlide(a) {
  const slide = el('a', { href: `/app?slug=${encodeURIComponent(a.slug)}`, class: 'fc-slide' });
  const media = el('div', { class: 'fc-media' });
  if (a.feature_url) {
    media.style.backgroundImage = `url("${a.feature_url}")`;
  } else {
    media.classList.add('fc-media-fallback');
    media.append(a.icon_url
      ? el('img', { class: 'fc-fallback-ico', src: a.icon_url, alt: '', loading: 'lazy' })
      : ico('package', 'icon icon-lg'));
  }
  const rt = ratingOf(a);
  slide.append(
    media,
    el('div', { class: 'fc-pill' }, ico('award', 'icon icon-sm'), t('اختيارات المحرّرين')),
    el('div', { class: 'fc-body', dir: 'rtl' },
      el('h3', null, a.name),
      el('p', null, a.short_description || a.developer || t('تطبيق مميّز مختار لك')),
      el('div', { class: 'fc-cta' },
        el('span', { class: 'btn btn-primary' }, t('عرض')),
        rt ? el('span', { class: 'fc-rate' }, ico('star', 'icon fill'), rt) : null,
      ),
    ),
  );
  return slide;
}

function featureCarousel(apps, opts = {}) {
  const list = (apps || []).filter(Boolean).slice(0, opts.max || 8);
  if (!list.length) return el('span');

  const track = el('div', { class: 'fc-track' });
  list.forEach((a) => track.append(featureSlide(a)));

  const dots = el('div', { class: 'fc-dots' });
  list.forEach((_, i) => dots.append(el('button', {
    class: `fc-dot ${i === 0 ? 'on' : ''}`, type: 'button',
    'aria-label': `${t('شريحة')} ${i + 1}`, onclick: (e) => { e.preventDefault(); go(i, true); },
  })));

  const wrap = el('div', { class: 'feature-carousel' }, track, list.length > 1 ? dots : null);

  let idx = 0;
  let timer = null;
  function paint() {
    track.style.transform = `translateX(${-idx * 100}%)`;
    Array.from(dots.children).forEach((d, i) => d.classList.toggle('on', i === idx));
  }
  function go(i, manual) { idx = (i + list.length) % list.length; paint(); if (manual) restart(); }
  function restart() {
    if (timer) clearInterval(timer);
    if (list.length > 1) timer = setInterval(() => go(idx + 1), opts.interval || 4500);
  }
  wrap.addEventListener('mouseenter', () => { if (timer) clearInterval(timer); });
  wrap.addEventListener('mouseleave', restart);
  paint();
  restart();
  return wrap;
}

const CAT_NAMES = {
  // App categories
  social: 'تواصل اجتماعي', communication: 'اتصالات', tools: 'أدوات', productivity: 'إنتاجية',
  entertainment: 'ترفيه', education: 'تعليم', photography: 'تصوير', music: 'موسيقى وصوتيات',
  video_players: 'مشغّلات فيديو', finance: 'مالية', shopping: 'تسوق', news: 'أخبار ومجلات',
  health: 'صحة ولياقة', travel: 'سفر ومحلّي', food: 'طعام وشراب', lifestyle: 'أسلوب حياة',
  books: 'كتب ومراجع', business: 'أعمال', dating: 'تعارف', maps: 'خرائط وملاحة',
  medical: 'طبّي', personalization: 'تخصيص', sports: 'رياضة', weather: 'طقس',
  auto: 'سيارات ومركبات', beauty: 'جمال وتجميل', art_design: 'فنّ وتصميم',
  house_home: 'منزل', parenting: 'أبوّة وأمومة', events: 'فعاليات', comics: 'قصص مصوّرة',
  other: 'أخرى',
  // Game categories
  game_action: 'أكشن', game_adventure: 'مغامرات', game_arcade: 'أركيد', game_board: 'ألعاب لوحية',
  game_card: 'ورق (كوتشينة)', game_casino: 'كازينو', game_casual: 'عادية', game_educational: 'تعليمية',
  game_music: 'موسيقى', game_puzzle: 'ألغاز', game_racing: 'سباقات', game_rpg: 'تقمّص أدوار',
  game_simulation: 'محاكاة', game_sports: 'رياضية', game_strategy: 'استراتيجية',
  game_trivia: 'معلومات عامة', game_word: 'كلمات', game_other: 'ألعاب أخرى',
  // Legacy
  games: 'ألعاب',
};
function categoryName(slug) { return t(CAT_NAMES[slug] || ''); }

/* -------------------------- States UI -------------------------- */
function spinner() { return el('div', { class: 'center' }, el('div', { class: 'spinner' })); }

// --- Skeleton loaders ---
function skEl(w, h, cls = '') {
  return el('div', { class: `sk ${cls}`, style: { width: w, height: h, flexShrink: '0' } });
}
function skeletonHome() {
  const wrap = el('div', { class: 'sk-section' });
  // Hero skeleton
  wrap.append(el('div', { class: 'sk-card', style: { width: '100%', height: '180px', marginBottom: '20px' } }));
  // Section title
  wrap.append(skEl('35%', '18px'));
  // Poster row
  const row = el('div', { class: 'sk-hrow', style: { marginTop: '12px' } });
  for (let i = 0; i < 4; i++) {
    const p = el('div', { class: 'sk-poster' });
    p.append(el('div', { class: 'sk-card', style: { width: '100px', height: '100px', borderRadius: '20px' } }));
    p.append(skEl('80px', '10px'));
    p.append(skEl('50px', '8px'));
    row.append(p);
  }
  wrap.append(row);
  // List section
  wrap.append(skEl('30%', '18px', ''), el('div', { style: { height: '16px' } }));
  for (let i = 0; i < 4; i++) {
    const r = el('div', { class: 'sk-row' });
    r.append(skEl('48px', '48px', 'sk-circle'));
    const info = el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '6px' } });
    info.append(skEl('60%', '12px'));
    info.append(skEl('40%', '10px'));
    r.append(info);
    wrap.append(r);
  }
  return wrap;
}
function skeletonDetail() {
  const wrap = el('div');
  const hdr = el('div', { class: 'sk-detail-header' });
  hdr.append(skEl('80px', '80px', '', ''));
  const hInfo = el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' } });
  hInfo.append(skEl('70%', '18px'));
  hInfo.append(skEl('40%', '14px'));
  hInfo.append(skEl('30%', '12px'));
  hdr.append(hInfo);
  wrap.append(hdr);
  // Button skeleton
  const body = el('div', { class: 'sk-detail-body' });
  body.append(skEl('100%', '44px', ''));
  // Stats row
  const stats = el('div', { style: { display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '8px' } });
  for (let i = 0; i < 3; i++) {
    const s = el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' } });
    s.append(skEl('40px', '16px'));
    s.append(skEl('50px', '10px'));
    stats.append(s);
  }
  body.append(stats);
  // Screenshots
  const scrRow = el('div', { style: { display: 'flex', gap: '10px', overflow: 'hidden', marginTop: '12px' } });
  for (let i = 0; i < 3; i++) scrRow.append(el('div', { class: 'sk-card', style: { width: '140px', height: '250px', flexShrink: '0', borderRadius: '12px' } }));
  body.append(scrRow);
  // Description
  body.append(skEl('50%', '16px'));
  body.append(skEl('100%', '12px'));
  body.append(skEl('90%', '12px'));
  body.append(skEl('75%', '12px'));
  wrap.append(body);
  return wrap;
}
function skeletonList() {
  const wrap = el('div', { class: 'sk-list-section' });
  for (let i = 0; i < 6; i++) {
    const r = el('div', { class: 'sk-row' });
    r.append(skEl('48px', '48px', 'sk-circle'));
    const info = el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '6px' } });
    info.append(skEl('65%', '13px'));
    info.append(skEl('35%', '10px'));
    r.append(info);
    wrap.append(r);
  }
  return wrap;
}
function emptyState(title, hint, icon = 'package') {
  return el('div', { class: 'empty' }, ico(icon, 'icon'), el('h3', null, title), hint ? el('p', null, hint) : null);
}
function errorState(err) {
  if (err && (err.status === 0 || err.message === 'timeout'))
    return emptyState(t('تعذّر الاتصال بالخادم'), t('تحقّق من اتصالك بالإنترنت ثمّ حدّث الصفحة.'), 'globe');
  if (err && err.status >= 500)
    return emptyState(t('الخدمة غير متاحة مؤقتاً'), t('حاول لاحقاً بعد دقائق قليلة.'), 'info');
  return emptyState(t('تعذّر تحميل البيانات'), t('حدّث الصفحة وحاول مجدداً.'), 'info');
}

/* ----------------------------- Chrome ----------------------------- */
function avatarEl(user) {
  const a = el('a', { href: '/account', class: 'avatar', 'aria-label': t('حسابك') });
  if (user && user.photoURL) a.append(el('img', { src: user.photoURL, alt: '', referrerpolicy: 'no-referrer' }));
  else a.append(document.createTextNode(initials(user)));
  return a;
}
function initials(user) {
  const n = (user && (user.displayName || user.email)) || '?';
  return n.trim().charAt(0).toUpperCase();
}

// Google Play–style home header: brand logo (start), user avatar (end).
function topbarSearch(user) {
  return el('div', { class: 'topbar' },
    el('div', { class: 'topbar-home' },
      el('a', { href: '/', class: 'brand', 'aria-label': 'Golden Store' }, el('img', { src: '/images/logo.png', alt: 'Golden Store' })),
      el('div', { class: 'tb-spacer' }),
      langSwitcherEl(),
      themeToggleBtn(),
      avatarEl(user),
    ),
  );
}

// Back/title top bar (detail)
function topbarNav(title = '', actions = []) {
  return el('div', { class: 'topbar-nav' },
    el('button', { class: 'icon-btn', 'aria-label': t('رجوع'), onclick: () => history.length > 1 ? history.back() : (location.href = '/') }, ico('chevronEnd')),
    title ? el('div', { class: 'title' }, title) : el('div', { class: 'spacer' }),
    ...actions,
    langSwitcherEl(),
    themeToggleBtn(),
  );
}

const NAV_ITEMS_RAW = [
  { key: 'apps', label: 'التطبيقات', icon: 'apps', href: '/' },
  { key: 'games', label: 'الألعاب', icon: 'gamepad', href: '/games' },
  { key: 'search', label: 'بحث', icon: 'search', href: '/search' },
  { key: 'featured', label: 'المميّزة', icon: 'award', href: '/featured' },
  { key: 'account', label: 'أنت', icon: 'user', href: '/account' },
];
function bottomNav(active) {
  const nav = el('nav', { class: 'bottomnav' },
    el('div', { class: 'bottomnav-inner' },
      ...NAV_ITEMS_RAW.map((it) => el('a', { href: it.href, class: `navitem ${it.key === active ? 'active' : ''}` },
        el('span', { class: 'pill-ico' }, ico(it.icon, it.key === active ? 'icon fill' : 'icon')),
        el('span', null, t(it.label)),
      )),
    ),
  );
  document.body.append(nav);
}

/* --------------------------- Auth gate --------------------------- */
const GOOGLE_G = '<svg class="gico" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

let _user = null;
let _ready = [];
let _gateEl = null;
let _chromeDone = false;

function devUser() {
  return { displayName: 'مستخدم تجريبي', email: 'demo@goldenstore.me', photoURL: null, uid: 'dev' };
}
function isLocalhost() {
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(location.hostname);
}

// Cache the last signed-in user so navigation between pages renders instantly
// (no login-screen flash) while Firebase re-validates the session in the background.
const CACHE_KEY = 'gs_user';
function cacheUser(user) {
  try {
    if (user) localStorage.setItem(CACHE_KEY, JSON.stringify({
      displayName: user.displayName || '', email: user.email || '', photoURL: user.photoURL || '', uid: user.uid || '',
    }));
    else localStorage.removeItem(CACHE_KEY);
  } catch {}
}
function cachedUser() {
  try { const v = localStorage.getItem(CACHE_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}

function authErrorMessage(e) {
  const code = (e && e.code) || '';
  switch (code) {
    case 'auth/unauthorized-domain':
      return `هذا النطاق (${location.hostname}) غير مُصرَّح به في Firebase. أضِفه في Authentication ← Settings ← Authorized domains.`;
    case 'auth/operation-not-allowed':
      return 'مزوّد Google غير مُفعَّل. فعّله في Firebase ← Authentication ← Sign-in method.';
    case 'auth/network-request-failed':
      return 'تعذّر الاتصال بالشبكة. تحقّق من الإنترنت وحاول مجدداً.';
    case 'auth/popup-blocked':
      return 'المتصفّح حظر النافذة المنبثقة. اسمح بالنوافذ المنبثقة ثم حاول مجدداً.';
    default:
      return `تعذّر تسجيل الدخول${code ? ' (' + code + ')' : ''}. حاول مجدداً.`;
  }
}

function buildGate(loading) {
  const errBox = el('div', { class: 'gate-error hidden' });
  const btn = el('button', { class: 'gbtn', html: GOOGLE_G });
  btn.append(document.createTextNode(' ' + t('متابعة باستخدام Google')));
  btn.addEventListener('click', async () => {
    errBox.classList.add('hidden');
    btn.disabled = true;
    btn.lastChild && (btn.lastChild.textContent = ' ' + t('جارٍ تسجيل الدخول…'));
    try {
      await window.GAuth.signInWithGoogle();
    } catch (e) {
      console.error('signIn', e && e.code, e && e.message);
      const msg = authErrorMessage(e);
      errBox.textContent = msg;
      errBox.classList.remove('hidden');
      toast(msg, 'error', 6000);
      btn.disabled = false;
      btn.lastChild && (btn.lastChild.textContent = ' ' + t('متابعة باستخدام Google'));
    }
  });
  return el('div', { class: 'gate' },
    el('div', { class: 'logo' }, el('img', { src: '/images/logo.png', alt: 'Golden Store' })),
    el('h1', null, 'Golden', el('b', null, 'Store')),
    el('p', null, t('سجّل الدخول بحساب Google للوصول إلى المتجر وتنزيل التطبيقات.')),
    loading ? el('div', { class: 'gate-spinner' }, el('div', { class: 'spinner' })) : btn,
    errBox,
    el('div', { class: 'terms' }, t('بالمتابعة فإنك توافق على شروط الاستخدام وسياسة الخصوصية لـ Golden Store.')),
  );
}

function showGate(loading) {
  if (_gateEl) _gateEl.remove();
  _gateEl = buildGate(loading);
  document.body.append(_gateEl);
}
function hideGate() { if (_gateEl) { _gateEl.remove(); _gateEl = null; } }

function onAuthed(user) {
  const firstRender = !_user;
  _user = user;
  hideGate();
  document.body.style.overflow = '';
  if (firstRender) {
    _ready.forEach((fn) => { try { fn(user); } catch (e) { console.error(e); } });
    _ready = [];
  }
}

function ready(fn) {
  if (_user) { try { fn(_user); } catch (e) { console.error(e); } }
  else _ready.push(fn);
}

function initAuth() {
  // Localhost-only preview bypass (never active in production).
  if (isLocalhost() && getQuery('devskip') === '1') { onAuthed(devUser()); return; }

  // Optimistic render: if the user signed in before, show the store immediately
  // and let Firebase confirm the session in the background (avoids login flash).
  const cached = cachedUser();
  if (cached) onAuthed(cached);
  else { document.body.style.overflow = 'hidden'; showGate(true); }

  try { window.GAuth.init(); } catch {}
  window.GAuth.onAuthChange((user) => {
    if (user) {
      cacheUser(user);
      onAuthed(user); // refresh user object (e.g. avatar) without re-rendering page
    } else {
      // No valid session: clear any stale cache and require sign-in.
      cacheUser(null);
      _user = null;
      showGate(false);
      document.body.style.overflow = 'hidden';
    }
  });
}

async function signOut() {
  cacheUser(null);
  try { await window.GAuth.signOut(); } catch {}
  location.href = '/';
}

/* ----------------------------- Boot ----------------------------- */
function boot() { initAuth(); }

/* ----------------------------- Download History ----------------------------- */
const DL_HISTORY_KEY = 'gs_downloads';
function getDownloadHistory() {
  try { return JSON.parse(localStorage.getItem(DL_HISTORY_KEY) || '[]'); } catch { return []; }
}
function addToDownloadHistory(app) {
  try {
    const list = getDownloadHistory();
    // Remove existing entry for same slug to avoid duplicates
    const filtered = list.filter((e) => e.slug !== app.slug);
    filtered.unshift({
      slug: app.slug,
      name: app.name,
      icon_url: app.icon_url || null,
      developer: app.developer || '',
      size_bytes: app.size_bytes || 0,
      downloaded_at: Math.floor(Date.now() / 1000),
    });
    // Keep max 200 entries
    localStorage.setItem(DL_HISTORY_KEY, JSON.stringify(filtered.slice(0, 200)));
  } catch {}
}
function clearDownloadHistory() {
  try { localStorage.removeItem(DL_HISTORY_KEY); } catch {}
}

window.Store = {
  STORE, api, el, ico, t,
  formatBytes, formatCount, formatNum, formatDate, ratingOf, ratingValue, ratingCountOf, getQuery, toast,
  posterCard, listRow, featureCarousel, categoryName,
  spinner, skeletonHome, skeletonDetail, skeletonList, emptyState, errorState,
  topbarSearch, topbarNav, bottomNav, avatarEl, themeToggleBtn, langSwitcherEl, toggleTheme, currentTheme,
  ready, signOut, getUser: () => _user,
  getDownloadHistory, addToDownloadHistory, clearDownloadHistory,
};

document.addEventListener('DOMContentLoaded', boot);
