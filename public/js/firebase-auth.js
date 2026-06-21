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
const _listeners = [];

function initFirebase() {
  if (_app) return;
  _app = firebase.initializeApp(FIREBASE_CONFIG);
  _auth = firebase.auth();
  _auth.languageCode = 'ar';
  _auth.onAuthStateChanged((user) => {
    _currentUser = user;
    _listeners.forEach((fn) => fn(user));
  });
}

function onAuthChange(fn) {
  _listeners.push(fn);
  if (_currentUser !== undefined) fn(_currentUser);
}

function getUser() {
  return _currentUser;
}

async function signInWithGoogle() {
  initFirebase();
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await _auth.signInWithPopup(provider);
    return result.user;
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user') return null;
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
