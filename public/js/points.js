// Points ("نقاط التشغيل") page — balance, dollar value, and withdrawal requests.
// All figures come from the server; the client never trusts local state.
(function () {
  const S = window.Store;
  const { el, ico, t, toast, formatNum } = S;
  const root = document.getElementById('root');

  S.bottomNav('points');

  S.ready((user) => {
    // Points are tied to a Google account — require login.
    if (!user) { S.goToLogin(); return; }
    render(user);
  });

  function render() {
    root.innerHTML = '';
    root.append(S.topbarNav(t('نقاط التشغيل')));

    const page = el('div', { class: 'points-page' });
    root.append(page);

    // Loading skeleton
    const loading = el('div', { class: 'points-loading' }, S.spinner ? S.spinner() : el('div', { class: 'spinner' }));
    page.append(loading);

    S.pointsBalance().then((data) => {
      loading.remove();
      renderContent(page, data);
    }).catch((e) => {
      loading.remove();
      page.append(
        el('div', { class: 'points-error' },
          el('p', null, t('تعذّر تحميل النقاط، حاول مجدداً')),
          el('button', { class: 'btn btn-secondary', onclick: () => render() }, t('إعادة المحاولة')),
        ),
      );
    });
  }

  function renderContent(page, data) {
    const cfg = data.config || { points_per_download: 10, points_per_dollar: 1000, min_withdraw_usd: 5, min_withdraw_points: 5000 };
    const balance = data.balance || 0;
    const dollars = data.dollars != null ? data.dollars : (balance / cfg.points_per_dollar);
    const minPoints = cfg.min_withdraw_points;
    const canWithdraw = balance >= minPoints;

    // --- Hero card: icon + points + dollar preview ---
    const progressPct = Math.min(100, (balance / minPoints) * 100);
    const hero = el('div', { class: 'points-hero' },
      el('img', { src: '/images/points.png', alt: '', class: 'points-hero-icon' }),
      el('div', { class: 'points-balance' }, formatNum(balance)),
      el('div', { class: 'points-balance-label' }, t('نقطة')),
      el('div', { class: 'points-dollar' },
        el('span', { class: 'points-dollar-val' }, '$' + dollars.toFixed(2)),
        el('span', { class: 'points-dollar-label' }, t('قيمتها بالدولار')),
      ),
    );
    page.append(hero);

    // --- Withdrawal progress toward minimum ---
    const progress = el('div', { class: 'points-progress-card' },
      el('div', { class: 'points-progress-top' },
        el('span', null, t('الحد الأدنى للسحب')),
        el('span', { class: 'points-progress-goal' }, '$' + cfg.min_withdraw_usd),
      ),
      el('div', { class: 'points-progress-bar' }, el('div', { class: 'points-progress-fill', style: { width: progressPct + '%' } })),
      el('div', { class: 'points-progress-hint' },
        canWithdraw
          ? t('يمكنك طلب السحب الآن')
          : `${formatNum(balance)} / ${formatNum(minPoints)} ${t('نقطة')}`,
      ),
    );
    page.append(progress);

    // --- Withdraw button ---
    const withdrawBtn = el('button', {
      class: 'btn btn-primary btn-lg btn-block points-withdraw-btn',
      type: 'button',
      disabled: !canWithdraw,
      onclick: () => openWithdraw(data, cfg),
    }, ico('coin', 'icon icon-sm'), t('طلب السحب'));
    page.append(withdrawBtn);
    if (!canWithdraw) {
      page.append(el('p', { class: 'points-withdraw-note' },
        `${t('تحتاج إلى')} ${formatNum(minPoints)} ${t('نقطة')} ($${cfg.min_withdraw_usd}) ${t('على الأقل لطلب السحب')}`));
    }

    // --- Stats row ---
    page.append(
      el('div', { class: 'points-stats' },
        statBox(formatNum(data.total_earned || 0), t('إجمالي النقاط المكتسبة')),
        statBox('$' + (data.total_withdrawn_usd || 0), t('إجمالي المسحوب')),
        statBox('+' + cfg.points_per_download, t('نقطة لكل تثبيت')),
      ),
    );

    // --- How it works ---
    page.append(
      el('div', { class: 'points-how' },
        el('div', { class: 'points-how-title' }, ico('info', 'icon icon-sm'), t('كيف تعمل النقاط؟')),
        el('ul', { class: 'points-how-list' },
          el('li', null, `${t('كل تثبيت لتطبيق جديد يمنحك')} ${cfg.points_per_download} ${t('نقاط')}`),
          el('li', null, `${formatNum(cfg.points_per_dollar)} ${t('نقطة')} = $1`),
          el('li', null, `${t('الحد الأدنى للسحب هو')} $${cfg.min_withdraw_usd}`),
          el('li', null, t('تُحتسب النقاط مرة واحدة فقط لكل تطبيق')),
        ),
      ),
    );

    // --- Withdrawal history ---
    const history = data.withdrawals || [];
    if (history.length) {
      const list = el('div', { class: 'points-history' },
        el('div', { class: 'points-history-title' }, t('طلبات السحب')),
      );
      history.forEach((w) => {
        const statusLabel = w.status === 'approved' ? t('تمت') : w.status === 'rejected' ? t('مرفوض') : t('قيد المراجعة');
        list.append(
          el('div', { class: 'points-history-row' },
            el('div', { class: 'points-history-info' },
              el('div', { class: 'points-history-amount' }, '$' + (w.amount_usd || 0)),
              el('div', { class: 'points-history-meta' }, `${w.method || ''} • ${w.account || ''}`),
            ),
            el('span', { class: `points-status points-status-${w.status || 'pending'}` }, statusLabel),
          ),
        );
      });
      page.append(list);
    }
  }

  function statBox(value, label) {
    return el('div', { class: 'points-stat' },
      el('div', { class: 'points-stat-val' }, value),
      el('div', { class: 'points-stat-label' }, label),
    );
  }

  // --- Withdrawal request modal ---
  function openWithdraw(data, cfg) {
    const maxUsd = Math.floor((data.balance || 0) / cfg.points_per_dollar);

    const methodSel = el('select', { class: 'points-input' },
      el('option', { value: 'baridimob' }, 'BaridiMob (CCP)'),
      el('option', { value: 'paypal' }, 'PayPal'),
      el('option', { value: 'usdt' }, 'USDT (TRC20)'),
      el('option', { value: 'flexy' }, t('رصيد هاتف (Flexy)')),
    );
    const accountInput = el('input', { type: 'text', class: 'points-input', placeholder: t('رقم الحساب / البريد / المحفظة') });
    const amountInput = el('input', { type: 'number', class: 'points-input', min: cfg.min_withdraw_usd, max: maxUsd, step: '1', value: String(maxUsd) });

    const overlay = el('div', { class: 'dialog-overlay' });
    function close() { overlay.remove(); }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    const submitBtn = el('button', { class: 'btn btn-primary', type: 'button' }, t('إرسال الطلب'));
    submitBtn.onclick = async () => {
      const method = methodSel.value;
      const account = (accountInput.value || '').trim();
      const amountUsd = Math.floor(Number(amountInput.value));
      if (account.length < 3) { toast(t('أدخل بيانات الحساب الصحيحة'), 'error'); return; }
      if (!Number.isFinite(amountUsd) || amountUsd < cfg.min_withdraw_usd) { toast(`${t('الحد الأدنى للسحب هو')} $${cfg.min_withdraw_usd}`, 'error'); return; }
      if (amountUsd > maxUsd) { toast(t('المبلغ أكبر من رصيدك'), 'error'); return; }
      submitBtn.disabled = true;
      submitBtn.textContent = t('جارٍ الإرسال…');
      try {
        await S.pointsWithdraw({ method, account, amount_usd: amountUsd });
        close();
        toast(t('تم إرسال طلب السحب، ستتم مراجعته قريباً'), 'success');
        render();
      } catch (e) {
        submitBtn.disabled = false;
        submitBtn.textContent = t('إرسال الطلب');
        const err = e && e.data && e.data.error;
        if (err === 'insufficient_points' || err === 'below_minimum') toast(t('رصيدك غير كافٍ للسحب'), 'error');
        else if (err === 'rate_limit_exceeded') toast(t('محاولات كثيرة، انتظر قليلاً'), 'error');
        else toast(t('تعذّر إرسال الطلب، حاول مجدداً'), 'error');
      }
    };

    const card = el('div', { class: 'dialog-card', dir: 'rtl' },
      el('div', { class: 'dialog-head' },
        el('div', { class: 'dialog-title' }, ico('coin', 'icon'), t('طلب سحب الأرباح')),
        el('button', { class: 'dialog-close', 'aria-label': t('إغلاق'), onclick: close }, ico('close')),
      ),
      el('div', { class: 'dialog-body points-withdraw-form' },
        el('label', { class: 'points-label' }, t('طريقة السحب')),
        methodSel,
        el('label', { class: 'points-label' }, t('بيانات الحساب')),
        accountInput,
        el('label', { class: 'points-label' }, `${t('المبلغ بالدولار')} (${t('متاح')}: $${maxUsd})`),
        amountInput,
      ),
      el('div', { class: 'dialog-actions' },
        el('button', { class: 'btn btn-secondary', type: 'button', onclick: close }, t('إلغاء')),
        submitBtn,
      ),
    );
    overlay.append(card);
    document.body.append(overlay);
  }
})();
