(async function () {
  const { api, el, ico, appCard } = window.GS;

  const categoriesScroll = document.getElementById('categories-scroll');
  const appsGrid = document.getElementById('apps-grid');

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

  async function loadCategories() {
    try {
      const { categories } = await api('/api/categories');
      categoriesScroll.innerHTML = '';
      categories.forEach((c) => {
        categoriesScroll.append(
          el('a', { href: `/browse?category=${c.slug}`, class: 'category-chip' },
            el('span', { class: 'category-chip-icon' }, ico(c.icon)),
            el('span', { class: 'category-chip-name' }, c.name),
            el('span', { class: 'category-chip-count' }, `${c.count || 0}`),
          ),
        );
      });
    } catch (err) {
      categoriesScroll.innerHTML = '';
      categoriesScroll.append(errorMsg(err));
    }
  }

  async function loadApps() {
    try {
      const { apps } = await api('/api/apps?sort=recent&limit=24');
      appsGrid.innerHTML = '';
      if (!apps.length) {
        appsGrid.append(emptyMsg('لا توجد تطبيقات بعد.', 'ستظهر هنا تطبيقات المتجر فور إضافتها.'));
        return;
      }
      apps.forEach((a) => appsGrid.append(appCard(a)));
    } catch (err) {
      appsGrid.innerHTML = '';
      appsGrid.append(errorMsg(err));
    }
  }

  await Promise.all([loadCategories(), loadApps()]);
})();
