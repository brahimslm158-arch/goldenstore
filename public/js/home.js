(async function () {
  const { api, el, ico, appCard } = window.GS;

  // Hero — already in HTML

  // Featured apps
  const featuredGrid = document.getElementById('featured-grid');
  // Categories
  const categoriesGrid = document.getElementById('categories-grid');
  // Recent
  const recentGrid = document.getElementById('recent-grid');
  // Popular
  const popularGrid = document.getElementById('popular-grid');

  function emptyMsg(text) {
    return el('div', { class: 'empty-state' },
      ico('package', 'icon icon-xxl'),
      el('p', null, text),
    );
  }

  async function loadFeatured() {
    try {
      const { apps } = await api('/api/apps?featured=1&limit=8');
      featuredGrid.innerHTML = '';
      if (!apps.length) {
        featuredGrid.append(emptyMsg('لا توجد مختارات ذهبية بعد.'));
        return;
      }
      apps.forEach((a) => featuredGrid.append(appCard(a)));
    } catch {
      featuredGrid.innerHTML = '';
      featuredGrid.append(emptyMsg('تعذّر تحميل المختارات.'));
    }
  }

  async function loadCategories() {
    try {
      const { categories } = await api('/api/categories');
      categoriesGrid.innerHTML = '';
      categories.slice(0, 8).forEach((c) => {
        categoriesGrid.append(
          el('a', { href: `/browse?category=${c.slug}`, class: 'category-card' },
            el('div', { class: 'category-icon' }, ico(c.icon)),
            el('div', { class: 'category-info' },
              el('div', { class: 'category-name' }, c.name),
              el('div', { class: 'category-count' }, `${c.count || 0} تطبيق`),
            ),
          ),
        );
      });
    } catch {
      categoriesGrid.innerHTML = '';
      categoriesGrid.append(emptyMsg('تعذّر تحميل التصنيفات.'));
    }
  }

  async function loadRecent() {
    try {
      const { apps } = await api('/api/apps?sort=recent&limit=8');
      recentGrid.innerHTML = '';
      if (!apps.length) { recentGrid.append(emptyMsg('لم تُضُف تطبيقات بعد.')); return; }
      apps.forEach((a) => recentGrid.append(appCard(a)));
    } catch { recentGrid.innerHTML = ''; recentGrid.append(emptyMsg('تعذّر تحميل التطبيقات.')); }
  }

  async function loadPopular() {
    try {
      const { apps } = await api('/api/apps?sort=popular&limit=8');
      popularGrid.innerHTML = '';
      if (!apps.length) { popularGrid.append(emptyMsg('لا توجد تنزيلات بعد.')); return; }
      apps.forEach((a) => popularGrid.append(appCard(a)));
    } catch { popularGrid.innerHTML = ''; popularGrid.append(emptyMsg('تعذّر تحميل التطبيقات.')); }
  }

  await Promise.all([loadFeatured(), loadCategories(), loadRecent(), loadPopular()]);
})();
