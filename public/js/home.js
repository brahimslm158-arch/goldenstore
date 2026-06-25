// Home page — single "All apps" feed with Play-style top tabs (For you / Top charts / Categories).
(function () {
  const S = window.Store;
  const { el, ico, api, getQuery } = S;
  const root = document.getElementById('root');

  S.bottomNav('apps');

  const TOP_TABS = [
    { key: 'foryou', label: 'محتوى يهمّك' },
    { key: 'top', label: 'الأكثر رواجًا' },
    { key: 'rated', label: 'الأعلى تقييماً' },
    { key: 'categories', label: 'الفئات' },
  ];

  S.ready((user) => {
    root.innerHTML = '';
    root.append(S.topbarSearch(user));

    let topTab = 'foryou';
    const tabsBar = el('div', { class: 'tabs' });
    const content = el('div', { class: 'content' });

    function renderTabs() {
      tabsBar.innerHTML = '';
      TOP_TABS.forEach((t) => {
        tabsBar.append(el('button', {
          class: `tab ${t.key === topTab ? 'active' : ''}`,
          onclick: () => { if (topTab !== t.key) { topTab = t.key; renderTabs(); renderContent(); } },
        }, t.label));
      });
    }

    root.append(tabsBar, content);
    renderTabs();
    renderContent();

    function baseQuery() { return ''; }
    function filt(apps) { return apps || []; }

    async function renderContent() {
      content.innerHTML = '';
      content.append(S.spinner());
      try {
        if (topTab === 'categories') return renderCategories();
        if (topTab === 'top') return renderTop();
        if (topTab === 'rated') return renderTopRated();
        return renderForYou();
      } catch (err) {
        content.innerHTML = '';
        content.append(S.errorState(err));
      }
    }

    function q(params) {
      const base = baseQuery();
      return `/api/apps?${base ? base + '&' : ''}${params}`;
    }

    async function renderForYou() {
      const [recent, popular, top] = await Promise.all([
        api(q('sort=recent&limit=60')).catch(() => ({ apps: [] })),
        api(q('sort=popular&limit=30')).catch(() => ({ apps: [] })),
        api(q('sort=rating&limit=30')).catch(() => ({ apps: [] })),
      ]);
      content.innerHTML = '';

      const recentApps = filt(recent.apps);
      const popularApps = filt(popular.apps);
      const topApps = filt(top.apps);

      if (!recentApps.length && !popularApps.length) {
        content.append(S.emptyState('لا توجد تطبيقات بعد', 'ستظهر هنا تطبيقات المتجر فور إضافتها من لوحة الإدارة.'));
        return;
      }

      // Featured banner from the top-rated (then popular, then recent) app.
      const feat = topApps[0] || popularApps[0] || recentApps[0];
      if (feat) content.append(featureBanner(feat));

      // "موصى به لك" — a curated horizontal row (most popular picks).
      const recommended = (popularApps.length ? popularApps : recentApps).slice(0, 12);
      content.append(posterSection('موصى به لك', recommended));

      // "قد يعجبك أيضاً" — every other app not already shown above
      // (الأكثر رواجًا / الأعلى تقييماً now live in their own tabs).
      const usedSlugs = new Set(recommended.map((a) => a.slug));
      if (feat) usedSlugs.add(feat.slug);
      const rest = recentApps.filter((a) => !usedSlugs.has(a.slug));
      content.append(listSection('قد يعجبك أيضاً', rest));
    }

    async function renderTop() {
      const res = await api(q('sort=popular&limit=60'));
      const apps = filt(res.apps).slice(0, 50);
      content.innerHTML = '';
      if (!apps.length) { content.append(S.emptyState('لا توجد تطبيقات بعد')); return; }
      const list = el('div', { class: 'applist' });
      apps.forEach((a, i) => {
        const row = S.listRow(a);
        const rank = el('div', { style: { width: '24px', textAlign: 'center', fontWeight: '700', color: 'var(--text-2)', fontSize: '15px', flexShrink: '0' } }, String(i + 1));
        row.insertBefore(rank, row.firstChild);
        list.append(row);
      });
      content.append(el('div', { class: 'section' }, list));
    }

    async function renderTopRated() {
      const res = await api(q('sort=rating&limit=60'));
      const apps = filt(res.apps).filter((a) => S.ratingCountOf(a) > 0).slice(0, 50);
      content.innerHTML = '';
      if (!apps.length) { content.append(S.emptyState('لا توجد تطبيقات مقيّمة بعد', 'قيّم التطبيقات لتظهر هنا الأعلى تقييماً.')); return; }
      const list = el('div', { class: 'applist' });
      apps.forEach((a, i) => {
        const row = S.listRow(a);
        const rank = el('div', { style: { width: '24px', textAlign: 'center', fontWeight: '700', color: 'var(--text-2)', fontSize: '15px', flexShrink: '0' } }, String(i + 1));
        row.insertBefore(rank, row.firstChild);
        list.append(row);
      });
      content.append(el('div', { class: 'section' }, list));
    }

    async function renderCategories() {
      const { categories } = await api('/api/categories');
      content.innerHTML = '';
      const list = el('div', { class: 'applist', style: { marginTop: '8px' } });
      categories.forEach((c) => {
        list.append(el('a', { href: `/search?category=${c.slug}`, class: 'approw' },
          el('div', { class: 'art', style: { background: 'var(--surface-2)' } }, ico(c.icon, 'icon icon-lg')),
          el('div', { class: 'info' },
            el('div', { class: 'nm' }, c.name),
            el('div', { class: 'sub' }, `${c.count || 0} تطبيق`),
          ),
          ico('chevronStart', 'icon'),
        ));
      });
      content.append(el('div', { class: 'section' }, list));
    }
  });

  function featureBanner(a) {
    return el('a', { href: `/app?slug=${encodeURIComponent(a.slug)}`, class: 'feature' },
      el('div', { class: 'ftimg', style: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #10233f, #0d0d0f 70%)',
      } },
        a.icon_url
          ? el('img', { src: a.icon_url, alt: '', style: { width: '120px', height: '120px', borderRadius: '28px', boxShadow: '0 16px 40px rgba(0,0,0,.5)' } })
          : ico('package', 'icon icon-lg')),
      el('div', { class: 'pill' }, 'اختيارات المحرّرين'),
      el('div', { class: 'ftbody' },
        el('h3', null, a.name),
        el('p', null, a.short_description || a.developer || 'تطبيق مميّز مختار لك'),
        el('span', { class: 'btn btn-primary ftbtn' }, 'عرض'),
      ),
    );
  }

  function posterSection(title, apps) {
    if (!apps || !apps.length) return el('span');
    const row = el('div', { class: 'hrow' });
    apps.forEach((a) => row.append(window.Store.posterCard(a)));
    return el('div', { class: 'section' },
      el('div', { class: 'section-head' }, el('h2', null, title), ico('chevronStart', 'icon more')),
      row,
    );
  }

  function listSection(title, apps) {
    if (!apps || !apps.length) return el('span');
    const list = el('div', { class: 'applist' });
    apps.forEach((a) => list.append(window.Store.listRow(a)));
    return el('div', { class: 'section' },
      el('div', { class: 'section-head' }, el('h2', null, title)),
      list,
    );
  }
})();
