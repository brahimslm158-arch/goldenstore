// Common helpers exposed via window.GS

const STORE = { name: 'Goldenstore', domain: 'goldenstore.me' };

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
      body: opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData) && !(opts.body instanceof Blob)
        ? JSON.stringify(opts.body)
        : opts.body,
    });
  } catch (e) {
    if (timer) clearTimeout(timer);
    const err = new Error(e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || 'network_error');
    err.status = 0;
    err.cause = e;
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

function formatBytes(bytes) {
  if (!bytes) return '0 ب';
  const units = ['ب', 'ك.ب', 'م.ب', 'ج.ب'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatNum(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric', numberingSystem: 'latn' });
}

function getQuery(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

function setQuery(params, replace = false) {
  const url = new URL(location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '' || v === false) url.searchParams.delete(k);
    else url.searchParams.set(k, String(v));
  }
  if (replace) history.replaceState(null, '', url.toString());
  else history.pushState(null, '', url.toString());
}

function toast(msg, type = 'info', ms = 3500) {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = el('div', { class: 'toast-stack' });
    document.body.append(stack);
  }
  const t = el('div', { class: `toast ${type}` }, msg);
  stack.append(t);
  setTimeout(() => {
    t.style.transition = 'opacity 0.2s, transform 0.2s';
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 200);
  }, ms);
}

function ico(name, extra = 'icon') {
  return window.GSIcons.iconEl(name, extra);
}

// --- Adsterra Ad helpers ---
// Set your Adsterra ad keys here after creating ad units at adsterra.com
const ADSTERRA = {
  banner_top:    '',  // Banner 728x90 or responsive
  banner_mid:    '',  // Banner 468x60 or native
  native_feed:   '',  // Native Banner key
  banner_bottom: '',  // Banner 300x250 or responsive
};

function adBanner(key) {
  if (!key) return el('div');
  const wrap = el('div', { class: 'ad-container ad-banner' });
  const s = document.createElement('script');
  s.async = true;
  s.setAttribute('data-cfasync', 'false');
  s.src = `//www.highperformanceformat.com/${key}/invoke.js`;
  const d = el('div', { id: `adsterra-${key}` });
  wrap.appendChild(d);
  wrap.appendChild(s);
  return wrap;
}

function adNative(key) {
  if (!key) return el('div');
  const wrap = el('div', { class: 'ad-container ad-native' });
  const s = document.createElement('script');
  s.async = true;
  s.setAttribute('data-cfasync', 'false');
  s.src = `//pl.aibnserv.com/${key}/invoke.js`;
  wrap.appendChild(s);
  return wrap;
}

function adInFeed(key) {
  if (!key) return el('div');
  const wrap = el('div', { class: 'ad-container ad-in-feed' });
  const s = document.createElement('script');
  s.async = true;
  s.setAttribute('data-cfasync', 'false');
  s.src = `//pl.aibnserv.com/${key}/invoke.js`;
  wrap.appendChild(s);
  return wrap;
}

// App card builder
function appCard(a) {
  return el('a', { href: `/app?slug=${encodeURIComponent(a.slug)}`, class: 'app-card' },
    (a.stars > 0) ? el('span', { class: 'star-pin' }, ico('star'), formatNum(a.stars)) : null,
    el('div', { class: 'ico' },
      a.icon_url ? el('img', { src: a.icon_url, alt: a.name, loading: 'lazy' }) : ico('package', 'icon icon-xl')
    ),
    el('div', { class: 'meta' },
      el('div', { class: 'name' }, a.name),
      a.developer ? el('div', { class: 'dev' }, a.developer) : null,
    ),
    el('div', { class: 'stats' },
      el('span', { class: 'size' }, formatBytes(a.size_bytes || 0)),
      el('span', { class: 'dl' }, ico('star'), formatNum(a.stars || 0)),
      el('span', { class: 'dl' }, ico('download'), formatNum(a.downloads || 0)),
    ),
  );
}

function renderHeader(active = '') {
  const h = document.querySelector('.header');
  if (!h) return;
  h.innerHTML = '';
  const inner = el('div', { class: 'container header-inner' },
    el('a', { href: '/', class: 'brand', dir: 'ltr' },
      el('img', { src: '/images/logo.png', alt: 'Goldenstore' }),
      el('span', { class: 'brand-text' },
        el('span', null, 'Golden'),
        el('b', null, 'store'),
      ),
    ),
    el('nav', { class: 'nav' },
      el('a', { href: '/', class: active === 'home' ? 'active' : '' }, 'الرئيسية'),
      el('a', { href: '/browse', class: active === 'browse' ? 'active' : '' }, 'تصفّح'),
      el('a', { href: '/categories', class: active === 'categories' ? 'active' : '' }, 'التصنيفات'),
    ),
    (() => {
      const f = el('form', { class: 'search-form', onsubmit: (e) => {
        e.preventDefault();
        const q = f.querySelector('input').value.trim();
        location.href = `/browse?q=${encodeURIComponent(q)}`;
      } });
      f.append(
        el('input', { class: 'search-input', type: 'search', name: 'q', placeholder: 'ابحث عن تطبيق مهكر…', value: getQuery('q') }),
        el('button', { type: 'submit', class: 'search-btn', 'aria-label': 'بحث' }, ico('search')),
      );
      return f;
    })(),
  );
  h.append(inner);
}

function renderFooter() {
  const f = document.querySelector('.footer');
  if (!f) return;
  f.innerHTML = '';
  const inner = el('div', { class: 'container footer-inner' },
    el('div', { class: 'brand-mark' },
      el('img', { src: '/images/logo.png', alt: '' }),
      el('span', null, '© '),
      el('b', { dir: 'ltr' }, STORE.domain),
      el('span', null, ' — المتجر الذهبي للتطبيقات المهكرة'),
    ),
    el('div', { class: 'footer-links' },
      el('span', null, 'جميع الحقوق محفوظة'),
    ),
  );
  f.append(inner);
}

async function loadStoreInfo() {
  try {
    const data = await api('/api/store');
    if (data.name) STORE.name = data.name;
    if (data.domain) STORE.domain = data.domain;
  } catch {}
}

function renderAds() {
  const page = document.body.dataset.page || '';
  if (page === 'admin') return;

  const adTop = document.getElementById('ad-top');
  if (adTop && ADSTERRA.banner_top) adTop.appendChild(adBanner(ADSTERRA.banner_top));

  const adBottom = document.getElementById('ad-bottom');
  if (adBottom && ADSTERRA.banner_bottom) adBottom.appendChild(adBanner(ADSTERRA.banner_bottom));
}

function init() {
  const active = document.body.dataset.page || '';
  renderHeader(active);
  renderFooter();
  loadStoreInfo().then(() => renderFooter());
  renderAds();
}

window.GS = {
  api, el, ico, appCard, toast,
  formatBytes, formatNum, formatDate,
  getQuery, setQuery,
  init, STORE,
  adBanner, adInFeed, adNative, ADSTERRA,
};

document.addEventListener('DOMContentLoaded', init);
