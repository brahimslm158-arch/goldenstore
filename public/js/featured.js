// Featured page — editor's choice & curated picks.
(function () {
  const S = window.Store;
  const { el, ico, api } = S;
  const root = document.getElementById('root');

  S.bottomNav('featured');

  S.ready((user) => {
    root.innerHTML = '';
    root.append(S.topbarSearch(user));

    const content = el('div', { class: 'content' });
    root.append(content);
    content.append(S.spinner());
    render(content);
  });

  async function render(content) {
    try {
      const [top, popular, recent] = await Promise.all([
        api('/api/apps?sort=rating&limit=20').catch(() => ({ apps: [] })),
        api('/api/apps?sort=popular&limit=20').catch(() => ({ apps: [] })),
        api('/api/apps?sort=recent&limit=20').catch(() => ({ apps: [] })),
      ]);
      content.innerHTML = '';

      const topApps = top.apps || [];
      const popApps = popular.apps || [];
      if (!topApps.length && !popApps.length) {
        content.append(S.emptyState('لا توجد تطبيقات مميّزة بعد', 'ستظهر هنا اختيارات المحرّرين فور إضافتها.'));
        return;
      }

      content.append(el('div', { class: 'page-title' }, 'المميّزة'));

      const feat = topApps[0] || popApps[0];
      if (feat) content.append(featureBanner(feat));

      content.append(posterSection('اختيارات المحرّرين', topApps));
      content.append(listSection('الأكثر رواجًا', popApps.slice(0, 8)));
      content.append(posterSection('جديد ومُحدَّث', recent.apps));
    } catch (err) {
      content.innerHTML = '';
      content.append(S.errorState(err));
    }
  }

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
    apps.forEach((a) => row.append(S.posterCard(a)));
    return el('div', { class: 'section' },
      el('div', { class: 'section-head' }, el('h2', null, title), ico('chevronStart', 'icon more')),
      row,
    );
  }

  function listSection(title, apps) {
    if (!apps || !apps.length) return el('span');
    const list = el('div', { class: 'applist' });
    apps.forEach((a) => list.append(S.listRow(a)));
    return el('div', { class: 'section' },
      el('div', { class: 'section-head' }, el('h2', null, title)),
      list,
    );
  }
})();
