(async function () {
  const { api, el, ico, formatBytes, formatNum, formatDate, getQuery, toast, requireAuth } = window.GS;
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
    var map = {
      21: 'أندرويد 5.0', 22: '5.1', 23: '6.0', 24: '7.0', 25: '7.1',
      26: '8.0', 27: '8.1', 28: '9.0', 29: '10', 30: '11',
      31: '12', 32: '12L', 33: '13', 34: '14', 35: '15',
    };
    return map[sdk] || (sdk ? 'SDK ' + sdk : '\u2014');
  }

  function openModal(src) {
    var m = el('div', { class: 'modal open', onclick: function(e) { if (e.target === m) m.remove(); } },
      el('button', { class: 'close', onclick: function() { m.remove(); }, 'aria-label': 'إغلاق' }, ico('close')),
      el('img', { src: src }),
    );
    document.body.append(m);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { m.remove(); document.removeEventListener('keydown', esc); }
    });
  }

  function starSvg(filled) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'star' + (filled ? ' filled' : ''));
    s.setAttribute('viewBox', '0 0 24 24');
    s.innerHTML = '<path d="m12 2 3.1 6.3 7 1-5 5 1.2 6.9L12 17.7 5.8 21l1.2-6.9-5-5 7-1z"/>';
    return s;
  }

  // Browser fingerprint
  async function getFingerprint() {
    var parts = [];
    try {
      var cv = document.createElement('canvas');
      cv.width = 256; cv.height = 64;
      var ctx = cv.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(50, 0, 100, 30);
      ctx.fillStyle = '#069';
      ctx.fillText('GoldenStore\uD83D\uDE00fp', 2, 4);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('GoldenStore\uD83D\uDE00fp', 4, 8);
      parts.push(cv.toDataURL());
    } catch(e) { parts.push('no-canvas'); }
    try {
      var cv2 = document.createElement('canvas');
      var gl = cv2.getContext('webgl') || cv2.getContext('experimental-webgl');
      if (gl) {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        parts.push(gl.getParameter(gl.RENDERER));
        parts.push(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '');
        parts.push(dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : '');
      }
    } catch(e) { parts.push('no-webgl'); }
    parts.push(screen.width + 'x' + screen.height + 'x' + screen.colorDepth);
    parts.push(String(navigator.hardwareConcurrency || 0));
    parts.push(String(navigator.maxTouchPoints || 0));
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    parts.push(navigator.language || '');
    parts.push(String(navigator.deviceMemory || 0));
    parts.push(navigator.platform || '');
    try {
      var actx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 5000, 44100);
      var osc = actx.createOscillator();
      osc.type = 'triangle'; osc.frequency.value = 10000;
      var comp = actx.createDynamicsCompressor();
      osc.connect(comp); comp.connect(actx.destination);
      osc.start(0);
      var buf = await actx.startRendering();
      var data = buf.getChannelData(0);
      var sum = 0;
      for (var i = 4500; i < 5000; i++) sum += Math.abs(data[i]);
      parts.push(sum.toFixed(6));
    } catch(e) { parts.push('no-audio'); }
    var raw = parts.join('|||');
    var encoder = new TextEncoder();
    var hash = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
    return Array.from(new Uint8Array(hash)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  try {
    var result = await api('/api/apps/' + encodeURIComponent(slug));
    var app = result.app;
    var screenshots = result.screenshots;
    document.title = app.name + ' \u2014 Goldenstore';
    content.innerHTML = '';

    // --- Header section (icon + title + developer) ---
    content.append(el('div', { class: 'app-detail-header' },
      el('div', { class: 'app-icon-big' },
        app.icon_url
          ? el('img', { src: app.icon_url, alt: app.name })
          : ico('package', 'icon icon-xxl')
      ),
      el('div', { class: 'app-title-area' },
        el('h1', null, app.name),
        app.developer ? el('div', { class: 'app-developer' }, app.developer) : null,
        app.category ? el('div', { class: 'app-category-tag' }, app.category) : null,
      ),
    ));

    // --- Stats bar ---
    var starIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    starIcon.setAttribute('class', 'star-icon-sm');
    starIcon.setAttribute('viewBox', '0 0 24 24');
    starIcon.innerHTML = '<path d="m12 2 3.1 6.3 7 1-5 5 1.2 6.9L12 17.7 5.8 21l1.2-6.9-5-5 7-1z"/>';

    content.append(el('div', { class: 'app-stats-bar' },
      el('div', { class: 'app-stat-item' },
        el('div', { class: 'stat-value' }, formatNum(app.stars || 0), starIcon),
        el('div', { class: 'stat-label' }, 'التقييم'),
      ),
      el('div', { class: 'app-stat-item' },
        el('div', { class: 'stat-value' }, formatNum(app.downloads)),
        el('div', { class: 'stat-label' }, 'تنزيلات'),
      ),
      el('div', { class: 'app-stat-item' },
        el('div', { class: 'stat-value' }, formatBytes(app.size_bytes)),
        el('div', { class: 'stat-label' }, 'الحجم'),
      ),
      el('div', { class: 'app-stat-item' },
        el('div', { class: 'stat-value' }, app.version_name || '\u2014'),
        el('div', { class: 'stat-label' }, 'الإصدار'),
      ),
    ));

    // --- Install button ---
    var downloadBtn = el('a', {
      class: 'btn-install',
      href: '#',
      onclick: function(e) {
        e.preventDefault();
        if (!requireAuth('download')) return;
        window.location.href = '/api/apps/' + encodeURIComponent(app.slug) + '/download';
      }
    }, 'تثبيت');

    content.append(el('div', { class: 'app-action-bar' }, downloadBtn));

    // --- Screenshots ---
    if (screenshots && screenshots.length) {
      var row = el('div', { class: 'screenshots' });
      screenshots.forEach(function(ss) {
        if (!ss.url) return;
        row.append(el('img', { src: ss.url, alt: '', loading: 'lazy', onclick: function() { openModal(ss.url); } }));
      });
      content.append(el('div', { class: 'screenshots-section' }, row));
    }

    // --- About this app ---
    if (app.short_description || app.description) {
      content.append(el('div', { class: 'detail-section' },
        el('div', { class: 'detail-section-title' }, 'لمحة عن هذا التطبيق'),
        app.short_description ? el('p', null, app.short_description) : null,
        app.description ? el('p', { class: 'desc', style: 'margin-top:8px;' }, app.description) : null,
      ));
    }

    // --- Rating section ---
    var starCount = el('span', null, formatNum(app.stars || 0));
    var voted = false;
    var fingerprint = null;
    var starsWrap = el('div', { class: 'rating-stars' });

    function renderStars(v) {
      starsWrap.innerHTML = '';
      for (var i = 1; i <= 5; i++) {
        (function(idx) {
          var s = starSvg(idx <= (v ? 1 : 0));
          s.onclick = function() { handleStar(); };
          starsWrap.append(s);
        })(i);
      }
    }
    renderStars(voted);

    content.append(el('div', { class: 'rating-section' },
      el('div', { class: 'rating-header' },
        el('h3', null, 'تقييم هذا التطبيق'),
      ),
      el('p', { style: 'color:var(--text-2); margin-bottom:12px; font-size:13px;' }, 'إخبار الآخرين برأيك'),
      starsWrap,
    ));

    // Check vote status
    (async function() {
      try {
        fingerprint = await getFingerprint();
        var res = await api('/api/apps/' + encodeURIComponent(app.slug) + '/star-check', {
          method: 'POST',
          body: { fp: fingerprint },
        });
        if (res.voted) {
          voted = true;
          renderStars(true);
        }
      } catch(e) {}
    })();

    async function handleStar() {
      if (!requireAuth('rate')) return;
      if (voted) {
        toast('لقد أعطيت نجمة لهذا التطبيق مسبقاً', 'info');
        return;
      }
      try {
        if (!fingerprint) fingerprint = await getFingerprint();
        var res = await api('/api/apps/' + encodeURIComponent(app.slug) + '/star', {
          method: 'POST',
          body: { fp: fingerprint },
        });
        voted = true;
        renderStars(true);
        starCount.textContent = formatNum(res.stars);
        toast('شكراً لتقييمك!', 'success');
      } catch (e) {
        if (e && e.status === 409) {
          voted = true;
          renderStars(true);
          toast('لقد أعطيت نجمة مسبقاً', 'info');
        } else {
          toast('حدث خطأ، حاول لاحقاً', 'error');
        }
      }
    }

    // --- Technical info ---
    content.append(el('div', { class: 'detail-section' },
      el('div', { class: 'detail-section-title' }, 'معلومات تقنية'),
      el('div', { class: 'tech-grid' },
        techCell('اسم الحزمة', app.package_name || '\u2014'),
        techCell('الإصدار', app.version_name || '\u2014'),
        techCell('رمز الإصدار', app.version_code != null ? String(app.version_code) : '\u2014'),
        techCell('الحد الأدنى', sdkName(app.min_sdk)),
        techCell('الحجم', formatBytes(app.size_bytes)),
        techCell('التنزيلات', formatNum(app.downloads)),
        techCell('المطوّر', app.developer || '\u2014'),
        techCell('التصنيف', app.category || '\u2014'),
        techCell('تاريخ النشر', formatDate(app.created_at)),
        techCell('آخر تحديث', formatDate(app.updated_at)),
      ),
    ));

    content.append(el('div', { class: 'muted mt-md', style: 'text-align:center; font-size:13px; padding-bottom:16px;' },
      'لتثبيت التطبيق: فعّل خيار «تثبيت تطبيقات من مصادر غير معروفة» من إعدادات الأمان في جهازك.'));

    function techCell(label, value) {
      return el('div', { class: 'tech-cell' },
        el('span', { class: 'l' }, label),
        el('span', { class: 'v' }, value),
      );
    }
  } catch (e) {
    content.innerHTML = '';
    var title = 'تطبيق غير موجود';
    var detail = 'تأكد من الرابط أو عد للرئيسية.';
    if (e && (e.status === 0 || e.message === 'timeout')) {
      title = 'تعذّر الاتصال بالخادم';
      detail = 'تحقّق من اتصالك بالإنترنت ثمّ حدّث الصفحة.';
    } else if (e && e.status >= 500) {
      title = 'خدمة المتجر غير متاحة مؤقتاً';
      detail = 'حاول لاحقاً بعد دقائق قليلة.';
    }
    content.append(el('div', { class: 'empty-state' },
      ico('info', 'icon icon-xxl'),
      el('h3', null, title),
      el('p', null, detail),
      el('div', { class: 'mt-md' },
        el('a', { class: 'btn btn-primary', href: '/' }, 'العودة للرئيسية'),
      ),
    ));
  }
})();
