// Player leaderboard client for the Mario frontend (Cocos Creator 2.4.8).
// Reads/writes directly to Firebase Realtime Database — no backend server needed.
// Uses .then()/.catch() chains only (no async/await) for Cocos 2.4.x compatibility.
//
// Each entry: { username, level, score, coins, timestamp }.
//   score = completion time in seconds (lower = better; used for ranking)
//   coins = coin score collected this run (higher = better; display only)
//   timestamp = Unix epoch ms.
//
// Usage from any Cocos script:
//   const Leaderboard = require("Leaderboard");
//   Leaderboard.getLeaderboard().then(function (list) { ... });
//   Leaderboard.submitEntry("Mario", 1, 42, 300).then(function (entry) { ... });

var Firebase = require("Firebase");

var PATH = "leaderboard";
var MAX_NAME_LEN = 20;

// Fetch all leaderboard entries. Resolves with an array of
// { key, username, level, score, timestamp }, sorted by score ascending
// (lowest time first = best).
function getLeaderboard() {
  return Firebase.init().then(function (firebase) {
    return firebase.database().ref(PATH)
      .orderByChild("score")
      .once("value");
  }).then(function (snap) {
    var out = [];
    snap.forEach(function (child) {
      var v = child.val();
      if (!v) { return; }
      out.push({
        key: child.key,
        username: v.username,
        level: v.level,
        score: v.score,
        coins: (v.coins != null ? v.coins : 0),
        timestamp: v.timestamp
      });
    });
    // orderByChild("score") returns ascending; keep that order
    // (lower time = better for time-based leaderboard)
    return out;
  });
}

// Same as getLeaderboard() but resolves with a JSON string.
function getLeaderboardJSON() {
  return getLeaderboard().then(function (list) {
    return JSON.stringify(list);
  });
}

// Push a new entry to the leaderboard. Resolves with the created entry object.
// timestamp is stamped server-side via ServerValue.TIMESTAMP.
function submitEntry(username, level, score, coins) {
  return Firebase.init().then(function (firebase) {
    var entry = {
      username: String(username == null ? "anonymous" : username).slice(0, MAX_NAME_LEN),
      level: Number(level) || 0,
      score: Number(score) || 0,
      coins: Number(coins) || 0,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    };
    var ref = firebase.database().ref(PATH).push();
    return ref.set(entry).then(function () {
      return {
        key: ref.key,
        username: entry.username,
        level: entry.level,
        score: entry.score,
        coins: entry.coins,
        timestamp: Date.now(),
      };
    });
  });
}

// No-op — kept for backward compatibility with older code that called setBaseUrl().
function setBaseUrl() { }

module.exports = {
  getLeaderboard: getLeaderboard,
  getLeaderboardJSON: getLeaderboardJSON,
  submitEntry: submitEntry,
  setBaseUrl: setBaseUrl,
};
