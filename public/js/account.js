// Account ("أنت") page — profile, download history (library), and sign out.
(function () {
  const S = window.Store;
  const { el, ico, formatBytes, formatDate, toast, t } = S;
  const root = document.getElementById('root');
  S.bottomNav('account');

  S.ready((user) => {
    root.innerHTML = '';
    root.append(S.topbarSearch(user));

    const content = el('div', { class: 'acct-page' });
    root.append(content);

    // --- Profile header ---
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

    // --- Tabs: Library / Settings ---
    let activeTab = 'library';
    const tabBar = el('div', { class: 'acct-tabs' });
    const tabBody = el('div', { class: 'acct-body' });
    content.append(tabBar, tabBody);

    function renderTabs() {
      tabBar.innerHTML = '';
      tabBar.append(
        tabBtn('library', 'download', t('مكتبتي')),
        tabBtn('settings', 'settings', t('الإعدادات')),
      );
    }

    function tabBtn(key, icon, label) {
      return el('button', {
        class: `acct-tab ${activeTab === key ? 'active' : ''}`,
        type: 'button',
        onclick: () => { activeTab = key; renderTabs(); renderBody(); },
      }, ico(icon, 'icon'), label);
    }

    function renderBody() {
      tabBody.innerHTML = '';
      if (activeTab === 'library') renderLibrary();
      else renderSettings();
    }

    // --- Library (download history) ---
    function renderLibrary() {
      const history = S.getDownloadHistory();

      if (!history.length) {
        tabBody.append(
          el('div', { class: 'empty-lib' },
            ico('download', 'icon icon-xxl'),
            el('h3', null, t('مكتبتك فارغة')),
            el('p', null, t('ستظهر هنا التطبيقات التي قمت بتحميلها لتسهيل إعادة تحميلها في أي وقت.')),
            el('a', { class: 'btn btn-primary', href: '/' }, t('تصفّح التطبيقات')),
          ),
        );
        return;
      }

      // Header with count + clear button
      const header = el('div', { class: 'lib-header' },
        el('span', { class: 'lib-count' }, `${history.length} ${t('تطبيق في مكتبتك')}`),
        el('button', { class: 'btn btn-sm btn-secondary', type: 'button', onclick: () => {
          if (!confirm(t('حذف سجل التحميلات بالكامل؟'))) return;
          S.clearDownloadHistory();
          renderBody();
          toast(t('تم مسح السجل'), 'success');
        } }, ico('trash', 'icon icon-sm'), t('مسح السجل')),
      );
      tabBody.append(header);

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
      tabBody.append(list);
    }

    // --- Settings ---
    function renderSettings() {
      tabBody.append(
        el('div', { class: 'acct-list' },
          settingItem('moon', t('المظهر'), S.currentTheme() === 'light' ? t('فاتح') : t('غامق'), () => {
            S.toggleTheme();
            renderBody();
          }),
          settingItem('globe', t('اللغة'), langLabel(), () => {
            if (window.GSI18N && window.GSI18N.cycleLang) {
              window.GSI18N.cycleLang();
              setTimeout(() => renderBody(), 100);
            }
          }),
          settingItem('info', t('حول Golden Store'), t('الإصدار') + ' 2.0', null),
        ),
        el('div', { style: { padding: '24px 0' } },
          el('button', { class: 'btn btn-outline btn-block', onclick: () => S.signOut() },
            ico('logout', 'icon icon-sm'), t('تسجيل الخروج')),
        ),
      );
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

    renderTabs();
    renderBody();
  });
})();
