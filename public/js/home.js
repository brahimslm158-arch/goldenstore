(async function () {
  const { api, el, ico, appCard } = window.GS;

  const categoriesScroll = document.getElementById('categories-scroll');
  const featuredSection = document.getElementById('featured-section');
  const appsSections = document.getElementById('apps-sections');

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

  function appRow(apps) {
    const row = el('div', { class: 'app-row' });
    apps.forEach((a) => row.append(appCard(a)));
    return row;
  }

  function sectionBlock(title, linkHref, apps) {
    if (!apps || !apps.length) return null;
    return el('section', null,
      el('div', { class: 'section-head' },
        el('h2', { class: 'section-title' }, title),
        linkHref ? el('a', { href: linkHref, class: 'section-link' }, 'عرض الكل', ico('arrowLeft')) : null,
      ),
      appRow(apps),
    );
  }

  async function loadCategories() {
    try {
      const { categories } = await api('/api/categories');
      categoriesScroll.innerHTML = '';
      categories.forEach((c) => {
        categoriesScroll.append(
          el('a', { href: '/browse?category=' + c.slug, class: 'category-chip' },
            el('span', { class: 'category-chip-icon' }, ico(c.icon)),
            el('span', { class: 'category-chip-name' }, c.name),
          ),
        );
      });
    } catch (err) {
      categoriesScroll.innerHTML = '';
      categoriesScroll.append(errorMsg(err));
    }
  }

  function buildFeaturedBanner(apps) {
    if (!apps || !apps.length) return;
    const featured = apps.slice(0, 4);
    let current = 0;

    const track = el('div', { class: 'carousel-track' });
    const dotsWrap = el('div', { class: 'carousel-dots' });

    featured.forEach((a, i) => {
      const slide = el('a', { href: '/app?slug=' + encodeURIComponent(a.slug), class: 'carousel-slide' },
        a.icon_url
          ? el('img', { src: a.icon_url, alt: a.name, style: 'object-fit:contain; background:#2d2d2d;' })
          : el('div', { style: 'width:100%;height:100%;background:#2d2d2d;display:flex;align-items:center;justify-content:center;' }, ico('package', 'icon icon-xxl')),
        el('div', { class: 'slide-overlay' },
          el('span', { class: 'slide-tag' }, a.category || 'تطبيق'),
          el('div', { class: 'slide-title' }, a.name),
          a.developer ? el('div', { class: 'slide-sub' }, a.developer) : null,
        ),
      );
      track.append(slide);

      const dot = el('button', { class: 'carousel-dot' + (i === 0 ? ' active' : ''), onclick: () => goTo(i) });
      dotsWrap.append(dot);
    });

    function goTo(idx) {
      current = idx;
      track.style.transform = 'translateX(' + (idx * 100) + '%)';
      dotsWrap.querySelectorAll('.carousel-dot').forEach((d, i) => {
        d.classList.toggle('active', i === idx);
      });
    }

    // Auto-rotate
    setInterval(() => {
      goTo((current + 1) % featured.length);
    }, 5000);

    const wrap = el('section', { class: 'carousel-section' },
      el('div', { class: 'carousel-wrap' }, track),
      dotsWrap,
    );
    featuredSection.innerHTML = '';
    featuredSection.append(wrap);
  }

  async function loadApps() {
    try {
      const [recent, popular, topRated] = await Promise.all([
        api('/api/apps?sort=recent&limit=12'),
        api('/api/apps?sort=popular&limit=12'),
        api('/api/apps?sort=stars&limit=12'),
      ]);

      appsSections.innerHTML = '';

      if (!recent.apps.length && !popular.apps.length) {
        appsSections.append(emptyMsg('لا توجد تطبيقات بعد.', 'ستظهر هنا تطبيقات المتجر فور إضافتها.'));
        return;
      }

      // Use first few popular apps for featured banner
      buildFeaturedBanner(popular.apps);

      const s1 = sectionBlock('محتوى يهمّك', '/browse?sort=recent', recent.apps);
      const s2 = sectionBlock('الأكثر تنزيلاً', '/browse?sort=popular', popular.apps);
      const s3 = sectionBlock('الأعلى تقييماً', '/browse?sort=stars', topRated.apps);

      if (s1) appsSections.append(s1);
      if (s2) appsSections.append(s2);
      if (s3) appsSections.append(s3);
    } catch (err) {
      appsSections.innerHTML = '';
      appsSections.append(errorMsg(err));
    }
  }

  await Promise.all([loadCategories(), loadApps()]);
})();
