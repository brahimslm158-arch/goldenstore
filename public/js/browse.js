(async function () {
  const { api, el, ico, appCard, getQuery, setQuery, formatNum } = window.GS;
  const { t, catName } = window.GSLang;
  const grid = document.getElementById('grid');
  const chips = document.getElementById('category-chips');
  const sortSelect = document.getElementById('sort-select');
  const loadMoreBtn = document.getElementById('load-more');
  const pageTitle = document.getElementById('page-title');
  const resultCount = document.getElementById('result-count');

  // Translate sort options
  sortSelect.options[0].text = t('sortRecent');
  sortSelect.options[1].text = t('sortPopular');
  sortSelect.options[2].text = t('sortStars');
  sortSelect.options[3].text = t('sortName');
  loadMoreBtn.textContent = t('loadMore');

  let cats = [];
  let state = {
    q: getQuery('q'),
    category: getQuery('category'),
    sort: getQuery('sort') || 'recent',
    offset: 0,
    limit: 24,
    total: 0,
  };

  sortSelect.value = state.sort;

  function updateTitle() {
    if (state.q) pageTitle.textContent = `${t('searchResults')} «${state.q}»`;
    else if (state.sort === 'stars') pageTitle.textContent = t('topRated');
    else if (state.category) {
      pageTitle.textContent = catName(state.category);
    } else pageTitle.textContent = t('allApps');
  }

  function renderChips() {
    chips.innerHTML = '';
    const all = el('button', { class: `chip ${!state.category ? 'active' : ''}`, onclick: () => onChip('') },
      t('all'));
    chips.append(all);
    cats.forEach((c) => {
      chips.append(el('button', {
        class: `chip ${state.category === c.slug ? 'active' : ''}`,
        onclick: () => onChip(c.slug),
      }, ico(c.icon), catName(c.slug)));
    });
  }

  function onChip(slug) {
    state.category = slug;
    state.offset = 0;
    setQuery({ category: slug || null });
    updateTitle();
    renderChips();
    loadApps(true);
  }

  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    state.offset = 0;
    setQuery({ sort: state.sort === 'recent' ? null : state.sort });
    updateTitle();
    loadApps(true);
  });
  loadMoreBtn.addEventListener('click', () => {
    state.offset += state.limit;
    loadApps(false);
  });

  async function loadApps(reset) {
    if (reset) {
      grid.innerHTML = '<div class="center-spinner"><div class="spinner"></div></div>';
    }
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category) params.set('category', state.category);
    if (state.sort) params.set('sort', state.sort);
    params.set('limit', String(state.limit));
    params.set('offset', String(state.offset));
    try {
      const { apps, total } = await api(`/api/apps?${params}`);
      state.total = total;
      resultCount.textContent = `${formatNum(total)} ${t('appCount')}`;
      if (reset) grid.innerHTML = '';
      if (!apps.length && reset) {
        grid.append(el('div', { class: 'empty-state' },
          ico('search', 'icon icon-xxl'),
          el('h3', null, t('noResults')),
          el('p', null, t('noResultsHint')),
        ));
        loadMoreBtn.classList.add('hidden');
        return;
      }
      apps.forEach((a) => {
        grid.append(appCard(a));
      });
      if (state.offset + apps.length < total) loadMoreBtn.classList.remove('hidden');
      else loadMoreBtn.classList.add('hidden');
    } catch (e) {
      if (reset) grid.innerHTML = '';
      let title = t('loadAppsError');
      let detail = t('retryLater');
      if (e && (e.status === 0 || e.message === 'timeout')) {
        title = t('connError');
        detail = t('connHint');
      } else if (e && e.status >= 500) {
        title = t('svcError');
        detail = t('svcHint');
      }
      grid.append(el('div', { class: 'empty-state' },
        ico('info', 'icon icon-xxl'),
        el('h3', null, title),
        el('p', null, detail),
      ));
      loadMoreBtn.classList.add('hidden');
    }
  }

  // Initial load
  try {
    const { categories } = await api('/api/categories');
    cats = categories;
  } catch {}
  updateTitle();
  renderChips();
  loadApps(true);
})();
