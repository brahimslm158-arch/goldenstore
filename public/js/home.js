(async function () {
  const { api, el, ico, appCard } = window.GS;
  const { t, catName } = window.GSLang;

  const categoriesScroll = document.getElementById('categories-scroll');
  const appsGrid = document.getElementById('apps-grid');

  // Translate static hero text
  const heroEyebrow = document.querySelector('.hero-eyebrow');
  if (heroEyebrow) heroEyebrow.lastChild.textContent = ' ' + t('heroEyebrow');
  const h1 = document.querySelector('.hero h1');
  if (h1) { h1.childNodes[0].textContent = t('heroTitle1'); h1.querySelector('b').textContent = t('heroTitle2'); }
  const heroP = document.querySelector('.hero > p');
  if (heroP) heroP.textContent = t('heroDesc');
  const heroActions = document.querySelectorAll('.hero-actions a');
  if (heroActions[0]) heroActions[0].lastChild.textContent = ' ' + t('browseStore');
  if (heroActions[1]) heroActions[1].lastChild.textContent = ' ' + t('topRated');
  const viewAllBtn = document.querySelector('a.btn.btn-secondary[href="/browse"]');
  if (viewAllBtn) viewAllBtn.textContent = t('viewAll');

  function emptyMsg(text, hint) {
    return el('div', { class: 'empty-state' },
      ico('package', 'icon icon-xxl'),
      el('p', null, text),
      hint ? el('p', { class: 'muted', style: 'font-size:13px; margin-top:4px;' }, hint) : null,
    );
  }

  function errorMsg(err) {
    if (err && (err.status === 0 || err.message === 'timeout')) {
      return emptyMsg(t('connError'), t('connHint'));
    }
    if (err && err.status >= 500) {
      return emptyMsg(t('svcError'), t('svcHint'));
    }
    return emptyMsg(t('loadError'));
  }

  async function loadCategories() {
    try {
      const { categories } = await api('/api/categories');
      categoriesScroll.innerHTML = '';
      categories.forEach((c) => {
        categoriesScroll.append(
          el('a', { href: `/browse?category=${c.slug}`, class: 'category-chip' },
            el('span', { class: 'category-chip-icon' }, ico(c.icon)),
            el('span', { class: 'category-chip-name' }, catName(c.slug)),
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
        appsGrid.append(emptyMsg(t('noAppsYet'), t('noAppsHint')));
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
