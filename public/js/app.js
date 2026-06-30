// App detail page — Google Play–style.
(function () {
  const S = window.Store;
  const { el, ico, api, getQuery, formatBytes, formatNum, formatCount, formatDate, ratingOf, toast, t } = S;
  const root = document.getElementById('root');
  S.bottomNav('');

  const slug = getQuery('slug');

  function sdkName(sdk) {
    const map = { 21: t('أندرويد') + ' 5.0', 22: '5.1', 23: '6.0', 24: '7.0', 25: '7.1', 26: '8.0', 27: '8.1', 28: '9', 29: '10', 30: '11', 31: '12', 32: '12L', 33: '13', 34: '14', 35: '15' };
    return map[sdk] || (sdk ? `SDK ${sdk}` : '—');
  }

  function openModal(src) {
    const m = el('div', { class: 'modal', onclick: (e) => { if (e.target === m) m.remove(); } },
      el('button', { class: 'close', 'aria-label': t('إغلاق'), onclick: () => m.remove() }, ico('close')),
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

    const menuBtn = el('button', { class: 'icon-btn', 'aria-label': t('مشاركة'), onclick: () => share() }, ico('share'));
    const nav = S.topbarNav('', [menuBtn]);
    root.append(nav);
    const content = el('div', { class: 'detail' });
    root.append(content);
    content.append(S.skeletonDetail());

    function share() {
      const url = location.href;
      if (navigator.share) navigator.share({ url }).catch(() => {});
      else { navigator.clipboard && navigator.clipboard.writeText(url); toast(t('تم نسخ الرابط'), 'success'); }
    }

    if (!slug) { content.innerHTML = ''; content.append(S.emptyState(t('لا يوجد تطبيق محدد'), t('الرابط غير صحيح.'), 'info')); return; }

    let app, screenshots;
    try {
      const data = await api(`/api/apps/${encodeURIComponent(slug)}`);
      app = data.app; screenshots = data.screenshots || [];
    } catch (e) {
      content.innerHTML = '';
      const errTitle = (e && (e.status === 0 || e.message === 'timeout')) ? t('تعذّر الاتصال بالخادم') : t('التطبيق غير موجود');
      content.append(S.emptyState(errTitle, t('تأكد من الرابط أو عُد للرئيسية.'), 'info'),
        el('div', { style: { textAlign: 'center', marginTop: '16px' } }, el('a', { class: 'btn btn-primary', href: '/' }, t('العودة للرئيسية'))));
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
        el('div', { class: 'd-sub' }, [S.categoryName(app.category), t('يحتوي على عمليات شراء داخل التطبيق')].filter(Boolean).join(' • ')),
      ),
    ));

    // Stats row
    const rt = ratingOf(app);
    content.append(el('div', { class: 'd-stats' },
      stat(rt ? el('span', null, rt, ico('star', 'icon fill')) : el('span', null, t('جديد')), t('تقييم')),
      stat(formatCount(app.downloads), t('تنزيلات')),
      stat(formatBytes(app.size_bytes || 0), t('الحجم')),
      stat(sdkName(app.min_sdk), t('أندرويد')),
    ));

    // Actions — animated install with a smooth progress bar.
    content.append(installControl(app));
    content.append(el('div', { class: 'd-note' }, t('سيتم تنزيل ملف APK') + ` (${formatBytes(app.size_bytes || 0)}). ` + t('فعّل «تثبيت من مصادر غير معروفة» لإكمال التثبيت.')));

    // Screenshots
    if (screenshots.length) {
      const shots = el('div', { class: 'shots' });
      screenshots.forEach((s) => { if (s.url) shots.append(el('img', { src: s.url, alt: '', loading: 'lazy', onclick: () => openModal(s.url) })); });
      content.append(el('div', { class: 'd-section' }, shots));
    }

    // About
    if (app.short_description || app.description) {
      content.append(el('div', { class: 'd-section' },
        el('h3', null, t('لمحة عن هذا التطبيق')),
        el('div', { class: 'd-desc' }, app.description || app.short_description),
      ));
    }

    // Tags
    content.append(el('div', { class: 'chip-row' },
      app.category ? el('span', { class: 'chip' }, S.categoryName(app.category)) : null,
      el('span', { class: 'chip' }, t('الإصدار') + ' ' + (app.version_name || '—')),
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
      const simTitle = app.type === 'game' ? t('ألعاب مماثلة') : t('تطبيقات مماثلة');
      const row = el('div', { class: 'hrow' });
      similar.forEach((a) => row.append(S.posterCard(a)));
      container.append(el('div', { class: 'd-section' },
        el('h3', null, simTitle),
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
          el('div', { class: 'nm' }, r.name || t('مستخدم')),
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
        if (f.required && !values[f.key]) { errLine.textContent = t('يرجى ملء الحقول المطلوبة'); inputs[f.key].focus(); return; }
      }
      submitBtn.disabled = true; errLine.textContent = '';
      try { await onSubmit(values); close(); toast(t('تم إرسال طلبك إلى الإدارة'), 'success'); }
      catch (e) { submitBtn.disabled = false; errLine.textContent = t('تعذّر الإرسال، حاول مجدداً'); }
    });

    const card = el('div', { class: 'dialog-card', dir: 'rtl' },
      el('div', { class: 'dialog-head' },
        el('div', { class: 'dialog-title' }, ico(icon, 'icon'), title),
        el('button', { class: 'dialog-close', 'aria-label': t('إغلاق'), onclick: () => close() }, ico('close')),
      ),
      body,
      errLine,
      el('div', { class: 'dialog-actions' },
        el('button', { class: 'btn btn-secondary', onclick: () => close() }, t('إلغاء')),
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
      icon: 'refresh', title: t('طلب تحديث'), submitLabel: t('إرسال الطلب'),
      fields: [
        { key: 'current', label: t('الإصدار الحالي'), value: app.version_name || '—', readonly: true },
        { key: 'new_version', label: t('الإصدار الجديد'), required: true, placeholder: 'مثال: 2.5.1', maxlength: '60' },
        { key: 'source', label: t('رابط المصدر'), placeholder: 'مثال: https://play.google.com/...', maxlength: '500' },
      ],
      onSubmit: (v) => api(`/api/apps/${encodeURIComponent(app.slug)}/request-update`, {
        method: 'POST', body: { new_version: v.new_version, source: v.source },
      }),
    });
  }

  function openReport(app) {
    openDialog({
      icon: 'flag', title: t('إبلاغ عن التطبيق'), submitLabel: t('إرسال البلاغ'),
      fields: [
        { key: 'reason', label: t('سبب البلاغ'), required: true, type: 'select',
          options: [t('التطبيق فيه فيروس'), t('رابط التحميل لا يعمل'), t('محتوى غير لائق'), t('انتهاك حقوق نشر'), t('معلومات خاطئة'), t('سبب آخر')] },
        { key: 'details', label: t('تفاصيل إضافية'), type: 'textarea', placeholder: 'اشرح المشكلة…', maxlength: '2000' },
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
    const label = el('span', { class: 'install-label', 'data-noi18n': '' }, t('تثبيت'));
    const fill = el('span', { class: 'install-fill' });
    const btn = el('button', { class: 'btn btn-primary btn-lg install-btn', type: 'button' }, fill, label);

    function setProgress(ratio) {
      const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
      fill.style.transition = 'width .15s linear';
      fill.style.width = pct + '%';
      label.textContent = `${t('جارٍ التحميل…')} ${pct}%`;
    }
    function setIndeterminate() {
      btn.classList.add('indeterminate');
      label.textContent = t('جارٍ التحميل…');
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
      label.append(ico('check', 'icon'), document.createTextNode(t('تم التثبيت')));
    }
    function showIdle() {
      resetBar();
      btn.classList.remove('installed');
      btn.disabled = false;
      label.textContent = t('تثبيت');
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
      label.textContent = `${t('جار التحميل…')} 0%`;

      S.setActiveDownload({
        slug: app.slug,
        name: app.name,
        icon_url: app.icon_url || null,
        developer: app.developer || '',
        size_bytes: app.size_bytes || 0,
        progress: 0,
        status: 'downloading',
        started_at: Math.floor(Date.now() / 1000),
      });

      let finished = false;
      let handoffTriggered = false;
      const onHandoff = () => {
        if (finished || handoffTriggered) return;
        handoffTriggered = true;
        try { fallbackDownload(app.slug); } catch {}
      };
      const cleanupHandoffListeners = () => {
        window.removeEventListener('pagehide', onHandoff);
        window.removeEventListener('beforeunload', onHandoff);
      };
      window.addEventListener('pagehide', onHandoff);
      window.addEventListener('beforeunload', onHandoff);

      try {
        const res = await fetch(`/api/apps/${encodeURIComponent(app.slug)}/download?stream=1`, { credentials: 'include' });
        if (!res.ok || !res.body) throw new Error('http_' + res.status);

        const total = Number(res.headers.get('Content-Length') || 0);
        const reader = res.body.getReader();
        const chunks = [];
        let received = 0;
        let lastProgressWrite = 0;
        let lastProgressValue = -1;
        const pushProgress = (value, force = false) => {
          const now = Date.now();
          if (!force && now - lastProgressWrite < 200 && Math.abs(value - lastProgressValue) < 0.02) return;
          lastProgressWrite = now;
          lastProgressValue = value;
          S.updateActiveDownloadProgress(app.slug, value);
        };
        if (!total) {
          setIndeterminate();
          S.updateActiveDownloadProgress(app.slug, -1);
        } else {
          pushProgress(0, true);
        }
        for (;;) {
          const { done: readDone, value } = await reader.read();
          if (readDone) break;
          chunks.push(value);
          received += value.length;
          if (total) {
            setProgress(received / total);
            pushProgress(received / total);
          }
        }
        const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
        if (total) setProgress(1);
        saveBlob(blob, filename);
        finished = true;
        cleanupHandoffListeners();
        S.removeActiveDownload(app.slug);
        markInstalledStored(app.slug);
        S.addToDownloadHistory(app);
        showInstalled();
        toast(t('اكتمل التحميل وحفظ الملف في جهازك'), 'success');
        // Earn points for this download (server prevents duplicates)
        S.earnPoints(app.slug).then((r) => {
          if (r && r.ok && r.earned) toast(`+${r.earned} ${t('نقطة!')} ${t('رصيدك')}: ${r.balance}`, 'success');
        }).catch(() => {});
      } catch (e) {
        // Streaming failed (network/limits) — fall back to a normal download so
        // the user still gets the file, and don't fake an "installed" state.
        finished = true;
        cleanupHandoffListeners();
        fallbackDownload(app.slug);
        S.removeActiveDownload(app.slug);
        S.addToDownloadHistory(app);
        showIdle();
        toast(t('تعذر عرض شريط التقدم، وبدأ التنزيل بالطريقة العادية'), 'info');
        S.earnPoints(app.slug).then((r) => {
          if (r && r.ok && r.earned) toast(`+${r.earned} ${t('نقطة!')} ${t('رصيدك')}: ${r.balance}`, 'success');
        }).catch(() => {});
      }
    }

    btn.addEventListener('click', runInstall);
    if (isInstalled(app.slug)) showInstalled();

    // Split dropdown attached to the install button: request-update / report.
    const menu = el('div', { class: 'install-menu' },
      el('button', { class: 'install-menu-item', type: 'button', onclick: () => { toggleMenu(false); openRequestUpdate(app); } },
        ico('refresh', 'icon'), t('طلب تحديث')),
      el('button', { class: 'install-menu-item', type: 'button', onclick: () => { toggleMenu(false); openReport(app); } },
        ico('flag', 'icon'), t('إبلاغ عن مشكلة')),
    );
    const caret = el('button', { class: 'btn btn-primary btn-lg install-caret', type: 'button', 'aria-label': t('خيارات إضافية') }, ico('chevronDown', 'icon'));
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
      initialCount > 0 ? `${formatNum(initialCount)} ${t('تقييم')}` : t('كن أول من يقيّم هذا التطبيق'));

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
      count.textContent = ratingCount > 0 ? `${formatNum(ratingCount)} ${t('تقييم')}` : t('كن أول من يقيّم هذا التطبيق');
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
      sp.setAttribute('aria-label', `${i} ${t('نجوم')}`);
      sp.addEventListener('mouseenter', () => { if (!voted) paint(i); });
      sp.addEventListener('mouseleave', () => paint(voted ? myRating : selected));
      sp.addEventListener('click', () => {
        if (voted) { toast(t('لقد قيّمت هذا التطبيق مسبقاً'), 'info'); return; }
        selected = i; paint(i);
      });
      icons.push(sp);
      picker.append(sp);
    }
    const pickerHint = el('div', { style: { fontSize: '14px', marginBottom: '8px' } }, t('قيّم واكتب مراجعتك'));

    // Review form — reviews are tied to the signed-in Google account, so the
    // reviewer identity (name + photo) is shown and submitted automatically.
    const accountName = (user && (user.displayName || user.email)) || t('مستخدم');
    const accountPhoto = (user && user.photoURL) || '';
    const accountUid = (user && user.uid) || '';
    const idAvatar = el('div', { class: 'avatar' });
    if (accountPhoto) idAvatar.append(el('img', { src: accountPhoto, alt: '', referrerpolicy: 'no-referrer' }));
    else idAvatar.textContent = (accountName.trim().charAt(0) || 'م').toUpperCase();
    const identity = el('div', { class: 'review-identity' },
      idAvatar,
      el('div', { class: 'who' }, el('div', { class: 'nm' }, accountName), el('div', { class: 'dt' }, t('تنشر باسم حسابك'))),
    );
    const commentInput = el('textarea', { class: 'field', maxlength: '2000', placeholder: t('شارك رأيك في هذا التطبيق…') });
    const submitBtn = el('button', { class: 'btn btn-primary' }, t('نشر المراجعة'));
    submitBtn.addEventListener('click', () => submit());
    const form = el('div', { class: 'review-form' }, identity, commentInput, el('div', { class: 'actions' }, submitBtn));

    // Reviews list — show only 1-2 initially, "show more" opens modal
    const INITIAL_REVIEWS = 2;
    const reviewsList = el('div', { class: 'reviews' });
    const showMoreBtn = el('button', { class: 'btn btn-secondary btn-sm', style: { marginTop: '12px', display: 'none' } }, t('عرض المزيد'));
    showMoreBtn.addEventListener('click', () => openReviewsModal());

    function renderReviews(list) {
      reviewsList.innerHTML = '';
      showMoreBtn.style.display = 'none';
      if (!list || !list.length) {
        reviewsList.append(el('div', { class: 'reviews-empty' }, t('لا توجد مراجعات بعد. كن أول من يكتب مراجعة!')));
        return;
      }
      const visible = list.slice(0, INITIAL_REVIEWS);
      visible.forEach((r) => reviewsList.append(reviewCard(r)));
      if (list.length > INITIAL_REVIEWS) {
        showMoreBtn.style.display = '';
        showMoreBtn.textContent = `${t('عرض المزيد')} (${list.length})`;
      }
    }

    function openReviewsModal() {
      const overlay = el('div', { class: 'dialog-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
      const body = el('div', { class: 'dialog-body', style: { maxHeight: '60vh', overflowY: 'auto' } });
      reviews.forEach((r) => body.append(reviewCard(r)));
      const card = el('div', { class: 'dialog-card' },
        el('div', { class: 'dialog-head' },
          el('div', { class: 'dialog-title' }, ico('star', 'icon'), t('جميع التقييمات والمراجعات')),
          el('button', { class: 'dialog-close', 'aria-label': t('إغلاق'), onclick: () => overlay.remove() }, ico('close')),
        ),
        body,
        el('div', { class: 'dialog-actions' },
          el('button', { class: 'btn btn-secondary', onclick: () => overlay.remove() }, t('عرض أقل')),
        ),
      );
      overlay.append(card);
      document.body.append(overlay);
      document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); } });
    }

    renderReviews([]);

    function lockVoted(rating, comment) {
      voted = true; myRating = rating; selected = rating;
      paint(myRating);
      picker.classList.add('voted');
      pickerHint.textContent = myRating ? `${t('تقييمك')}: ${myRating} ${t('من')} 5` : t('لقد قيّمت هذا التطبيق');
      // Completely hide the input form after voting
      form.style.display = 'none';
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
      if (voted) { toast(t('لقد قيّمت هذا التطبيق مسبقاً'), 'info'); return; }
      if (!selected) { toast(t('اختر عدد النجوم أولاً'), 'info'); return; }
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
          reviews.unshift(res.review || { name: myName || t('مستخدم'), rating: rated, comment: myComment, photo_url: accountPhoto || null, ts: Math.floor(Date.now() / 1000) });
          renderReviews(reviews);
        }
        loadReviews();
        toast(t('شكراً لمراجعتك!'), 'success');
      } catch (e) {
        submitBtn.disabled = false;
        if (e && e.status === 409) {
          lockVoted(selected, myComment);
          toast(t('لقد قيّمت هذا التطبيق مسبقاً'), 'info');
          if (e.data && typeof e.data.rating === 'number') refreshAverage(e.data.rating, Number(e.data.rating_count || 0));
        } else if (e && e.data && e.data.error === 'invalid_rating') {
          toast(t('اختر عدد النجوم أولاً'), 'info');
        } else {
          toast(t('تعذّر إرسال المراجعة'), 'error');
        }
      }
    }

    // Collapsible rating section
    const rateBody = el('div', { class: 'rate-collapse-body' });
    rateBody.append(
      el('div', { style: { marginTop: '18px' } },
        pickerHint,
        picker,
        form,
      ),
      reviewsList,
      showMoreBtn,
    );
    // Initially collapsed
    rateBody.style.maxHeight = '0';
    rateBody.style.overflow = 'hidden';
    rateBody.style.transition = 'max-height .35s ease';

    let rateOpen = false;
    const toggleIcon = ico('chevronDown', 'icon rate-toggle-ico');
    const rateHeader = el('div', { class: 'rate-collapse-header', onclick: () => {
      rateOpen = !rateOpen;
      if (rateOpen) {
        rateBody.style.maxHeight = rateBody.scrollHeight + 2000 + 'px';
        toggleIcon.style.transform = 'rotate(180deg)';
      } else {
        rateBody.style.maxHeight = '0';
        toggleIcon.style.transform = 'rotate(0deg)';
      }
    } },
      el('h3', { style: { margin: '0', flex: '1', cursor: 'pointer' } }, t('التقييمات والمراجعات')),
      toggleIcon,
    );
    toggleIcon.style.transition = 'transform .3s ease';

    // Auto-close after rating: watch for the 'voted' class on picker
    const collapseObserver = new MutationObserver(() => {
      if (picker.classList.contains('voted') && rateOpen) {
        setTimeout(() => {
          rateOpen = false;
          rateBody.style.maxHeight = '0';
          toggleIcon.style.transform = 'rotate(0deg)';
        }, 1500);
      }
    });
    collapseObserver.observe(picker, { attributes: true, attributeFilter: ['class'] });

    return el('div', { class: 'd-section' },
      rateHeader,
      el('div', { class: 'rate-summary' },
        el('div', { class: 'rate-side' }, big, avgBar, count),
        distRows,
      ),
      rateBody,
    );
  }
})();
