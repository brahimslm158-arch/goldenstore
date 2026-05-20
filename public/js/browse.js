(async function () {
  const { api, el, ico, appCard, getQuery, setQuery, formatNum } = window.GS;
  const grid = document.getElementById('grid');
  const chips = document.getElementById('category-chips');
  const sortSelect = document.getElementById('sort-select');
  const featuredToggle = document.getElementById('featured-toggle');
  const loadMoreBtn = document.getElementById('load-more');
  const pageTitle = document.getElementById('page-title');
  const resultCount = document.getElementById('result-count');

  let cats = [];
  let state = {
    q: getQuery('q'),
    category: getQuery('category'),
    sort: getQuery('sort') || 'recent',
    featured: getQuery('featured') === '1',
    offset: 0,
    limit: 24,
    total: 0,
  };

  sortSelect.value = state.sort;
  featuredToggle.checked = state.featured;

  function updateTitle() {
    if (state.q) pageTitle.textContent = `نتائج البحث عن «${state.q}»`;
    else if (state.featured) pageTitle.textContent = 'التطبيقات المميزة';
    else if (state.category) {
      const c = cats.find((x) => x.slug === state.category);
      pageTitle.textContent = c ? c.name : 'تصفّح';
    } else pageTitle.textContent = 'جميع التطبيقات';
  }

  function renderChips() {
    chips.innerHTML = '';
    const all = el('button', { class: `chip ${!state.category ? 'active' : ''}`, onclick: () => onChip('') },
      'الكل');
    chips.append(all);
    cats.forEach((c) => {
      chips.append(el('button', {
        class: `chip ${state.category === c.slug ? 'active' : ''}`,
        onclick: () => onChip(c.slug),
      }, ico(c.icon), c.name));
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
    loadApps(true);
  });
  featuredToggle.addEventListener('change', () => {
    state.featured = featuredToggle.checked;
    state.offset = 0;
    setQuery({ featured: state.featured ? '1' : null });
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
    if (state.featured) params.set('featured', '1');
    params.set('limit', String(state.limit));
    params.set('offset', String(state.offset));
    try {
      const { apps, total } = await api(`/api/apps?${params}`);
      state.total = total;
      resultCount.textContent = `${formatNum(total)} تطبيق`;
      if (reset) grid.innerHTML = '';
      if (!apps.length && reset) {
        grid.append(el('div', { class: 'empty-state' },
          ico('search', 'icon icon-xxl'),
          el('h3', null, 'لا توجد نتائج'),
          el('p', null, 'جرّب تغيير الفلاتر أو كلمة البحث.'),
        ));
        loadMoreBtn.classList.add('hidden');
        return;
      }
      apps.forEach((a) => grid.append(appCard(a)));
      if (state.offset + apps.length < total) loadMoreBtn.classList.remove('hidden');
      else loadMoreBtn.classList.add('hidden');
    } catch (e) {
      if (reset) grid.innerHTML = '';
      grid.append(el('div', { class: 'empty-state' },
        ico('info', 'icon icon-xxl'),
        el('p', null, 'تعذر التحميل. حاول لاحقاً.'),
      ));
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
