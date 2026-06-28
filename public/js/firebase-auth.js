// Firebase Auth — Google Sign-in module
// Uses Firebase compat SDK loaded from CDN in HTML

var FIREBASE_CONFIG = {
  apiKey: "AIzaSyC8Ea0p8KXudJWyt8_olKrGBjI52P9EoEM",
  authDomain: "ahmed-88be9.firebaseapp.com",
  databaseURL: "https://ahmed-88be9-default-rtdb.firebaseio.com",
  projectId: "ahmed-88be9",
  storageBucket: "ahmed-88be9.firebasestorage.app",
  messagingSenderId: "152065600130",
  appId: "1:152065600130:web:1824f21e11207e0edee29b",
  measurementId: "G-5VN0LTLNGX"
};

var _app = null;
var _auth = null;
var _currentUser = null;
var _resolved = false;
var _listeners = [];
var _redirectPending = false;

function initFirebase() {
  if (_app) return;
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded');
    return;
  }
  _app = firebase.initializeApp(FIREBASE_CONFIG);
  _auth = firebase.auth();
  _auth.languageCode = 'ar';
  _auth.onAuthStateChanged(function(user) {
    _currentUser = user;
    _resolved = true;
    _listeners.forEach(function(fn) { fn(user); });
  });
  // Complete any pending redirect-based sign-in.
  _auth.getRedirectResult().then(function(result) {
    if (result && result.user) {
      _redirectPending = false;
      // onAuthStateChanged will fire and handle the rest
    }
  }).catch(function(e) {
    _redirectPending = false;
    if (e && e.code) console.error('getRedirectResult', e.code, e.message);
    // Notify listeners so the gate re-renders with button enabled
    _listeners.forEach(function(fn) { fn(null); });
  });
}

function onAuthChange(fn) {
  _listeners.push(fn);
  if (_resolved) fn(_currentUser);
}

function getUser() {
  return _currentUser;
}

function makeProvider() {
  var provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

// Always use redirect on mobile/in-app — popups are unreliable there.
function shouldUseRedirect() {
  var ua = navigator.userAgent || '';
  if (/FBAN|FBAV|Instagram|Line|Twitter|Snapchat|TikTok|WebView|wv\)/i.test(ua)) return true;
  // Also use redirect on Android/iOS to avoid popup issues
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
  return false;
}

async function signInWithGoogle() {
  initFirebase();
  if (!_auth) throw new Error('Firebase not initialized');

  if (shouldUseRedirect()) {
    _redirectPending = true;
    await _auth.signInWithRedirect(makeProvider());
    // Page will reload after redirect; this line won't execute.
    return null;
  }

  // Desktop: try popup first
  try {
    var result = await _auth.signInWithPopup(makeProvider());
    return result.user;
  } catch (e) {
    var code = e && e.code;
    // User dismissed the popup — not an error.
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return null;
    }
    // Popup blocked or unsupported: fall back to redirect.
    if (code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/web-storage-unsupported') {
      _redirectPending = true;
      await _auth.signInWithRedirect(makeProvider());
      return null;
    }
    // Any other error: throw so the UI shows it
    throw e;
  }
}

async function signOut() {
  if (_auth) await _auth.signOut();
}

window.GAuth = {
  init: initFirebase,
  onAuthChange: onAuthChange,
  getUser: getUser,
  signInWithGoogle: signInWithGoogle,
  signOut: signOut,
  isRedirectPending: function() { return _redirectPending; },
};

// Auto-init
document.addEventListener('DOMContentLoaded', initFirebase);
