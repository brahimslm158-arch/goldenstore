// Account ("أنت") page — settings only. Library is accessed via bottom nav.
(function () {
  const S = window.Store;
  const { el, ico, formatBytes, formatDate, toast, t, getQuery } = S;
  const root = document.getElementById('root');

  // Determine which view to show based on URL param
  const tabParam = getQuery('tab');
  const isLibraryView = tabParam === 'library';

  S.bottomNav(isLibraryView ? 'library' : 'account');

  S.ready((user) => {
    root.innerHTML = '';
    root.append(S.topbarSearch(user));

    const content = el('div', { class: 'acct-page' });
    root.append(content);

    if (isLibraryView) {
      renderLibraryPage(content);
    } else {
      renderSettingsPage(content, user);
    }
  });

  // --- Library page (standalone, accessed from bottom nav) ---
  function renderLibraryPage(content) {
    content.append(el('div', { class: 'page-title', style: { padding: '16px' } }, t('مكتبتي')));
    const body = el('div', { class: 'acct-body' });
    content.append(body);

    const history = S.getDownloadHistory();

    if (!history.length) {
      body.append(
        el('div', { class: 'empty-lib' },
          ico('download', 'icon icon-xxl'),
          el('h3', null, t('مكتبتك فارغة')),
          el('p', null, t('ستظهر هنا التطبيقات التي قمت بتحميلها لتسهيل إعادة تحميلها في أي وقت.')),
          el('a', { class: 'btn btn-primary', href: '/' }, t('تصفّح التطبيقات')),
        ),
      );
      return;
    }

    const header = el('div', { class: 'lib-header' },
      el('span', { class: 'lib-count' }, `${history.length} ${t('تطبيق في مكتبتك')}`),
      el('button', { class: 'btn btn-sm btn-secondary', type: 'button', onclick: () => {
        if (!confirm(t('حذف سجل التحميلات بالكامل؟'))) return;
        S.clearDownloadHistory();
        content.innerHTML = '';
        renderLibraryPage(content);
        toast(t('تم مسح السجل'), 'success');
      } }, ico('trash', 'icon icon-sm'), t('مسح السجل')),
    );
    body.append(header);

    const list = el('div', { class: 'lib-list' });
    history.forEach((item) => {
      const row = el('a', { href: `/app?slug=${encodeURIComponent(item.slug)}`, class: 'lib-row' },
        el('div', { class: 'art' },
          item.icon_url
            ? el('img', { src: item.icon_url, alt: item.name, loading: 'lazy' })
            : ico('package', 'icon icon-lg'),
        ),
        el('div', { class: 'lib-info' },
          el('div', { class: 'nm' }, item.name),
          el('div', { class: 'sub' }, item.developer || 'Golden Store'),
          el('div', { class: 'meta' },
            el('span', null, formatBytes(item.size_bytes || 0)),
            el('span', null, '•'),
            el('span', null, formatDate(item.downloaded_at)),
          ),
        ),
        el('div', { class: 'lib-action' },
          el('span', { class: 'btn btn-sm btn-primary' }, ico('download', 'icon icon-sm'), t('إعادة تحميل')),
        ),
      );
      list.append(row);
    });
    body.append(list);
  }

  // --- Settings page (profile + settings) ---
  function renderSettingsPage(content, user) {
    // Profile header
    const photo = user && user.photoURL
      ? el('img', { src: user.photoURL, alt: '', referrerpolicy: 'no-referrer' })
      : document.createTextNode((user && (user.displayName || user.email) || '?').trim().charAt(0).toUpperCase());

    content.append(
      el('div', { class: 'acct-head' },
        el('div', { class: 'avatar avatar-lg' }, photo),
        el('div', { class: 'acct-info' },
          el('div', { class: 'nm' }, (user && user.displayName) || t('مستخدم') + ' Golden Store'),
          el('div', { class: 'em' }, (user && user.email) || ''),
        ),
      ),
    );

    // Settings title
    content.append(el('div', { class: 'page-title', style: { padding: '16px 16px 0' } }, t('الإعدادات')));

    const settingsBody = el('div', { class: 'acct-body' });
    content.append(settingsBody);

    function renderSettings() {
      settingsBody.innerHTML = '';
      settingsBody.append(
        el('div', { class: 'acct-list' },
          settingItem('moon', t('المظهر'), S.currentTheme() === 'light' ? t('فاتح') : t('غامق'), () => {
            S.toggleTheme();
            renderSettings();
          }),
          langSettingItem(),
          settingItem('info', t('حول Golden Store'), t('الإصدار') + ' 2.0', null),
        ),
        el('div', { style: { padding: '24px 0' } },
          el('button', { class: 'btn btn-outline btn-block', onclick: () => S.signOut() },
            ico('logout', 'icon icon-sm'), t('تسجيل الخروج')),
        ),
      );
    }

    renderSettings();
  }

  function langSettingItem() {
    const langs = [
      { code: 'ar', label: 'العربية' },
      { code: 'en', label: 'English' },
      { code: 'fr', label: 'Français' },
      { code: 'es', label: 'Español' },
    ];
    const currentLang = (window.GSI18N && window.GSI18N.lang) || 'ar';
    const wrapper = el('div', { class: 'acct-setting lang-setting' });
    wrapper.append(
      ico('globe', 'icon'),
      el('span', { class: 'label' }, t('اللغة')),
    );
    const select = el('select', { class: 'lang-select' });
    langs.forEach((l) => {
      const opt = el('option', { value: l.code }, l.label);
      if (l.code === currentLang) opt.selected = true;
      select.append(opt);
    });
    select.addEventListener('change', () => {
      if (window.GSI18N && window.GSI18N.setLang) {
        window.GSI18N.setLang(select.value);
      }
    });
    wrapper.append(select);
    return wrapper;
  }

  function settingItem(icon, label, value, onClick) {
    const attrs = { class: 'acct-setting' };
    if (onClick) attrs.onclick = onClick;
    return el('div', attrs,
      ico(icon, 'icon'),
      el('span', { class: 'label' }, label),
      el('span', { class: 'value' }, value || ''),
      onClick ? ico('chevronStart', 'icon icon-sm') : null,
    );
  }

  function langLabel() {
    const lang = (window.GSI18N && window.GSI18N.lang) || 'ar';
    const map = { ar: 'العربية', en: 'English', fr: 'Français', es: 'Español' };
    return map[lang] || lang;
  }
})();
