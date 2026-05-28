// Realtime Database leaderboard helper. Usage from any Cocos script:
//   const Leaderboard = require("Leaderboard");
//   await Leaderboard.submitScore("player", 1234);
//   const top = await Leaderboard.getTopScores(10);

const Firebase = require("Firebase");

const PATH = "leaderboard";
const MAX_NAME_LEN = 20;

// Adds a score entry. Resolves with the new entry's key.
async function submitScore(name, score) {
  const firebase = await Firebase.init();
  const ref = firebase.database().ref(PATH).push();
  await ref.set({
    name: String(name == null ? "anonymous" : name).slice(0, MAX_NAME_LEN),
    score: Number(score) || 0,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
  });
  return ref.key;
}

// Fetches the top `limit` scores (default 10), highest first.
async function getTopScores(limit) {
  const n = limit || 10;
  const firebase = await Firebase.init();
  const snap = await firebase.database().ref(PATH)
    .orderByChild("score")
    .limitToLast(n)
    .once("value");
  const out = [];
  snap.forEach(function (child) {
    const v = child.val() || {};
    out.push({ key: child.key, name: v.name, score: v.score, createdAt: v.createdAt });
  });
  out.sort(function (a, b) { return b.score - a.score; });
  return out;
}

module.exports = { submitScore: submitScore, getTopScores: getTopScores };
