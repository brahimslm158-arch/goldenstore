// Search page — live search + category browse.
(function () {
  const S = window.Store;
  const { el, ico, api, getQuery } = S;
  const root = document.getElementById('root');
  S.bottomNav('search');

  S.ready((user) => {
    root.innerHTML = '';
    const initialQ = getQuery('q');
    const initialCat = getQuery('category');

    const input = el('input', {
      class: 'ph', type: 'search', placeholder: 'ابحث عن التطبيقات والألعاب',
      value: initialQ, autocomplete: 'off',
      style: { background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', flex: '1', fontSize: '15px' },
    });
    const bar = el('div', { class: 'topbar' },
      el('div', { class: 'search-pill' },
        el('button', { class: 's-ico', 'aria-label': 'رجوع', onclick: () => history.length > 1 ? history.back() : (location.href = '/') }, ico('chevronEnd')),
        input,
        el('button', { class: 's-ico', 'aria-label': 'مسح', onclick: () => { input.value = ''; input.focus(); run(); } }, ico('close')),
      ),
    );
    const results = el('div', { class: 'content' });
    root.append(bar, results);

    let timer = null;
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 300); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(timer); run(); } });

    async function run() {
      const q = input.value.trim();
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (!q && initialCat) params.set('category', initialCat);
      params.set('limit', '40');
      params.set('sort', q ? 'popular' : 'recent');

      if (!q && !initialCat) { showSuggestions(); return; }

      results.innerHTML = '';
      results.append(S.spinner());
      try {
        const { apps } = await api(`/api/apps?${params.toString()}`);
        results.innerHTML = '';
        if (!apps.length) {
          results.append(S.emptyState('لا توجد نتائج', q ? `لم نجد تطبيقات تطابق «${q}».` : 'لا توجد تطبيقات في هذه الفئة بعد.', 'search'));
          return;
        }
        const head = el('div', { class: 'section-head', style: { marginTop: '12px' } },
          el('h2', null, q ? 'نتائج البحث' : (S.categoryName(initialCat) || 'تصفّح')));
        const list = el('div', { class: 'applist' });
        apps.forEach((a) => list.append(S.listRow(a)));
        results.append(head, list);
      } catch (err) {
        results.innerHTML = '';
        results.append(S.errorState(err));
      }
    }

    async function showSuggestions() {
      results.innerHTML = '';
      results.append(S.spinner());
      try {
        const { categories } = await api('/api/categories');
        results.innerHTML = '';
        results.append(el('div', { class: 'section-head', style: { marginTop: '12px' } }, el('h2', null, 'تصفّح حسب الفئة')));
        const list = el('div', { class: 'applist' });
        categories.forEach((c) => {
          list.append(el('a', { href: `/search?category=${c.slug}`, class: 'approw' },
            el('div', { class: 'art', style: { background: 'var(--surface-2)' } }, ico(c.icon, 'icon icon-lg')),
            el('div', { class: 'info' }, el('div', { class: 'nm' }, c.name), el('div', { class: 'sub' }, `${c.count || 0} تطبيق`)),
            ico('chevronStart', 'icon'),
          ));
        });
        results.append(list);
      } catch (err) {
        results.innerHTML = '';
        results.append(S.errorState(err));
      }
    }

    if (initialQ || initialCat) run(); else showSuggestions();
    if (!initialQ) input.focus();
  });
})();
