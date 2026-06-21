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
  return v.toFixed(v < 10 && i > 0 ? 1 : 0) + ' ' + units[i];
}

function formatNum(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function formatDate(ts) {
  if (!ts) return '\u2014';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric', numberingSystem: 'latn' });
}

function getQuery(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

function setQuery(params, replace) {
  const url = new URL(location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '' || v === false) url.searchParams.delete(k);
    else url.searchParams.set(k, String(v));
  }
  if (replace) history.replaceState(null, '', url.toString());
  else history.pushState(null, '', url.toString());
}

function toast(msg, type, ms) {
  type = type || 'info';
  ms = ms || 3500;
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = el('div', { class: 'toast-stack' });
    document.body.append(stack);
  }
  const t = el('div', { class: 'toast ' + type }, msg);
  stack.append(t);
  setTimeout(() => {
    t.style.transition = 'opacity 0.2s, transform 0.2s';
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 200);
  }, ms);
}

function ico(name, extra) {
  return window.GSIcons.iconEl(name, extra || 'icon');
}

// Play Store style app card (vertical, compact, for horizontal rows)
function appCard(a) {
  const ratingText = (a.stars || 0) > 0 ? formatNum(a.stars) : '';
  return el('a', { href: '/app?slug=' + encodeURIComponent(a.slug), class: 'app-card' },
    el('div', { class: 'app-icon' },
      a.icon_url ? el('img', { src: a.icon_url, alt: a.name, loading: 'lazy' }) : ico('package', 'icon icon-xl')
    ),
    el('div', { class: 'app-name' }, a.name),
    el('div', { class: 'app-meta' },
      ratingText ? [
        el('span', null, ratingText),
        (() => {
          const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          s.setAttribute('class', 'star-icon');
          s.setAttribute('viewBox', '0 0 24 24');
          s.innerHTML = '<path d="m12 2 3.1 6.3 7 1-5 5 1.2 6.9L12 17.7 5.8 21l1.2-6.9-5-5 7-1z"/>';
          return s;
        })()
      ] : el('span', null, formatBytes(a.size_bytes || 0)),
    ),
  );
}

// App list item (horizontal, for search results and browse grids)
function appListItem(a) {
  return el('a', { href: '/app?slug=' + encodeURIComponent(a.slug), class: 'app-list-item' },
    el('div', { class: 'app-icon' },
      a.icon_url ? el('img', { src: a.icon_url, alt: a.name, loading: 'lazy' }) : ico('package', 'icon icon-xl')
    ),
    el('div', { class: 'app-info' },
      el('div', { class: 'app-name' }, a.name),
      a.developer ? el('div', { class: 'app-dev' }, a.developer) : null,
      el('div', { class: 'app-stats-row' },
        el('span', null, ico('star'), formatNum(a.stars || 0)),
        el('span', null, formatBytes(a.size_bytes || 0)),
        el('span', null, ico('download'), formatNum(a.downloads || 0)),
      ),
    ),
  );
}

function requireAuth(action) {
  const user = window.GAuth.getUser();
  if (user) return true;
  toast('يرجى تسجيل الدخول بحساب Google أولاً', 'info');
  window.GAuth.signInWithGoogle();
  return false;
}

function renderHeader(active) {
  active = active || '';
  const h = document.querySelector('.header');
  if (!h) return;
  h.innerHTML = '';

  const userArea = el('div', { class: 'header-user', style: 'position:relative;' });

  function updateUserArea(user) {
    userArea.innerHTML = '';
    if (user) {
      const avatarEl = el('div', { class: 'avatar', onclick: toggleDropdown },
        el('img', { src: user.photoURL || '', alt: user.displayName || '' })
      );
      const dropdown = el('div', { class: 'user-dropdown', id: 'user-dropdown' },
        el('div', { class: 'ud-header' },
          el('div', { class: 'ud-name' }, user.displayName || ''),
          el('div', { class: 'ud-email' }, user.email || ''),
        ),
        el('button', { class: 'ud-item', onclick: () => { window.GAuth.signOut(); dropdown.classList.remove('open'); } },
          ico('logout'), 'تسجيل الخروج'
        ),
      );
      userArea.append(avatarEl, dropdown);
    } else {
      userArea.append(
        el('button', { class: 'btn-signin', onclick: () => window.GAuth.signInWithGoogle() },
          ico('user'), 'تسجيل الدخول'
        )
      );
    }
  }

  function toggleDropdown() {
    const dd = document.getElementById('user-dropdown');
    if (dd) dd.classList.toggle('open');
  }

  document.addEventListener('click', (e) => {
    const dd = document.getElementById('user-dropdown');
    if (dd && !dd.parentElement.contains(e.target)) dd.classList.remove('open');
  });

  window.GAuth.onAuthChange(updateUserArea);

  const searchForm = el('form', { class: 'search-bar', onsubmit: (e) => {
    e.preventDefault();
    const q = searchForm.querySelector('input').value.trim();
    location.href = '/browse?q=' + encodeURIComponent(q);
  } });
  searchForm.append(
    el('input', { type: 'search', name: 'q', placeholder: 'ابحث عن تطبيق...', value: getQuery('q') }),
    el('button', { type: 'submit', 'aria-label': 'بحث' }, ico('search')),
  );

  const inner = el('div', { class: 'container header-inner' },
    el('a', { href: '/', class: 'brand', dir: 'ltr' },
      el('img', { src: '/images/logo.png', alt: 'Goldenstore' }),
      el('span', { class: 'brand-text' },
        el('span', null, 'Golden'),
        el('b', null, 'store'),
      ),
    ),
    searchForm,
    userArea,
  );
  h.append(inner);
}

function renderBottomNav(active) {
  active = active || '';
  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;
  nav.innerHTML = '';
  const items = [
    { href: '/', icon: 'home', label: 'الرئيسية', id: 'home' },
    { href: '/browse', icon: 'grid', label: 'التطبيقات', id: 'browse' },
    { href: '/categories', icon: 'layers', label: 'التصنيفات', id: 'categories' },
    { href: '/browse?q=', icon: 'search', label: 'بحث', id: 'search' },
  ];
  items.forEach((item) => {
    nav.append(el('a', { href: item.href, class: active === item.id ? 'active' : '' },
      ico(item.icon), el('span', null, item.label)
    ));
  });
}

function renderFooter() {
  const f = document.querySelector('.footer');
  if (!f) return;
  f.innerHTML = '';
  const inner = el('div', { class: 'container footer-inner' },
    el('div', { class: 'brand-mark' },
      el('img', { src: '/images/logo.png', alt: '' }),
      el('span', null, '\u00a9 '),
      el('b', { dir: 'ltr' }, STORE.domain),
      el('span', null, ' \u2014 Goldenstore'),
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

function init() {
  const active = document.body.dataset.page || '';
  renderHeader(active);
  renderBottomNav(active);
  renderFooter();
  loadStoreInfo().then(() => renderFooter());
}

window.GS = {
  api, el, ico, appCard, appListItem, toast, requireAuth,
  formatBytes, formatNum, formatDate,
  getQuery, setQuery,
  init, STORE,
};

document.addEventListener('DOMContentLoaded', init);
