// App detail page — Google Play–style.
(function () {
  const S = window.Store;
  const { el, ico, api, getQuery, formatBytes, formatNum, formatCount, formatDate, ratingOf, toast } = S;
  const root = document.getElementById('root');
  S.bottomNav('');

  // Localize a known UI string synchronously (used for the rapidly-updating
  // install button so we don't spam the translator with each progress percent).
  const tr = (s) => { try { return (window.GSI18N && window.GSI18N.t) ? window.GSI18N.t(s) : s; } catch (e) { return s; } };

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
    const rt = ratingOf(app);
    content.append(el('div', { class: 'd-stats' },
      stat(rt ? el('span', null, rt, ico('star', 'icon fill')) : el('span', null, 'جديد'), 'تقييم'),
      stat(formatCount(app.downloads), 'تنزيلات'),
      stat(formatBytes(app.size_bytes || 0), 'الحجم'),
      stat(sdkName(app.min_sdk), 'أندرويد'),
    ));

    // Actions — animated install with a smooth progress bar.
    content.append(installControl(app));
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

    // Similar apps/games
    loadSimilar(app, content);

    function stat(value, label) {
      const v = el('div', { class: 'v' });
      if (value && value.nodeType) v.append(value); else v.textContent = value;
      return el('div', { class: 'd-stat' }, v, el('div', { class: 'l' }, label));
    }
  });

  async function loadSimilar(app, container) {
    try {
      const catParam = app.category ? `&category=${encodeURIComponent(app.category)}` : '';
      const typeParam = app.type ? `&type=${encodeURIComponent(app.type)}` : '';
      const res = await api(`/api/apps?limit=20${catParam}${typeParam}&sort=popular`);
      const similar = (res.apps || []).filter((a) => a.slug !== app.slug).slice(0, 10);
      if (!similar.length) return;
      const title = app.type === 'game' ? 'ألعاب مماثلة' : 'تطبيقات مماثلة';
      const row = el('div', { class: 'hrow' });
      similar.forEach((a) => row.append(S.posterCard(a)));
      container.append(el('div', { class: 'd-section' },
        el('h3', null, title),
        row,
      ));
    } catch {}
  }

  // Static 5-star bar reflecting an average value (filled vs empty).
  function starBar(value) {
    const wrap = el('div', { class: 'rate-static', style: { marginTop: '4px' } });
    const rounded = Math.round(Number(value) || 0);
    for (let i = 1; i <= 5; i++) wrap.append(el('span', { class: `star ${i <= rounded ? 'on' : ''}` }, i <= rounded ? '★' : '☆'));
    return wrap;
  }

  // One row of the rating distribution bar chart (Google Play style).
  function distRow(starN, c, total) {
    const pct = total > 0 ? Math.round((c / total) * 100) : 0;
    return el('div', { class: 'row' },
      el('span', { class: 'lbl' }, String(starN)),
      el('div', { class: 'bar' }, el('span', { style: { width: pct + '%' } })),
    );
  }

  // A single review card: avatar + name + date, star row, then the comment.
  function reviewCard(r) {
    const initial = ((r.name || 'م').trim().charAt(0) || 'م').toUpperCase();
    const stars = el('div', { class: 'stars' });
    const rt = Math.round(Number(r.rating) || 0);
    for (let i = 1; i <= 5; i++) stars.append(el('span', { class: `star ${i <= rt ? 'on' : ''}` }, i <= rt ? '★' : '☆'));
    const avatar = el('div', { class: 'avatar' });
    if (r.photo_url) avatar.append(el('img', { src: r.photo_url, alt: '', referrerpolicy: 'no-referrer' }));
    else avatar.textContent = initial;
    return el('div', { class: 'review' },
      el('div', { class: 'head' },
        avatar,
        el('div', { class: 'who' },
          el('div', { class: 'nm' }, r.name || 'مستخدم'),
          el('div', { class: 'dt' }, formatDate(r.ts)),
        ),
      ),
      stars,
      r.comment ? el('div', { class: 'body' }, r.comment) : null,
    );
  }

  // ----- Install: persist "installed" apps locally so the state survives reloads.
  const INSTALL_KEY = 'gs_installed';
  function installedSet() {
    try { return new Set(JSON.parse(localStorage.getItem(INSTALL_KEY) || '[]')); } catch { return new Set(); }
  }
  function isInstalled(slug) { return installedSet().has(slug); }
  function markInstalledStored(slug) {
    try { const s = installedSet(); s.add(slug); localStorage.setItem(INSTALL_KEY, JSON.stringify([...s])); } catch {}
  }
  function unmarkInstalledStored(slug) {
    try { const s = installedSet(); s.delete(slug); localStorage.setItem(INSTALL_KEY, JSON.stringify([...s])); } catch {}
  }
  // Generic centered dialog (used by "request update" and "report").
  function openDialog({ icon, title, fields, submitLabel, onSubmit }) {
    const overlay = el('div', { class: 'dialog-overlay', onclick: (e) => { if (e.target === overlay) close(); } });
    const inputs = {};
    const body = el('div', { class: 'dialog-body' });
    fields.forEach((f) => {
      const lbl = el('label', { class: 'dialog-field' },
        el('span', { class: 'dialog-label' }, f.label, f.required ? el('b', { class: 'req' }, ' *') : null));
      let input;
      if (f.type === 'textarea') input = el('textarea', { class: 'field', rows: '3', placeholder: f.placeholder || '', maxlength: f.maxlength || '2000' });
      else if (f.type === 'select') {
        input = el('select', { class: 'field' });
        (f.options || []).forEach((o) => input.append(el('option', { value: o }, o)));
      } else input = el('input', { class: 'field', type: 'text', placeholder: f.placeholder || '', maxlength: f.maxlength || '200', value: f.value || '', disabled: f.readonly ? true : false });
      inputs[f.key] = input;
      lbl.append(input);
      body.append(lbl);
    });

    const submitBtn = el('button', { class: 'btn btn-primary' }, ico(icon, 'icon'), submitLabel);
    const errLine = el('div', { class: 'dialog-err' });
    submitBtn.addEventListener('click', async () => {
      const values = {};
      for (const f of fields) values[f.key] = (inputs[f.key].value || '').trim();
      for (const f of fields) {
        if (f.required && !values[f.key]) { errLine.textContent = 'يرجى ملء الحقول المطلوبة'; inputs[f.key].focus(); return; }
      }
      submitBtn.disabled = true; errLine.textContent = '';
      try { await onSubmit(values); close(); toast('تم إرسال طلبك إلى الإدارة', 'success'); }
      catch (e) { submitBtn.disabled = false; errLine.textContent = 'تعذّر الإرسال، حاول مجدداً'; }
    });

    const card = el('div', { class: 'dialog-card', dir: 'rtl' },
      el('div', { class: 'dialog-head' },
        el('div', { class: 'dialog-title' }, ico(icon, 'icon'), title),
        el('button', { class: 'dialog-close', 'aria-label': 'إغلاق', onclick: () => close() }, ico('close')),
      ),
      body,
      errLine,
      el('div', { class: 'dialog-actions' },
        el('button', { class: 'btn btn-secondary', onclick: () => close() }, 'إلغاء'),
        submitBtn,
      ),
    );
    overlay.append(card);
    function close() { overlay.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', esc);
    document.body.append(overlay);
  }

  function openRequestUpdate(app) {
    openDialog({
      icon: 'refresh', title: 'طلب تحديث', submitLabel: 'إرسال الطلب',
      fields: [
        { key: 'current', label: 'الإصدار الحالي', value: app.version_name || '—', readonly: true },
        { key: 'new_version', label: 'الإصدار الجديد', required: true, placeholder: 'مثال: 2.5.1', maxlength: '60' },
        { key: 'source', label: 'رابط المصدر', placeholder: 'مثال: https://play.google.com/...', maxlength: '500' },
      ],
      onSubmit: (v) => api(`/api/apps/${encodeURIComponent(app.slug)}/request-update`, {
        method: 'POST', body: { new_version: v.new_version, source: v.source },
      }),
    });
  }

  function openReport(app) {
    openDialog({
      icon: 'flag', title: 'إبلاغ عن التطبيق', submitLabel: 'إرسال البلاغ',
      fields: [
        { key: 'reason', label: 'سبب البلاغ', required: true, type: 'select',
          options: ['التطبيق فيه فيروس', 'رابط التحميل لا يعمل', 'محتوى غير لائق', 'انتهاك حقوق نشر', 'معلومات خاطئة', 'سبب آخر'] },
        { key: 'details', label: 'تفاصيل إضافية', type: 'textarea', placeholder: 'اشرح المشكلة…', maxlength: '2000' },
      ],
      onSubmit: (v) => api(`/api/apps/${encodeURIComponent(app.slug)}/report`, {
        method: 'POST', body: { reason: v.reason, details: v.details },
      }),
    });
  }

  // Save a downloaded blob to the user's device.
  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename, style: { display: 'none' } });
    document.body.append(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 30000);
  }

  // Fallback: plain navigation download (browser's own download UI) when the
  // streaming fetch isn't possible.
  function fallbackDownload(slug) {
    const a = el('a', { href: `/api/apps/${encodeURIComponent(slug)}/download`, download: '', style: { display: 'none' } });
    document.body.append(a);
    a.click();
    setTimeout(() => a.remove(), 30000);
  }

  // The install button + REAL download progress bar. Streams the APK while
  // reporting genuine progress, saves the file to the device, then settles into
  // an "installed" state ("التطبيق لديك").
  function installControl(app) {
    const label = el('span', { class: 'install-label', 'data-noi18n': '' }, tr('تثبيت'));
    const fill = el('span', { class: 'install-fill' });
    const btn = el('button', { class: 'btn btn-primary btn-lg install-btn', type: 'button' }, fill, label);

    function setProgress(ratio) {
      const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
      fill.style.transition = 'width .15s linear';
      fill.style.width = pct + '%';
      label.textContent = `${tr('جارٍ التحميل…')} ${pct}%`;
    }
    function setIndeterminate() {
      btn.classList.add('indeterminate');
      label.textContent = tr('جارٍ التحميل…');
    }
    function resetBar() {
      btn.classList.remove('installing', 'indeterminate');
      fill.style.transition = 'none';
      fill.style.width = '0%';
    }
    function showInstalled() {
      resetBar();
      btn.classList.add('installed');
      btn.disabled = false;
      label.innerHTML = '';
      label.append(ico('check', 'icon'), document.createTextNode(tr('تم التثبيت')));
    }
    function showIdle() {
      resetBar();
      btn.classList.remove('installed');
      btn.disabled = false;
      label.textContent = tr('تثبيت');
    }

    const filename = `${app.slug || 'app'}-${app.version_name || ''}.apk`.replace(/-+/g, '-');

    async function runInstall() {
      if (btn.classList.contains('installing')) return;
      // Already installed: tapping toggles back to the "install" state.
      if (btn.classList.contains('installed')) { unmarkInstalledStored(app.slug); showIdle(); return; }

      btn.classList.add('installing');
      btn.disabled = true;
      fill.style.transition = 'none';
      fill.style.width = '0%';
      label.textContent = `${tr('جارٍ التحميل…')} 0%`;

      try {
        const res = await fetch(`/api/apps/${encodeURIComponent(app.slug)}/download?stream=1`, { credentials: 'include' });
        if (!res.ok || !res.body) throw new Error('http_' + res.status);

        const total = Number(res.headers.get('Content-Length') || 0);
        const reader = res.body.getReader();
        const chunks = [];
        let received = 0;
        if (!total) setIndeterminate();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (total) setProgress(received / total);
        }
        const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
        if (total) setProgress(1);
        saveBlob(blob, filename);
        markInstalledStored(app.slug);
        S.addToDownloadHistory(app);
        showInstalled();
        toast('اكتمل التحميل وحُفظ الملف في جهازك', 'success');
      } catch (e) {
        // Streaming failed (network/limits) — fall back to a normal download so
        // the user still gets the file, and don't fake an "installed" state.
        fallbackDownload(app.slug);
        S.addToDownloadHistory(app);
        showIdle();
        toast('تعذّر عرض شريط التقدّم، وبدأ التنزيل بالطريقة العادية', 'info');
      }
    }

    btn.addEventListener('click', runInstall);
    if (isInstalled(app.slug)) showInstalled();

    // Split dropdown attached to the install button: request-update / report.
    const menu = el('div', { class: 'install-menu' },
      el('button', { class: 'install-menu-item', type: 'button', onclick: () => { toggleMenu(false); openRequestUpdate(app); } },
        ico('refresh', 'icon'), 'طلب تحديث'),
      el('button', { class: 'install-menu-item', type: 'button', onclick: () => { toggleMenu(false); openReport(app); } },
        ico('flag', 'icon'), 'إبلاغ عن مشكلة'),
    );
    const caret = el('button', { class: 'btn btn-primary btn-lg install-caret', type: 'button', 'aria-label': 'خيارات إضافية' }, ico('chevronDown', 'icon'));
    const group = el('div', { class: 'install-group' }, btn, caret, menu);

    function toggleMenu(force) {
      const open = typeof force === 'boolean' ? force : !group.classList.contains('menu-open');
      group.classList.toggle('menu-open', open);
    }
    caret.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
    document.addEventListener('click', (e) => { if (!group.contains(e.target)) toggleMenu(false); });

    return el('div', { class: 'd-actions' }, group);
  }

  function ratingSection(app) {
    let fingerprint = null, voted = false, myRating = 0, selected = 0;
    let reviews = [];

    const avg = S.ratingValue(app);
    const initialCount = S.ratingCountOf(app);
    const user = S.getUser ? S.getUser() : null;

    const big = el('div', { class: 'rate-big' }, initialCount > 0 ? avg.toFixed(1) : '—');
    const avgBar = starBar(avg);
    const count = el('div', { class: 'rate-meta' },
      initialCount > 0 ? `${formatNum(initialCount)} تقييم` : 'كن أول من يقيّم هذا التطبيق');

    // Rating distribution (5 → 1)
    const distRows = el('div', { class: 'rate-dist' });
    function renderDist(dist, total) {
      distRows.innerHTML = '';
      for (let s = 5; s >= 1; s--) distRows.append(distRow(s, Number((dist && dist[s]) || 0), total));
    }
    renderDist({}, 0);

    function refreshAverage(ratingAvg, ratingCount) {
      big.textContent = ratingCount > 0 ? Number(ratingAvg).toFixed(1) : '—';
      const fresh = starBar(ratingAvg);
      avgBar.replaceChildren(...fresh.childNodes);
      count.textContent = ratingCount > 0 ? `${formatNum(ratingCount)} تقييم` : 'كن أول من يقيّم هذا التطبيق';
    }

    // Interactive star picker (1–5). Text glyphs so stars are always visible/tappable.
    const icons = [];
    const picker = el('div', { class: 'rate-input' });
    function paint(n) {
      icons.forEach((sp, idx) => {
        const on = idx < n;
        sp.classList.toggle('on', on);
        sp.textContent = on ? '★' : '☆';
      });
    }
    for (let i = 1; i <= 5; i++) {
      const sp = el('span', { class: 'star-pick' }, '☆');
      sp.setAttribute('role', 'button');
      sp.setAttribute('aria-label', `${i} نجوم`);
      sp.addEventListener('mouseenter', () => { if (!voted) paint(i); });
      sp.addEventListener('mouseleave', () => paint(voted ? myRating : selected));
      sp.addEventListener('click', () => {
        if (voted) { toast('لقد قيّمت هذا التطبيق مسبقاً', 'info'); return; }
        selected = i; paint(i);
      });
      icons.push(sp);
      picker.append(sp);
    }
    const pickerHint = el('div', { style: { fontSize: '14px', marginBottom: '8px' } }, 'قيّم واكتب مراجعتك');

    // Review form — reviews are tied to the signed-in Google account, so the
    // reviewer identity (name + photo) is shown and submitted automatically.
    const accountName = (user && (user.displayName || user.email)) || 'مستخدم';
    const accountPhoto = (user && user.photoURL) || '';
    const accountUid = (user && user.uid) || '';
    const idAvatar = el('div', { class: 'avatar' });
    if (accountPhoto) idAvatar.append(el('img', { src: accountPhoto, alt: '', referrerpolicy: 'no-referrer' }));
    else idAvatar.textContent = (accountName.trim().charAt(0) || 'م').toUpperCase();
    const identity = el('div', { class: 'review-identity' },
      idAvatar,
      el('div', { class: 'who' }, el('div', { class: 'nm' }, accountName), el('div', { class: 'dt' }, 'تنشر باسم حسابك')),
    );
    const commentInput = el('textarea', { class: 'field', maxlength: '2000', placeholder: 'شارك رأيك في هذا التطبيق…' });
    const submitBtn = el('button', { class: 'btn btn-primary' }, 'نشر المراجعة');
    submitBtn.addEventListener('click', () => submit());
    const form = el('div', { class: 'review-form' }, identity, commentInput, el('div', { class: 'actions' }, submitBtn));

    // Reviews list
    const reviewsList = el('div', { class: 'reviews' });
    function renderReviews(list) {
      reviewsList.innerHTML = '';
      if (!list || !list.length) {
        reviewsList.append(el('div', { class: 'reviews-empty' }, 'لا توجد مراجعات بعد. كن أول من يكتب مراجعة!'));
        return;
      }
      list.forEach((r) => reviewsList.append(reviewCard(r)));
    }
    renderReviews([]);

    function lockVoted(rating, comment) {
      voted = true; myRating = rating; selected = rating;
      paint(myRating);
      picker.classList.add('voted');
      pickerHint.textContent = myRating ? `تقييمك: ${myRating} من 5` : 'لقد قيّمت هذا التطبيق';
      commentInput.value = '';
      commentInput.disabled = true; submitBtn.disabled = true;
      submitBtn.textContent = 'تم نشر مراجعتك';
    }

    // Initial load — my vote state.
    (async () => {
      try {
        fingerprint = await getFingerprint();
        const res = await window.Store.api(`/api/apps/${encodeURIComponent(app.slug)}/star-check`, { method: 'POST', body: { fp: fingerprint, uid: accountUid } });
        if (res.voted) lockVoted(Number(res.my_rating || 0), res.my_comment || '');
        if (typeof res.rating === 'number') refreshAverage(res.rating, Number(res.rating_count || 0));
      } catch {}
    })();

    // Initial load — reviews list + distribution.
    async function loadReviews() {
      try {
        const res = await window.Store.api(`/api/apps/${encodeURIComponent(app.slug)}/reviews`);
        reviews = res.reviews || [];
        renderReviews(reviews);
        renderDist(res.dist || {}, Number(res.rating_count || 0));
        if (typeof res.rating === 'number') refreshAverage(res.rating, Number(res.rating_count || 0));
      } catch {}
    }
    loadReviews();

    async function submit() {
      if (voted) { toast('لقد قيّمت هذا التطبيق مسبقاً', 'info'); return; }
      if (!selected) { toast('اختر عدد النجوم أولاً', 'info'); return; }
      submitBtn.disabled = true;
      const myComment = commentInput.value.trim();
      const myName = accountName;
      try {
        if (!fingerprint) fingerprint = await getFingerprint();
        const res = await window.Store.api(`/api/apps/${encodeURIComponent(app.slug)}/star`, {
          method: 'POST',
          body: { fp: fingerprint, rating: selected, comment: myComment, name: myName, uid: accountUid, photo_url: accountPhoto },
        });
        const rated = selected;
        lockVoted(rated, myComment);
        refreshAverage(res.rating, Number(res.rating_count || 0));
        if (res.review || myComment) {
          reviews.unshift(res.review || { name: myName || 'مستخدم', rating: rated, comment: myComment, photo_url: accountPhoto || null, ts: Math.floor(Date.now() / 1000) });
          renderReviews(reviews);
        }
        loadReviews();
        toast('شكراً لمراجعتك!', 'success');
      } catch (e) {
        submitBtn.disabled = false;
        if (e && e.status === 409) {
          lockVoted(selected, myComment);
          toast('لقد قيّمت هذا التطبيق مسبقاً', 'info');
          if (e.data && typeof e.data.rating === 'number') refreshAverage(e.data.rating, Number(e.data.rating_count || 0));
        } else if (e && e.data && e.data.error === 'invalid_rating') {
          toast('اختر عدد النجوم أولاً', 'info');
        } else {
          toast('تعذّر إرسال المراجعة', 'error');
        }
      }
    }

    return el('div', { class: 'd-section' },
      el('h3', null, 'التقييمات والمراجعات'),
      el('div', { class: 'rate-summary' },
        el('div', { class: 'rate-side' }, big, avgBar, count),
        distRows,
      ),
      el('div', { style: { marginTop: '18px' } },
        pickerHint,
        picker,
        form,
      ),
      reviewsList,
    );
  }
})();
