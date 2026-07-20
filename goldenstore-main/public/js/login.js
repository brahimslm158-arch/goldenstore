// Dedicated sign-in page. Kept isolated from the rest of the store so the
// auth flow can't race with page rendering.
(function () {
  'use strict';

  var T = (window.GSI18N && window.GSI18N.t) ? window.GSI18N.t : function (s) { return s; };

  var checking = document.getElementById('checking');
  var btn = document.getElementById('signin');
  var errBox = document.getElementById('error');
  var label = btn ? btn.querySelector('.gbtn-label') : null;
  var navigated = false;
  var triedAnonymous = false;

  // Where to go after a successful sign-in. Only same-origin paths are allowed,
  // and never back to the login page itself.
  function nextTarget() {
    try {
      var raw = new URLSearchParams(location.search).get('next');
      if (raw && raw.charAt(0) === '/' && raw.indexOf('//') !== 0 &&
          raw.indexOf('/login') !== 0) {
        return raw;
      }
    } catch (e) {}
    return '/';
  }

  function go() {
    if (navigated) return;
    navigated = true;
    location.replace(nextTarget());
  }

  function showButton() {
    if (checking) checking.style.display = 'none';
    if (btn) btn.style.display = 'inline-flex';
  }

  function setLoading(on) {
    if (!btn) return;
    btn.disabled = on;
    if (label) label.textContent = on ? T('جار تسجيل الدخول…') : T('متابعة بدون حساب');
  }

  function showError(msg) {
    if (errBox) {
      errBox.textContent = msg;
      errBox.classList.remove('hidden');
    }
    setLoading(false);
  }

  function errorMessage(e) {
    var code = e && e.code;
    switch (code) {
      case 'auth/in-app-browser':
        return T('افتح الصفحة في متصفّح مثل Chrome أو Safari لإتمام تسجيل الدخول بحساب Google.');
      case 'auth/unauthorized-domain':
        return 'هذا النطاق (' + location.hostname + ') غير مُصرَّح به في Firebase. أضِفه في Authentication ← Settings ← Authorized domains.';
      case 'auth/operation-not-allowed':
        return T('مزوّد Google غير مُفعَّل. فعّله في Firebase ← Authentication ← Sign-in method.');
      case 'auth/network-request-failed':
        return T('تعذّر الاتصال بالشبكة. تحقّق من الإنترنت وحاول مجدداً.');
      case 'auth/popup-blocked':
        return T('المتصفّح حظر النافذة المنبثقة. اسمح بالنوافذ المنبثقة ثم حاول مجدداً.');
      case 'auth/developer-error':
        return 'لم يتم تسجيل تطبيق Android أو بصمة SHA-1 في Firebase/Google Cloud. أضِفها في Firebase Console > Project settings > Android app > Add fingerprint. (SHA-1 مطلوب) ' + (e && e.message ? '[' + e.message + ']' : '');
      default:
        return T('تعذّر تسجيل الدخول') + (code ? ' (' + code + ')' : '') + '. ' + T('حاول مجدداً.') + (e && e.message ? ' ' + e.message : '');
    }
  }

  function tryAnonymous() {
    if (triedAnonymous) return;
    triedAnonymous = true;
    if (!window.GAuth || typeof window.GAuth.signInAnonymously !== 'function') {
      showButton();
      return;
    }
    setLoading(true);
    window.GAuth.signInAnonymously()
      .then(function (user) {
        if (user) go();
        else { setLoading(false); showButton(); }
      })
      .catch(function (e) {
        console.error('anonymous sign-in failed', e);
        setLoading(false);
        showButton();
      });
  }

  if (!window.GAuth || typeof window.GAuth.onAuthChange !== 'function') {
    showButton();
    showError('تعذّر تحميل خدمة تسجيل الدخول. حدّث الصفحة وحاول مجدداً.');
    return;
  }

  try { window.GAuth.init(); } catch (e) {}

  // If a session is (or becomes) available, leave immediately. Otherwise sign
  // in anonymously (no SHA-1 / Google account required) and continue.
  window.GAuth.onAuthChange(function (user) {
    if (user) { go(); return; }
    tryAnonymous();
  });

  // Safety: never leave the spinner forever if auth state is slow to resolve.
  setTimeout(function () { if (!navigated) tryAnonymous(); }, 3000);

  if (btn) {
    btn.addEventListener('click', function () {
      if (errBox) errBox.classList.add('hidden');
      tryAnonymous();
    });
  }
})();
