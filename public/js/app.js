(async function () {
  const { api, el, ico, formatBytes, formatNum, formatDate, getQuery, toast } = window.GS;
  const { t } = window.GSLang;
  const content = document.getElementById('content');

  const slug = getQuery('slug');
  if (!slug) {
    content.innerHTML = '';
    content.append(el('div', { class: 'empty-state' },
      ico('info', 'icon icon-xxl'),
      el('h3', null, t('noApp')),
      el('p', null, t('badLink')),
    ));
    return;
  }

  function sdkName(sdk) {
    const pre = window.GSLang.getLang() === 'ar' ? 'أندرويد' : 'Android';
    const map = {
      21: pre + ' 5.0', 22: '5.1', 23: '6.0', 24: '7.0', 25: '7.1',
      26: '8.0', 27: '8.1', 28: '9.0', 29: '10', 30: '11',
      31: '12', 32: '12L', 33: '13', 34: '14', 35: '15',
    };
    return map[sdk] || (sdk ? `SDK ${sdk}` : '—');
  }

  function openModal(src) {
    const m = el('div', { class: 'modal open', onclick: (e) => { if (e.target === m) m.remove(); } },
      el('button', { class: 'close', onclick: () => m.remove(), 'aria-label': t('close') }, ico('close')),
      el('img', { src }),
    );
    document.body.append(m);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { m.remove(); document.removeEventListener('keydown', esc); }
    });
  }

  // Browser fingerprint — combines multiple signals into a single hash
  async function getFingerprint() {
    const parts = [];

    // Canvas fingerprint
    try {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 64;
      const ctx = cv.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(50, 0, 100, 30);
      ctx.fillStyle = '#069';
      ctx.fillText('GoldenStore\uD83D\uDE00fp', 2, 4);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('GoldenStore\uD83D\uDE00fp', 4, 8);
      parts.push(cv.toDataURL());
    } catch { parts.push('no-canvas'); }

    // WebGL fingerprint
    try {
      const cv2 = document.createElement('canvas');
      const gl = cv2.getContext('webgl') || cv2.getContext('experimental-webgl');
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        parts.push(gl.getParameter(gl.RENDERER));
        parts.push(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '');
        parts.push(dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : '');
      }
    } catch { parts.push('no-webgl'); }

    // Screen + hardware
    parts.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
    parts.push(String(navigator.hardwareConcurrency || 0));
    parts.push(String(navigator.maxTouchPoints || 0));
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    parts.push(navigator.language || '');
    parts.push(String(navigator.deviceMemory || 0));
    parts.push(navigator.platform || '');

    // Audio fingerprint
    try {
      const actx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 5000, 44100);
      const osc = actx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 10000;
      const comp = actx.createDynamicsCompressor();
      osc.connect(comp);
      comp.connect(actx.destination);
      osc.start(0);
      const buf = await actx.startRendering();
      const data = buf.getChannelData(0);
      let sum = 0;
      for (let i = 4500; i < 5000; i++) sum += Math.abs(data[i]);
      parts.push(sum.toFixed(6));
    } catch { parts.push('no-audio'); }

    // Hash all parts
    const raw = parts.join('|||');
    const encoder = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  try {
    const { app, screenshots } = await api(`/api/apps/${encodeURIComponent(slug)}`);
    const titleSuffix = window.GSLang.getLang() === 'ar' ? 'مهكّر مجاناً' : 'Free Modded';
    document.title = `${app.name} — ${titleSuffix} — Goldenstore`;
    content.innerHTML = '';

    // Star button
    const starCount = el('span', { class: 'star-count' }, formatNum(app.stars || 0));
    const starBtn = el('button', {
      class: 'btn-star',
      'aria-label': t('giveStar'),
      onclick: handleStar,
    }, ico('star'), starCount);

    let voted = false;
    let fingerprint = null;

    // Check if already voted (async)
    (async () => {
      try {
        fingerprint = await getFingerprint();
        const res = await api(`/api/apps/${encodeURIComponent(app.slug)}/star-check`, {
          method: 'POST',
          body: { fp: fingerprint },
        });
        if (res.voted) {
          voted = true;
          starBtn.classList.add('voted');
        }
      } catch {}
    })();

    async function handleStar() {
      if (voted) {
        toast(t('alreadyVoted'), 'info');
        return;
      }
      starBtn.disabled = true;
      try {
        if (!fingerprint) fingerprint = await getFingerprint();
        const res = await api(`/api/apps/${encodeURIComponent(app.slug)}/star`, {
          method: 'POST',
          body: { fp: fingerprint },
        });
        voted = true;
        starBtn.classList.add('voted');
        starCount.textContent = formatNum(res.stars);
        toast(t('thanksStar'), 'success');
      } catch (e) {
        if (e && e.status === 409) {
          voted = true;
          starBtn.classList.add('voted');
          toast(t('alreadyVoted'), 'info');
        } else {
          toast(t('errorRetry'), 'error');
        }
      } finally {
        starBtn.disabled = false;
      }
    }

    // Hero
    content.append(el('section', { class: 'app-hero' },
      el('div', { class: 'icon-big' },
        app.icon_url
          ? el('img', { src: app.icon_url, alt: app.name })
          : ico('package', 'icon icon-xxl')
      ),
      el('div', null,
        el('h1', null, app.name),
        app.developer ? el('div', { class: 'dev' }, app.developer) : null,
        el('div', { class: 'quick-stats' },
          el('div', { class: 'stat' }, el('div', { class: 'v' }, formatNum(app.downloads)), el('div', { class: 'l' }, t('downloads'))),
          el('div', { class: 'stat' }, el('div', { class: 'v' }, formatNum(app.stars || 0)), el('div', { class: 'l' }, t('stars'))),
          el('div', { class: 'stat' }, el('div', { class: 'v' }, app.version_name || '—'), el('div', { class: 'l' }, t('version'))),
          el('div', { class: 'stat' }, el('div', { class: 'v' }, formatBytes(app.size_bytes)), el('div', { class: 'l' }, t('size'))),
          el('div', { class: 'stat' }, el('div', { class: 'v' }, sdkName(app.min_sdk)), el('div', { class: 'l' }, t('minSdk'))),
        ),
        el('div', { class: 'download-bar' },
          el('a', { class: 'btn btn-primary btn-lg', href: `/api/apps/${encodeURIComponent(app.slug)}/download` },
            ico('download'), t('downloadBtn') + ' ', formatBytes(app.size_bytes)),
          starBtn,
        ),
      ),
    ));

    // Short description
    if (app.short_description) {
      content.append(el('section', { class: 'panel' },
        el('div', { class: 'panel-head' }, ico('info'), t('summary')),
        el('p', null, app.short_description),
      ));
    }

    // Screenshots
    if (screenshots && screenshots.length) {
      const row = el('div', { class: 'screenshots' });
      screenshots.forEach((ss) => {
        if (!ss.url) return;
        row.append(el('img', { src: ss.url, alt: '', onclick: () => openModal(ss.url) }));
      });
      content.append(el('section', { class: 'panel' },
        el('div', { class: 'panel-head' }, ico('image'), t('screenshots')),
        row,
      ));
    }

    // Full description
    if (app.description) {
      content.append(el('section', { class: 'panel' },
        el('div', { class: 'panel-head' }, ico('book'), t('description')),
        el('p', { class: 'desc' }, app.description),
      ));
    }

    // Tech info
    content.append(el('section', { class: 'panel' },
      el('div', { class: 'panel-head' }, ico('android'), t('techInfo')),
      el('div', { class: 'tech-grid' },
        techCell(t('pkgName'), app.package_name || '—'),
        techCell(t('version'), app.version_name || '—'),
        techCell(t('versionCode'), app.version_code != null ? String(app.version_code) : '—'),
        techCell(t('minAndroid'), sdkName(app.min_sdk)),
        techCell(t('size'), formatBytes(app.size_bytes)),
        techCell(t('dlCount'), formatNum(app.downloads)),
        techCell(t('starsCount'), formatNum(app.stars || 0)),
        techCell(t('developer'), app.developer || '—'),
        techCell(t('category'), app.category || '—'),
        techCell(t('publishDate'), formatDate(app.created_at)),
        techCell(t('lastUpdate'), formatDate(app.updated_at)),
      ),
    ));

    content.append(el('div', { class: 'muted mt-md', style: 'text-align:center; font-size:13px;' },
      t('installHint')));

    function techCell(label, value) {
      return el('div', { class: 'tech-cell' },
        el('span', { class: 'l' }, label),
        el('span', { class: 'v' }, value),
      );
    }
  } catch (e) {
    content.innerHTML = '';
    let title = t('appNotFound');
    let detail = t('checkLink');
    if (e && (e.status === 0 || e.message === 'timeout')) {
      title = t('connError');
      detail = t('connHint');
    } else if (e && e.status >= 500) {
      title = t('svcError');
      detail = t('svcHint');
    }
    content.append(el('div', { class: 'empty-state' },
      ico('info', 'icon icon-xxl'),
      el('h3', null, title),
      el('p', null, detail),
      el('div', { class: 'mt-md' },
        el('a', { class: 'btn btn-primary', href: '/' }, t('backHome')),
      ),
    ));
  }
})();
