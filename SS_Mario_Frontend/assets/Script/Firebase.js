// Firebase (compat) loader + init for Cocos Creator 2.4.x web builds.
// The compat SDK is loaded from the gstatic CDN at runtime, which avoids the
// modular-npm resolution problems Cocos 2.4.x has. The apiKey below is a public
// client identifier (not a secret) — access is controlled by Realtime Database rules.

const FIREBASE_VERSION = "10.14.1";
const SDK_SCRIPTS = [
  "https://www.gstatic.com/firebasejs/" + FIREBASE_VERSION + "/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/" + FIREBASE_VERSION + "/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/" + FIREBASE_VERSION + "/firebase-database-compat.js",
];

const firebaseConfig = {
  apiKey: "AIzaSyCyim-CTL8e7m2J7F0c2QvnXCoCk5lcjXA",
  authDomain: "ss-mario-250da.firebaseapp.com",
  databaseURL: "https://ss-mario-250da-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ss-mario-250da",
  storageBucket: "ss-mario-250da.firebasestorage.app",
  messagingSenderId: "785761589762",
  appId: "1:785761589762:web:1aa15ee5634f0dce2a251b",
};

let readyPromise = null;

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    if (typeof document === "undefined") {
      reject(new Error("Firebase: no DOM available (web build only)"));
      return;
    }
    const existing = document.querySelector('script[src="' + src + '"]');
    if (existing) {
      if (existing.dataset.loaded === "true") { resolve(); return; }
      existing.addEventListener("load", function () { resolve(); });
      existing.addEventListener("error", function () { reject(new Error("Failed to load " + src)); });
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.async = false;
    el.onload = function () { el.dataset.loaded = "true"; resolve(); };
    el.onerror = function () { reject(new Error("Failed to load " + src)); };
    document.head.appendChild(el);
  });
}

// Loads + initializes Firebase exactly once. Resolves with the global firebase namespace.
function init() {
  if (readyPromise) return readyPromise;
  readyPromise = (async function () {
    for (let i = 0; i < SDK_SCRIPTS.length; i++) {
      await loadScript(SDK_SCRIPTS[i]);
    }
    const firebase = window.firebase;
    if (!firebase) throw new Error("Firebase SDK failed to load");
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    return firebase;
  })();
  return readyPromise;
}

module.exports = { init: init, config: firebaseConfig };
