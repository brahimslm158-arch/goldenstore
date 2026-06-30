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
    if (content.__libDlUnsub) {
      content.__libDlUnsub();
      content.__libDlUnsub = null;
    }

    content.append(el('div', { class: 'page-title', style: { padding: '16px' } }, t('مكتبتي')));
    const body = el('div', { class: 'acct-body' });
    content.append(body);

    const activeWrap = el('div', { class: 'lib-active-list' });
    body.append(activeWrap);

    const historyWrap = el('div', { class: 'lib-history' });
    body.append(historyWrap);

    function renderActiveDownloads(items) {
      activeWrap.innerHTML = '';
      if (!items.length) return;

      activeWrap.append(
        el('div', { class: 'lib-active-header' },
          el('span', { class: 'lib-count' }, `${items.length} ${t('جارٍ التحميل')}`),
        ),
      );

      const list = el('div', { class: 'lib-dl-list' });
      items.forEach((item) => {
        const progress = typeof item.progress === 'number' ? item.progress : 0;
        const indeterminate = progress < 0;
        const pct = indeterminate ? '' : `${Math.max(0, Math.min(100, Math.round(progress * 100)))}%`;
        list.append(
          el('div', { class: 'lib-dl-row' },
            el('div', { class: 'art' },
              item.icon_url
                ? el('img', { src: item.icon_url, alt: item.name, loading: 'lazy' })
                : ico('download', 'icon icon-lg'),
            ),
            el('div', { class: 'lib-info' },
              el('div', { class: 'nm' }, item.name),
              el('div', { class: 'sub' }, item.developer || 'Golden Store'),
              el('div', { class: 'lib-dl-status' }, indeterminate
                ? t('جارٍ التحميل…')
                : `${t('جارٍ التحميل…')} ${pct}`),
              el('div', { class: 'lib-dl-progress', 'data-indeterminate': indeterminate ? '1' : '0' },
                el('div', { class: 'lib-dl-fill', style: indeterminate ? {} : { width: `${Math.max(0, Math.min(100, Math.round(progress * 100)))}%` } }),
              ),
            ),
          ),
        );
      });
      activeWrap.append(list);
    }

    const history = S.getDownloadHistory();
    const renderHistorySection = () => {
      historyWrap.innerHTML = '';
      const header = el('div', { class: 'lib-header' },
        el('span', { class: 'lib-count' }, `${history.length} ${t('تطبيق في مكتبتك')}`),
        el('button', { class: 'btn btn-sm btn-secondary', type: 'button', onclick: () => {
          if (!confirm(t('حذف سجل التحميلات بالكامل؟'))) return;
          S.clearDownloadHistory();
          renderLibraryPage(content);
          toast(t('تم مسح السجل'), 'success');
        } }, ico('trash', 'icon icon-sm'), t('مسح السجل')),
      );
      historyWrap.append(header);

      if (!history.length) {
        historyWrap.append(
          el('div', { class: 'empty-lib' },
            ico('download', 'icon icon-xxl'),
            el('h3', null, t('مكتبتك فارغة')),
            el('p', null, t('ستظهر هنا التطبيقات التي قمت بتحميلها لتسهيل إعادة تحميلها في أي وقت.')),
            el('a', { class: 'btn btn-primary', href: '/' }, t('تصفح التطبيقات')),
          ),
        );
        return;
      }

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
      historyWrap.append(list);
    };

    renderHistorySection();
    renderActiveDownloads(S.getActiveDownloads());
    content.__libDlUnsub = S.onActiveDownloadsChange((items) => renderActiveDownloads(items));
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

    // Points card
    content.append(pointsCard());

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
          aboutDropdown(),
        ),
        contactCard(),
        el('div', { style: { padding: '24px 0' } },
          el('button', { class: 'btn btn-outline btn-block', onclick: () => confirmSignOut() },
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
    const current = langs.find((l) => l.code === currentLang) || langs[0];

    const dropdown = el('div', { class: 'lang-dropdown', 'data-noi18n': '' });

    const trigger = el('button', { type: 'button', class: 'lang-trigger' },
      ico('globe', 'icon'),
      el('span', { class: 'label' }, t('اللغة')),
      el('span', { class: 'lang-current' }, current.label),
      ico('chevronDown', 'icon chevron'),
    );

    const menu = el('div', { class: 'lang-menu-pop' });
    langs.forEach((l) => {
      const item = el('button', {
        type: 'button',
        class: `lang-option ${l.code === currentLang ? 'active' : ''}`,
        onclick: () => {
          if (l.code === currentLang) { dropdown.classList.remove('open'); return; }
          if (window.GSI18N && window.GSI18N.setLang) window.GSI18N.setLang(l.code);
        },
      },
        el('span', { class: 'lang-name' }, l.label),
        l.code === currentLang ? ico('check', 'icon check') : el('span'),
      );
      menu.append(item);
    });

    trigger.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('open'); };
    document.addEventListener('click', (e) => { if (!dropdown.contains(e.target)) dropdown.classList.remove('open'); });

    dropdown.append(trigger, menu);
    return dropdown;
  }

  function confirmSignOut() {
    const overlay = el('div', { class: 'dialog-overlay', onclick: (e) => { if (e.target === overlay) close(); } });
    function close() { overlay.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    const card = el('div', { class: 'dialog-card', dir: 'rtl' },
      el('div', { class: 'dialog-head' },
        el('div', { class: 'dialog-title' }, ico('logout', 'icon'), t('تسجيل الخروج')),
        el('button', { class: 'dialog-close', 'aria-label': t('إغلاق'), onclick: () => close() }, ico('close')),
      ),
      el('div', { class: 'dialog-body' },
        el('p', { class: 'store-card-text' }, t('هل تريد بالتأكيد تسجيل الخروج من حسابك؟ ستحتاج لتسجيل الدخول مجدداً للوصول إلى المتجر.')),
      ),
      el('div', { class: 'dialog-actions' },
        el('button', { class: 'btn btn-secondary', onclick: () => close() }, t('إلغاء')),
        el('button', { class: 'btn btn-danger', onclick: () => { close(); S.signOut(); } },
          ico('logout', 'icon icon-sm'), t('تسجيل الخروج')),
      ),
    );
    overlay.append(card);
    document.addEventListener('keydown', esc);
    document.body.append(overlay);
  }

  function aboutDropdown() {
    const wrap = el('div', { class: 'about-collapse' });
    const trigger = el('button', { type: 'button', class: 'acct-setting about-trigger' },
      ico('info', 'icon'),
      el('span', { class: 'label' }, t('عن Golden Store')),
      el('span', { class: 'value' }, t('الإصدار') + ' 2.0'),
      ico('chevronDown', 'icon icon-sm chevron'),
    );
    const body = el('div', { class: 'about-body' },
      el('p', { class: 'store-card-text' },
        t('Golden Store هو متجرك العربي لتحميل أحدث التطبيقات والألعاب المهكرة (Mod) والمدفوعة مجاناً بأحدث إصداراتها، مع ميزات مفتوحة بالكامل وبدون إعلانات. نختار المحتوى بعناية ونحدّثه باستمرار، ونوفّر تحميلاً مباشراً سريعاً وآمناً.')),
    );
    trigger.onclick = () => wrap.classList.toggle('open');
    wrap.append(trigger, body);
    return wrap;
  }

  function contactCard() {
    const links = [
      { icon: 'facebook',  label: 'Facebook',  href: 'https://www.facebook.com/F.Pony.Z', fill: true },
      { icon: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/faycalzaouani', fill: false },
      { icon: 'telegram',  label: 'Telegram',  href: 'https://t.me/goldenstore_10', fill: true },
    ];
    const list = el('div', { class: 'acct-list contact-list' });
    links.forEach((l) => {
      list.append(el('a', { class: 'acct-setting contact-row', href: l.href, target: '_blank', rel: 'noopener noreferrer' },
        ico(l.icon, `icon ${l.fill ? 'fill ' : ''}brand-${l.icon}`),
        el('span', { class: 'label' }, l.label),
        ico('external', 'icon icon-sm'),
      ));
    });
    return el('div', null,
      el('div', { class: 'page-title', style: { padding: '8px 16px 0', fontSize: '15px' } }, t('تواصل معنا')),
      list,
    );
  }

  function statChip(label, value) {
    return el('div', { class: 'points-stat' },
      el('div', { class: 'stat-val' }, value),
      el('div', { class: 'stat-label' }, label),
    );
  }

  // --- Points card (نقاط التشغيل) ---
  function pointsCard() {
    const POINTS_TO_CLAIM = 1000;
    const USD_PER_POINT = 1 / POINTS_TO_CLAIM; // 1000 نقطة = 1 دولار
    let _claimedAmount = 0;
    const card = el('div', { class: 'points-card' });
    const balanceEl = el('div', { class: 'points-balance' }, '—');
    const usdEl = el('div', { class: 'points-usd' }, '≈ 0.000$');
    const progressBar = el('div', { class: 'points-progress-fill' });
    const progressText = el('div', { class: 'points-progress-text' }, '...');
    const valueStat = statChip(t('قيمتها الحالية'), '0.000$');
    const claimedStat = statChip(t('سحبته إجمالاً'), '0.000$');
    const claimBtn = el('button', { class: 'btn btn-primary points-claim-btn', type: 'button', disabled: true },
      ico('gift', 'icon icon-sm'), t('مطالبة بالهدية'));
    const statusEl = el('div', { class: 'points-status' });

    function fmtUsd(n) { return (Math.round(n * 1000) / 1000).toFixed(3) + '$'; }

    claimBtn.addEventListener('click', async () => {
      claimBtn.disabled = true;
      claimBtn.textContent = t('جارٍ المعالجة...');
      try {
        const res = await S.claimReward();
        if (res && res.ok) {
          S.toast(`${t('تمت المطالبة!')} ${res.reward_usd}$ — ${t('رصيدك الجديد')}: ${res.balance} ${t('نقطة')}`, 'success');
          _claimedAmount += Number(res.reward_usd || 0);
          updateUI(res.balance);
        } else {
          S.toast(t('رصيدك غير كافٍ. تحتاج 1000 نقطة.'), 'error');
        }
      } catch {
        S.toast(t('حدث خطأ. حاول مرة أخرى.'), 'error');
      }
      claimBtn.disabled = false;
      claimBtn.innerHTML = '';
      claimBtn.append(ico('gift', 'icon icon-sm'), document.createTextNode(t('مطالبة بالهدية')));
    });

    function updateUI(balance) {
      balanceEl.textContent = balance.toLocaleString();
      const usd = balance * USD_PER_POINT;
      usdEl.textContent = '≈ ' + fmtUsd(usd);
      valueStat.querySelector('.stat-val').textContent = fmtUsd(usd);
      claimedStat.querySelector('.stat-val').textContent = fmtUsd(_claimedAmount);
      const pct = Math.min(100, Math.round((balance / POINTS_TO_CLAIM) * 100));
      progressBar.style.width = pct + '%';
      progressText.textContent = `${balance} / ${POINTS_TO_CLAIM} ${t('نقطة')}`;
      claimBtn.disabled = balance < POINTS_TO_CLAIM;
      if (balance >= POINTS_TO_CLAIM) {
        claimBtn.classList.add('ready');
        statusEl.textContent = t('يمكنك المطالبة بـ 1$ الآن!');
        statusEl.style.color = 'var(--gold)';
      } else {
        claimBtn.classList.remove('ready');
        const remaining = POINTS_TO_CLAIM - balance;
        statusEl.textContent = `${t('تحتاج')} ${remaining} ${t('نقطة إضافية')}`;
        statusEl.style.color = 'var(--text-3)';
      }
    }

    card.append(
      el('div', { class: 'points-header' },
        el('div', { class: 'points-icon' },
          el('img', { src: '/images/points.png', alt: 'Goldenstore', class: 'points-emblem' }),
        ),
        el('div', { class: 'points-title' },
          el('div', { class: 'points-label' }, t('نقاط التشغيل')),
          el('div', { class: 'points-hint' }, t('حمّل تطبيقات واكسب نقاط! 10 نقاط لكل تحميل')),
        ),
      ),
      el('div', { class: 'points-body' },
        el('div', { class: 'points-balance-row' },
          el('img', { src: '/images/points.png', alt: '', class: 'points-coin' }),
          el('div', { class: 'points-balance-main' },
            el('div', { class: 'points-balance-num' },
              balanceEl,
              el('span', { class: 'points-unit' }, t('نقطة')),
            ),
            usdEl,
          ),
        ),
        el('div', { class: 'points-progress' }, progressBar),
        progressText,
        statusEl,
        el('div', { class: 'points-stats' }, valueStat, claimedStat),
      ),
      el('div', { class: 'points-actions' }, claimBtn),
    );

    // Load balance
    S.getPointsBalance().then((data) => {
      if (data && typeof data.balance === 'number') {
        _claimedAmount = Number(data.claimed_amount || 0);
        updateUI(data.balance);
      } else updateUI(0);
    }).catch(() => updateUI(0));

    return card;
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
