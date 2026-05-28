const Firebase = require("Firebase");

const PATH = "leaderboard";
const MAX_NAME_LEN = 20;

// Adds a score entry. Resolves with the new entry's key.
function submitScore(name, score) {
  return Firebase.init()
    .then(function (firebase) {
      const ref = firebase.database().ref(PATH).push();
      return ref.set({
        name: String(name == null ? "anonymous" : name).slice(0, MAX_NAME_LEN),
        score: Number(score) || 0,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
      }).then(function () {
        return ref.key;
      });
    });
}

// Fetches the top `limit` scores (default 10), highest first.
function getTopScores(limit) {
  const n = limit || 10;
  return Firebase.init()
    .then(function (firebase) {
      return firebase.database().ref(PATH)
        .orderByChild("score")
        .limitToLast(n)
        .once("value");
    })
    .then(function (snap) {
      const out = [];
      snap.forEach(function (child) {
        const v = child.val() || {};
        out.push({ key: child.key, name: v.name, score: v.score, createdAt: v.createdAt });
      });
      out.sort(function (a, b) { return b.score - a.score; });
      return out;
    });
}

module.exports = { submitScore: submitScore, getTopScores: getTopScores };
