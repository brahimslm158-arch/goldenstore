// Firebase Auth — Google Sign-in module
// Uses Firebase compat SDK loaded from CDN in HTML

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC8Ea0p8KXudJWyt8_olKrGBjI52P9EoEM",
  authDomain: "ahmed-88be9.firebaseapp.com",
  databaseURL: "https://ahmed-88be9-default-rtdb.firebaseio.com",
  projectId: "ahmed-88be9",
  storageBucket: "ahmed-88be9.firebasestorage.app",
  messagingSenderId: "152065600130",
  appId: "1:152065600130:web:1824f21e11207e0edee29b",
  measurementId: "G-5VN0LTLNGX"
};

let _app = null;
let _auth = null;
let _currentUser = null;
let _resolved = false; // true once Firebase reports the initial auth state
const _listeners = [];

function initFirebase() {
  if (_app) return;
  _app = firebase.initializeApp(FIREBASE_CONFIG);
  _auth = firebase.auth();
  _auth.languageCode = 'ar';
  _auth.onAuthStateChanged((user) => {
    _currentUser = user;
    _resolved = true;
    _listeners.forEach((fn) => fn(user));
  });
  // Complete any pending redirect-based sign-in.
  _auth.getRedirectResult().catch((e) => {
    if (e && e.code) console.error('getRedirectResult', e.code, e.message);
  });
}

function onAuthChange(fn) {
  _listeners.push(fn);
  // Only fire immediately if Firebase has already resolved the session,
  // to avoid flashing the login screen for already-signed-in users.
  if (_resolved) fn(_currentUser);
}

function getUser() {
  return _currentUser;
}

function makeProvider() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function isMobileOrInApp() {
  var ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua) || /FBAN|FBAV|Instagram|Line|Twitter|Snapchat|TikTok|WebView|wv\)/i.test(ua);
}

async function signInWithGoogle() {
  initFirebase();
  // On mobile / in-app browsers, go straight to redirect (popups are unreliable).
  if (isMobileOrInApp()) {
    try {
      await _auth.signInWithRedirect(makeProvider());
    } catch (e) {
      throw e;
    }
    return null;
  }
  try {
    var result = await _auth.signInWithPopup(makeProvider());
    return result.user;
  } catch (e) {
    var code = e && e.code;
    // User dismissed the popup — not an error worth surfacing.
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
    // Popups blocked, unsupported, or cross-origin issue: fall back to redirect.
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment' || code === 'auth/web-storage-unsupported') {
      await _auth.signInWithRedirect(makeProvider());
      return null;
    }
    throw e;
  }
}

async function signOut() {
  if (_auth) await _auth.signOut();
}

window.GAuth = {
  init: initFirebase,
  onAuthChange,
  getUser,
  signInWithGoogle,
  signOut,
};

// Auto-init
document.addEventListener('DOMContentLoaded', initFirebase);
