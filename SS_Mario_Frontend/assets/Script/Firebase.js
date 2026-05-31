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

function init() {
  if (readyPromise) return readyPromise;
  // Load SDK scripts sequentially, then init the app.
  readyPromise = SDK_SCRIPTS.reduce(function (chain, src) {
    return chain.then(function () { return loadScript(src); });
  }, Promise.resolve()).then(function () {
    const firebase = window.firebase;
    if (!firebase) throw new Error("Firebase SDK failed to load");
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    // Per-tab auth session. The default (LOCAL) shares the logged-in user
    // across tabs of the same browser via localStorage, which breaks
    // multiplayer testing on one machine: tab 2 logging in as account B
    // overwrites tab 1's account A session, so both tabs read currentUser
    // as B → same uid → they write to the same RTDB node → no ghosts.
    return firebase.auth()
      .setPersistence(firebase.auth.Auth.Persistence.SESSION)
      .then(function () { return firebase; })
      .catch(function (e) {
        if (typeof cc !== "undefined") {
          cc.warn("[Firebase] setPersistence(SESSION) failed:", e);
        }
        return firebase;
      });
  });
  return readyPromise;
}

module.exports = { init: init, config: firebaseConfig };
