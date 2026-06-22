// Account ("أنت") page — Google profile + sign out.
(function () {
  const S = window.Store;
  const { el, ico } = S;
  const root = document.getElementById('root');
  S.bottomNav('account');

  S.ready((user) => {
    root.innerHTML = '';
    root.append(S.topbarSearch(user));

    const photo = user && user.photoURL
      ? el('img', { src: user.photoURL, alt: '', referrerpolicy: 'no-referrer' })
      : document.createTextNode((user && (user.displayName || user.email) || '?').trim().charAt(0).toUpperCase());

    const acct = el('div', { class: 'acct' },
      el('div', { class: 'acct-head' },
        el('div', { class: 'avatar' }, photo),
        el('div', null,
          el('div', { class: 'nm' }, (user && user.displayName) || 'مستخدم Golden Store'),
          el('div', { class: 'em' }, (user && user.email) || ''),
        ),
      ),
      el('div', { class: 'acct-list' },
        item('apps', 'تطبيقاتي وألعابي', '/'),
        item('download', 'إدارة التنزيلات', '/'),
        item('shieldCheck', 'Play Protect', null),
        item('settings', 'الإعدادات', null),
        item('info', 'حول Golden Store', null),
      ),
      el('div', { style: { padding: '24px 8px' } },
        el('button', { class: 'btn btn-outline btn-block', onclick: () => S.signOut() }, ico('logout', 'icon icon-sm'), 'تسجيل الخروج'),
      ),
    );
    root.append(acct);

    function item(icon, label, href) {
      const attrs = { class: 'acct-item' };
      const node = href ? el('a', { ...attrs, href }, ico(icon), el('span', { style: { flex: '1' } }, label), ico('chevronStart', 'icon icon-sm'))
        : el('div', { ...attrs, style: { opacity: '.6' } }, ico(icon), el('span', { style: { flex: '1' } }, label));
      return node;
    }
  });
})();
