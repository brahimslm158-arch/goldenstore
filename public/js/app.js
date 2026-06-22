// App detail page — Google Play–style.
(function () {
  const S = window.Store;
  const { el, ico, api, getQuery, formatBytes, formatNum, formatCount, formatDate, ratingOf, toast } = S;
  const root = document.getElementById('root');
  S.bottomNav('');

  const slug = getQuery('slug');

  function sdkName(sdk) {
    const map = { 21: 'أندرويد 5.0', 22: '5.1', 23: '6.0', 24: '7.0', 25: '7.1', 26: '8.0', 27: '8.1', 28: '9', 29: '10', 30: '11', 31: '12', 32: '12L', 33: '13', 34: '14', 35: '15' };
    return map[sdk] || (sdk ? `SDK ${sdk}` : '—');
  }

  function openModal(src) {
    const m = el('div', { class: 'modal', onclick: (e) => { if (e.target === m) m.remove(); } },
      el('button', { class: 'close', 'aria-label': 'إغلاق', onclick: () => m.remove() }, ico('close')),
      el('img', { src }),
    );
    document.body.append(m);
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { m.remove(); document.removeEventListener('keydown', esc); } });
  }

  // Browser fingerprint for the star-vote endpoint.
  async function getFingerprint() {
    const parts = [];
    try {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
      const ctx = cv.getContext('2d'); ctx.textBaseline = 'top'; ctx.font = '14px Arial';
      ctx.fillStyle = '#f60'; ctx.fillRect(50, 0, 100, 30);
      ctx.fillStyle = '#069'; ctx.fillText('GoldenStore\uD83D\uDE00fp', 2, 4);
      parts.push(cv.toDataURL());
    } catch { parts.push('no-canvas'); }
    parts.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
    parts.push(String(navigator.hardwareConcurrency || 0));
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    parts.push(navigator.language || '');
    parts.push(navigator.platform || '');
    const raw = parts.join('|||');
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  S.ready(async () => {
    root.innerHTML = '';

    const menuBtn = el('button', { class: 'icon-btn', 'aria-label': 'مشاركة', onclick: () => share() }, ico('share'));
    const nav = S.topbarNav('', [menuBtn]);
    root.append(nav);
    const content = el('div', { class: 'detail' });
    root.append(content);
    content.append(S.spinner());

    function share() {
      const url = location.href;
      if (navigator.share) navigator.share({ url }).catch(() => {});
      else { navigator.clipboard && navigator.clipboard.writeText(url); toast('تم نسخ الرابط', 'success'); }
    }

    if (!slug) { content.innerHTML = ''; content.append(S.emptyState('لا يوجد تطبيق محدد', 'الرابط غير صحيح.', 'info')); return; }

    let app, screenshots;
    try {
      const data = await api(`/api/apps/${encodeURIComponent(slug)}`);
      app = data.app; screenshots = data.screenshots || [];
    } catch (e) {
      content.innerHTML = '';
      const title = (e && (e.status === 0 || e.message === 'timeout')) ? 'تعذّر الاتصال بالخادم' : 'التطبيق غير موجود';
      content.append(S.emptyState(title, 'تأكد من الرابط أو عُد للرئيسية.', 'info'),
        el('div', { style: { textAlign: 'center', marginTop: '16px' } }, el('a', { class: 'btn btn-primary', href: '/' }, 'العودة للرئيسية')));
      return;
    }

    document.title = `${app.name} — Golden Store`;
    nav.querySelector('.title') && (nav.querySelector('.title').textContent = '');
    content.innerHTML = '';

    // Head
    content.append(el('div', { class: 'd-head' },
      el('div', { class: 'd-icon' }, app.icon_url ? el('img', { src: app.icon_url, alt: app.name }) : ico('package', 'icon icon-lg')),
      el('div', { class: 'd-titles' },
        el('div', { class: 'd-name' }, app.name),
        el('div', { class: 'd-dev' }, app.developer || S.STORE.name),
        el('div', { class: 'd-sub' }, [S.categoryName(app.category), 'يحتوي على عمليات شراء داخل التطبيق'].filter(Boolean).join(' • ')),
      ),
    ));

    // Stats row
    content.append(el('div', { class: 'd-stats' },
      stat(el('span', null, ratingOf(app), ico('star', 'icon fill')), 'تقييم'),
      stat(formatCount(app.downloads), 'تنزيلات'),
      stat(formatBytes(app.size_bytes || 0), 'الحجم'),
      stat(sdkName(app.min_sdk), 'أندرويد'),
    ));

    // Actions
    const installBtn = el('a', { class: 'btn btn-primary btn-lg', href: `/api/apps/${encodeURIComponent(app.slug)}/download` },
      'تثبيت');
    content.append(el('div', { class: 'd-actions' }, installBtn));
    content.append(el('div', { class: 'd-note' }, `سيتم تنزيل ملف APK (${formatBytes(app.size_bytes || 0)}). فعّل «تثبيت من مصادر غير معروفة» لإكمال التثبيت.`));

    // Screenshots
    if (screenshots.length) {
      const shots = el('div', { class: 'shots' });
      screenshots.forEach((s) => { if (s.url) shots.append(el('img', { src: s.url, alt: '', loading: 'lazy', onclick: () => openModal(s.url) })); });
      content.append(el('div', { class: 'd-section' }, shots));
    }

    // About
    if (app.short_description || app.description) {
      content.append(el('div', { class: 'd-section' },
        el('h3', null, 'لمحة عن هذا التطبيق'),
        el('div', { class: 'd-desc' }, app.description || app.short_description),
      ));
    }

    // Tags
    content.append(el('div', { class: 'chip-row' },
      app.category ? el('span', { class: 'chip' }, S.categoryName(app.category)) : null,
      el('span', { class: 'chip' }, 'الإصدار ' + (app.version_name || '—')),
    ));

    // Rating section (star vote)
    content.append(ratingSection(app));

    // Info
    content.append(el('div', { class: 'd-section' },
      el('h3', null, 'معلومات إضافية'),
      el('div', { class: 'info-grid' },
        info('الإصدار', app.version_name || '—'),
        info('آخر تحديث', formatDate(app.updated_at)),
        info('الحجم', formatBytes(app.size_bytes || 0)),
        info('عدد التنزيلات', formatNum(app.downloads)),
        info('يتطلب', sdkName(app.min_sdk)),
        info('اسم الحزمة', app.package_name || '—'),
        info('المطوّر', app.developer || '—'),
        info('التصنيف', S.categoryName(app.category) || '—'),
      ),
    ));

    function stat(value, label) {
      const v = el('div', { class: 'v' });
      if (value && value.nodeType) v.append(value); else v.textContent = value;
      return el('div', { class: 'd-stat' }, v, el('div', { class: 'l' }, label));
    }
    function info(l, v) { return el('div', { class: 'info-cell' }, el('div', { class: 'l' }, l), el('div', { class: 'v' }, v)); }
  });

  function ratingSection(app) {
    const stars = [];
    let fingerprint = null, voted = false;
    const count = el('div', { class: 'rate-meta' }, `${formatNum(app.stars || 0)} شخص قيّم هذا التطبيق`);

    const starWrap = el('div', { class: 'rate-stars' });
    for (let i = 0; i < 5; i++) {
      const sIco = ico('star', 'icon fill');
      sIco.style.cursor = 'pointer';
      sIco.addEventListener('click', () => vote());
      stars.push(sIco);
      starWrap.append(sIco);
    }

    (async () => {
      try {
        fingerprint = await getFingerprint();
        const res = await window.Store.api(`/api/apps/${encodeURIComponent(app.slug)}/star-check`, { method: 'POST', body: { fp: fingerprint } });
        if (res.voted) voted = true;
      } catch {}
    })();

    async function vote() {
      if (voted) { toast('لقد قيّمت هذا التطبيق مسبقاً', 'info'); return; }
      try {
        if (!fingerprint) fingerprint = await getFingerprint();
        const res = await window.Store.api(`/api/apps/${encodeURIComponent(app.slug)}/star`, { method: 'POST', body: { fp: fingerprint } });
        voted = true;
        count.textContent = `${formatNum(res.stars)} شخص قيّم هذا التطبيق`;
        toast('شكراً لتقييمك!', 'success');
      } catch (e) {
        if (e && e.status === 409) { voted = true; toast('لقد قيّمت هذا التطبيق مسبقاً', 'info'); }
        else toast('تعذّر إرسال التقييم', 'error');
      }
    }

    return el('div', { class: 'd-section' },
      el('h3', null, 'التقييمات والمراجعات'),
      el('div', { class: 'rate-block' },
        el('div', null, el('div', { class: 'rate-big' }, ratingOf(app)), el('div', { class: 'rate-stars', style: { marginTop: '4px' } },
          ...Array.from({ length: 5 }, () => ico('star', 'icon fill')))),
        el('div', null, count),
      ),
      el('div', { style: { marginTop: '18px' } },
        el('div', { style: { fontSize: '14px', marginBottom: '8px' } }, 'قيّم هذا التطبيق'),
        starWrap,
      ),
    );
  }
})();
