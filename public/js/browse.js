(async function () {
  const { api, el, ico, appCard, getQuery, setQuery, formatNum } = window.GS;
  const grid = document.getElementById('grid');
  const chips = document.getElementById('category-chips');
  const sortSelect = document.getElementById('sort-select');
  const loadMoreBtn = document.getElementById('load-more');
  const pageTitle = document.getElementById('page-title');
  const resultCount = document.getElementById('result-count');

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
    if (state.q) pageTitle.textContent = 'نتائج البحث عن «' + state.q + '»';
    else if (state.sort === 'stars') pageTitle.textContent = 'الأعلى تقييماً';
    else if (state.category) {
      var c = cats.find(function(x) { return x.slug === state.category; });
      pageTitle.textContent = c ? c.name : 'تصفّح';
    } else pageTitle.textContent = 'جميع التطبيقات';
  }

  function renderChips() {
    chips.innerHTML = '';
    var all = el('button', { class: 'chip' + (!state.category ? ' active' : ''), onclick: function() { onChip(''); } },
      'الكل');
    chips.append(all);
    cats.forEach(function(c) {
      chips.append(el('button', {
        class: 'chip' + (state.category === c.slug ? ' active' : ''),
        onclick: function() { onChip(c.slug); },
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

  sortSelect.addEventListener('change', function() {
    state.sort = sortSelect.value;
    state.offset = 0;
    setQuery({ sort: state.sort === 'recent' ? null : state.sort });
    updateTitle();
    loadApps(true);
  });
  loadMoreBtn.addEventListener('click', function() {
    state.offset += state.limit;
    loadApps(false);
  });

  async function loadApps(reset) {
    if (reset) {
      grid.innerHTML = '<div class="center-spinner"><div class="spinner"></div></div>';
    }
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category) params.set('category', state.category);
    if (state.sort) params.set('sort', state.sort);
    params.set('limit', String(state.limit));
    params.set('offset', String(state.offset));
    try {
      var data = await api('/api/apps?' + params);
      var apps = data.apps;
      var total = data.total;
      state.total = total;
      resultCount.textContent = formatNum(total) + ' تطبيق';
      if (reset) grid.innerHTML = '';
      if (!apps.length && reset) {
        grid.append(el('div', { class: 'empty-state' },
          ico('search', 'icon icon-xxl'),
          el('h3', null, 'لا توجد نتائج'),
          el('p', null, 'لم نعثر على تطبيقات تطابق بحثك.'),
        ));
        loadMoreBtn.classList.add('hidden');
        return;
      }
      apps.forEach(function(a) { grid.append(appCard(a)); });
      if (state.offset + apps.length < total) loadMoreBtn.classList.remove('hidden');
      else loadMoreBtn.classList.add('hidden');
    } catch (e) {
      if (reset) grid.innerHTML = '';
      var title = 'تعذّر تحميل التطبيقات';
      var detail = 'حاول لاحقاً.';
      if (e && (e.status === 0 || e.message === 'timeout')) {
        title = 'تعذّر الاتصال بالخادم';
        detail = 'تحقّق من اتصالك بالإنترنت.';
      } else if (e && e.status >= 500) {
        title = 'خدمة المتجر غير متاحة مؤقتاً';
        detail = 'حاول لاحقاً.';
      }
      grid.append(el('div', { class: 'empty-state' },
        ico('info', 'icon icon-xxl'),
        el('h3', null, title),
        el('p', null, detail),
      ));
      loadMoreBtn.classList.add('hidden');
    }
  }

  try {
    var data = await api('/api/categories');
    cats = data.categories;
  } catch(e) {}
  updateTitle();
  renderChips();
  loadApps(true);
})();
