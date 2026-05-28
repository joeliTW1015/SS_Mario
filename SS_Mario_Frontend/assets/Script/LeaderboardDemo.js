// Attach to any node in a scene to verify the leaderboard works (Cocos 2.4.8).
// On start it logs the leaderboard as JSON. Tick `submitTestEntry` in the
// inspector to also POST one random entry before reading (to confirm writes).

const Leaderboard = require("Leaderboard");

cc.Class({
  extends: cc.Component,

  properties: {
    submitTestEntry: false,
    testName: "tester",
    testLevel: 1,
  },

  start: function () {
    const self = this;
    let chain = Promise.resolve();

    if (self.submitTestEntry) {
      const score = Math.floor(Math.random() * 10000);
      chain = chain
        .then(function () { return Leaderboard.submitEntry(self.testName, self.testLevel, score); })
        .then(function (key) {
          cc.log("[Leaderboard] submitted", self.testName, "lvl", self.testLevel, "score", score, "->", key);
        });
    }

    chain
      .then(function () { return Leaderboard.getLeaderboardJSON(); })
      .then(function (json) { cc.log("[Leaderboard] entries:", json); })
      .catch(function (e) { cc.error("[Leaderboard] error:", (e && e.message) ? e.message : e); });
  },
});
