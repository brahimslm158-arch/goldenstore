// Home page — Games / Apps tabs with Play-style top tabs (For you / Top charts / Categories).
(function () {
  const S = window.Store;
  const { el, ico, api, getQuery } = S;
  const root = document.getElementById('root');

  const tab = getQuery('tab') === 'apps' ? 'apps' : 'games';
  const isGames = tab === 'games';
  S.bottomNav(tab);

  const TOP_TABS = [
    { key: 'foryou', label: 'محتوى يهمّك' },
    { key: 'top', label: 'قائمة الأكثر رواجًا' },
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

    function baseQuery() { return isGames ? 'category=games' : ''; }

    async function renderContent() {
      content.innerHTML = '';
      content.append(S.spinner());
      try {
        if (topTab === 'categories') return renderCategories();
        if (topTab === 'top') return renderTop();
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
        api(q('sort=recent&limit=20')).catch(() => ({ apps: [] })),
        api(q('sort=popular&limit=20')).catch(() => ({ apps: [] })),
        api(q('sort=stars&limit=20')).catch(() => ({ apps: [] })),
      ]);
      content.innerHTML = '';

      const all = recent.apps || [];
      if (!all.length && !(popular.apps || []).length) {
        content.append(S.emptyState('لا توجد تطبيقات بعد', 'ستظهر هنا تطبيقات المتجر فور إضافتها من لوحة الإدارة.'));
        return;
      }

      // Featured banner from top app
      const feat = (top.apps && top.apps[0]) || (popular.apps && popular.apps[0]) || all[0];
      if (feat) content.append(featureBanner(feat));

      content.append(posterSection(isGames ? 'ألعاب مقترحة لك' : 'موصى به لك', recent.apps));
      content.append(posterSection('الأكثر رواجًا', popular.apps));
      if ((top.apps || []).length) content.append(posterSection('الأعلى تقييماً', top.apps));

      // Recommended list
      content.append(listSection('قد يعجبك أيضاً', (popular.apps || []).slice(0, 8)));
    }

    async function renderTop() {
      const { apps } = await api(q('sort=popular&limit=50'));
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

    async function renderCategories() {
      const { categories } = await api('/api/categories');
      content.innerHTML = '';
      const list = el('div', { class: 'applist', style: { marginTop: '8px' } });
      categories.filter((c) => isGames ? c.slug === 'games' : c.slug !== 'games').forEach((c) => {
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
        background: 'linear-gradient(135deg, #2b2410, #0d0d0f 70%)',
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
