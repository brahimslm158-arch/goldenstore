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

  function emptyMsg(text, hint) {
    return el('div', { class: 'empty-state' },
      ico('package', 'icon icon-xxl'),
      el('p', null, text),
      hint ? el('p', { class: 'muted', style: 'font-size:13px; margin-top:4px;' }, hint) : null,
    );
  }

  function errorMsg(err) {
    if (err && (err.status === 0 || err.message === 'timeout')) {
      return emptyMsg('تعذّر الاتصال بالخادم.', 'تحقّق من اتصالك بالإنترنت ثمّ حدّث الصفحة.');
    }
    if (err && err.status >= 500) {
      return emptyMsg('خدمة المتجر غير متاحة مؤقتاً.', 'حاول لاحقاً بعد دقائق قليلة.');
    }
    return emptyMsg('تعذّر تحميل البيانات.');
  }

  async function loadFeatured() {
    try {
      const { apps } = await api('/api/apps?featured=1&limit=8');
      featuredGrid.innerHTML = '';
      if (!apps.length) {
        featuredGrid.append(emptyMsg('لا توجد مختارات ذهبية بعد.', 'ستظهر هنا أفضل التطبيقات المهكّرة المختارة.'));
        return;
      }
      apps.forEach((a) => featuredGrid.append(appCard(a)));
    } catch (err) {
      featuredGrid.innerHTML = '';
      featuredGrid.append(errorMsg(err));
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
    } catch (err) {
      categoriesGrid.innerHTML = '';
      categoriesGrid.append(errorMsg(err));
    }
  }

  async function loadRecent() {
    try {
      const { apps } = await api('/api/apps?sort=recent&limit=8');
      recentGrid.innerHTML = '';
      if (!apps.length) { recentGrid.append(emptyMsg('لا توجد تطبيقات بعد.', 'ستظهر هنا تطبيقات المتجر فور إضافتها.')); return; }
      apps.forEach((a) => recentGrid.append(appCard(a)));
    } catch (err) { recentGrid.innerHTML = ''; recentGrid.append(errorMsg(err)); }
  }

  async function loadPopular() {
    try {
      const { apps } = await api('/api/apps?sort=popular&limit=8');
      popularGrid.innerHTML = '';
      if (!apps.length) { popularGrid.append(emptyMsg('لا توجد تنزيلات بعد.', 'سنعرض هنا التطبيقات الأكثر طلباً.')); return; }
      apps.forEach((a) => popularGrid.append(appCard(a)));
    } catch (err) { popularGrid.innerHTML = ''; popularGrid.append(errorMsg(err)); }
  }

  await Promise.all([loadFeatured(), loadCategories(), loadRecent(), loadPopular()]);
})();
