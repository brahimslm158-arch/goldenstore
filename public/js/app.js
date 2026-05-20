(async function () {
  const { api, el, ico, formatBytes, formatNum, formatDate, getQuery } = window.GS;
  const content = document.getElementById('content');

  const slug = getQuery('slug');
  if (!slug) {
    content.innerHTML = '';
    content.append(el('div', { class: 'empty-state' },
      ico('info', 'icon icon-xxl'),
      el('h3', null, 'لا يوجد تطبيق محدد'),
      el('p', null, 'الرابط غير صحيح.'),
    ));
    return;
  }

  function sdkName(sdk) {
    const map = {
      21: 'أندرويد 5.0', 22: '5.1', 23: '6.0', 24: '7.0', 25: '7.1',
      26: '8.0', 27: '8.1', 28: '9.0', 29: '10', 30: '11',
      31: '12', 32: '12L', 33: '13', 34: '14', 35: '15',
    };
    return map[sdk] || (sdk ? `SDK ${sdk}` : '—');
  }

  function openModal(src) {
    const m = el('div', { class: 'modal open', onclick: (e) => { if (e.target === m) m.remove(); } },
      el('button', { class: 'close', onclick: () => m.remove(), 'aria-label': 'إغلاق' }, ico('close')),
      el('img', { src }),
    );
    document.body.append(m);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { m.remove(); document.removeEventListener('keydown', esc); }
    });
  }

  try {
    const { app, screenshots } = await api(`/api/apps/${encodeURIComponent(slug)}`);
    document.title = `${app.name} — Goldenstore`;
    content.innerHTML = '';

    // Hero
    content.append(el('section', { class: 'app-hero' },
      el('div', { class: 'icon-big' },
        app.icon_url
          ? el('img', { src: app.icon_url, alt: app.name })
          : ico('package', 'icon icon-xxl')
      ),
      el('div', null,
        el('h1', null, app.name),
        app.developer ? el('div', { class: 'dev' }, app.developer) : null,
        el('div', { class: 'quick-stats' },
          el('div', { class: 'stat' }, el('div', { class: 'v' }, formatNum(app.downloads)), el('div', { class: 'l' }, 'تنزيلات')),
          el('div', { class: 'stat' }, el('div', { class: 'v' }, app.version_name || '—'), el('div', { class: 'l' }, 'الإصدار')),
          el('div', { class: 'stat' }, el('div', { class: 'v' }, formatBytes(app.size_bytes)), el('div', { class: 'l' }, 'الحجم')),
          el('div', { class: 'stat' }, el('div', { class: 'v' }, sdkName(app.min_sdk)), el('div', { class: 'l' }, 'الحد الأدنى')),
        ),
        el('div', { class: 'download-bar' },
          el('a', { class: 'btn btn-primary btn-lg', href: `/api/apps/${encodeURIComponent(app.slug)}/download` },
            ico('download'), 'تنزيل APK ', formatBytes(app.size_bytes)),
          app.featured ? el('span', { class: 'featured-badge' }, ico('star'), 'مميز') : null,
        ),
      ),
    ));

    // Short description
    if (app.short_description) {
      content.append(el('section', { class: 'panel' },
        el('div', { class: 'panel-head' }, ico('info'), 'نبذة'),
        el('p', null, app.short_description),
      ));
    }

    // Screenshots
    if (screenshots && screenshots.length) {
      const row = el('div', { class: 'screenshots' });
      screenshots.forEach((ss) => {
        if (!ss.url) return;
        row.append(el('img', { src: ss.url, alt: '', onclick: () => openModal(ss.url) }));
      });
      content.append(el('section', { class: 'panel' },
        el('div', { class: 'panel-head' }, ico('image'), 'لقطات الشاشة'),
        row,
      ));
    }

    // Full description
    if (app.description) {
      content.append(el('section', { class: 'panel' },
        el('div', { class: 'panel-head' }, ico('book'), 'الوصف'),
        el('p', { class: 'desc' }, app.description),
      ));
    }

    // Tech info
    content.append(el('section', { class: 'panel' },
      el('div', { class: 'panel-head' }, ico('android'), 'معلومات تقنية'),
      el('div', { class: 'tech-grid' },
        techCell('اسم الحزمة', app.package_name || '—'),
        techCell('الإصدار', app.version_name || '—'),
        techCell('رمز الإصدار', app.version_code != null ? String(app.version_code) : '—'),
        techCell('الحد الأدنى لأندرويد', sdkName(app.min_sdk)),
        techCell('الحجم', formatBytes(app.size_bytes)),
        techCell('عدد التنزيلات', formatNum(app.downloads)),
        techCell('المطوّر', app.developer || '—'),
        techCell('التصنيف', app.category || '—'),
        techCell('تاريخ النشر', formatDate(app.created_at)),
        techCell('آخر تحديث', formatDate(app.updated_at)),
      ),
    ));

    content.append(el('div', { class: 'muted mt-md', style: 'text-align:center; font-size:13px;' },
      'ملاحظة: لتثبيت APK خارج Google Play، فعّل «مصادر غير معروفة» من إعدادات الأمان على جهازك.'));

    function techCell(label, value) {
      return el('div', { class: 'tech-cell' },
        el('span', { class: 'l' }, label),
        el('span', { class: 'v' }, value),
      );
    }
  } catch (e) {
    content.innerHTML = '';
    content.append(el('div', { class: 'empty-state' },
      ico('info', 'icon icon-xxl'),
      el('h3', null, 'تطبيق غير موجود'),
      el('p', null, 'تأكد من الرابط أو عد للرئيسية.'),
      el('div', { class: 'mt-md' },
        el('a', { class: 'btn btn-primary', href: '/' }, 'العودة للرئيسية'),
      ),
    ));
  }
})();
