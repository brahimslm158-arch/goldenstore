// Home page — single "All apps" feed with Play-style top tabs (For you / Top charts / Categories).
(function () {
  const S = window.Store;
  const { el, ico, api, getQuery, t } = S;
  const root = document.getElementById('root');

  S.bottomNav('apps');

  const TOP_TABS = [
    { key: 'foryou', label: 'محتوى يهمّك' },
    { key: 'top', label: 'الأكثر رواجًا' },
    { key: 'rated', label: 'الأعلى تقييماً' },
    { key: 'categories', label: 'الفئات' },
  ];
  // Translate tab labels at render time so they're instant

  S.ready((user) => {
    root.innerHTML = '';
    root.append(S.topbarSearch(user));

    let topTab = 'foryou';
    const tabsBar = el('div', { class: 'tabs' });
    const content = el('div', { class: 'content' });

    function renderTabs() {
      tabsBar.innerHTML = '';
      TOP_TABS.forEach((t_item) => {
        tabsBar.append(el('button', {
          class: `tab ${t_item.key === topTab ? 'active' : ''}`,
          onclick: () => { if (topTab !== t_item.key) { topTab = t_item.key; renderTabs(); renderContent(); } },
        }, t(t_item.label)));
      });
    }

    root.append(tabsBar, content);
    renderTabs();
    renderContent();

    function baseQuery() { return ''; }
    function filt(apps) { return apps || []; }

    async function renderContent() {
      content.innerHTML = '';
      content.append(topTab === 'categories' ? S.skeletonList() : S.skeletonHome());
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

      // Build a single deduplicated pool of ALL apps
      const seenAll = new Set();
      const allApps = [];
      [...recentApps, ...popularApps, ...topApps].forEach((a) => {
        if (!a || seenAll.has(a.slug)) return;
        seenAll.add(a.slug);
        allApps.push(a);
      });

      if (!allApps.length) {
        content.append(S.emptyState(t('لا توجد تطبيقات بعد'), t('ستظهر هنا تطبيقات المتجر فور إضافتها من لوحة الإدارة.')));
        return;
      }

      const usedSlugs = new Set();

      // Editors' choice carousel (max 6 so more remain for below)
      const carouselApps = pickCarousel(allApps).slice(0, 6);
      if (carouselApps.length) content.append(S.featureCarousel(carouselApps));
      carouselApps.forEach((a) => usedSlugs.add(a.slug));

      // "موصى به لك" — horizontal row (max 8, skip already shown)
      const recPool = (popularApps.length ? popularApps : recentApps).filter((a) => !usedSlugs.has(a.slug));
      const recommended = recPool.slice(0, 8);
      content.append(posterSection(t('موصى به لك'), recommended));
      recommended.forEach((a) => usedSlugs.add(a.slug));

      // Everything else not shown above
      const rest = allApps.filter((a) => !usedSlugs.has(a.slug));

      // "قد يعجبك أيضاً" — short taste (max 5)
      const likeApps = rest.slice(0, 5);
      if (likeApps.length) {
        content.append(listSection(t('قد يعجبك أيضاً'), likeApps));
        likeApps.forEach((a) => usedSlugs.add(a.slug));
      }

      // "تطبيقات أخرى" — everything remaining, 2-col grid/list toggle
      const others = allApps.filter((a) => !usedSlugs.has(a.slug));
      if (others.length) content.append(toggleSection(t('تطبيقات أخرى'), others));
    }

    async function renderTop() {
      const res = await api(q('sort=popular&limit=60'));
      const apps = filt(res.apps).slice(0, 50);
      content.innerHTML = '';
      if (!apps.length) { content.append(S.emptyState(t('لا توجد تطبيقات بعد'))); return; }
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
      if (!apps.length) { content.append(S.emptyState(t('لا توجد تطبيقات مقيّمة بعد'), t('قيّم التطبيقات لتظهر هنا الأعلى تقييماً.'))); return; }
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
            el('div', { class: 'sub' }, `${c.count || 0} ${t('تطبيق')}`),
          ),
          ico('chevronStart', 'icon'),
        ));
      });
      content.append(el('div', { class: 'section' }, list));
    }
  });

  // Choose carousel apps: prefer those with a feature graphic, de-duplicated,
  // then top up with the best remaining apps so the carousel is never empty.
  function pickCarousel(pool) {
    const seen = new Set();
    const withFeat = [];
    const without = [];
    pool.forEach((a) => {
      if (!a || seen.has(a.slug)) return;
      seen.add(a.slug);
      (a.feature_url ? withFeat : without).push(a);
    });
    return [...withFeat, ...without].slice(0, 8);
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

  // Section with a vertical (list) / grid (2-col icons) view switch.
  const VIEW_KEY = 'gs_home_view';
  function toggleSection(title, apps) {
    if (!apps || !apps.length) return el('span');
    let mode = localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';

    const body = el('div');
    const gridBtn = el('button', { type: 'button', 'aria-label': t('شبكة'), title: t('شبكة') }, ico('grid', 'icon'));
    const listBtn = el('button', { type: 'button', 'aria-label': t('قائمة'), title: t('قائمة') }, ico('list', 'icon'));

    function render() {
      body.innerHTML = '';
      gridBtn.classList.toggle('on', mode === 'grid');
      listBtn.classList.toggle('on', mode === 'list');
      if (mode === 'grid') {
        // 2-column grid with compact list rows
        const grid = el('div', { class: 'applist two-col' });
        apps.forEach((a) => grid.append(window.Store.listRow(a)));
        body.append(grid);
      } else {
        // Single column list
        const list = el('div', { class: 'applist' });
        apps.forEach((a) => list.append(window.Store.listRow(a)));
        body.append(list);
      }
    }
    function setMode(m) { if (m === mode) return; mode = m; try { localStorage.setItem(VIEW_KEY, m); } catch (e) {} render(); }
    gridBtn.onclick = () => setMode('grid');
    listBtn.onclick = () => setMode('list');

    render();
    return el('div', { class: 'section' },
      el('div', { class: 'section-head' },
        el('h2', null, title),
        el('div', { class: 'view-toggle' }, gridBtn, listBtn),
      ),
      body,
    );
  }
})();
