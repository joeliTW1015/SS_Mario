// Attach to any node in a scene to verify the Firebase leaderboard works.
// On start it logs the top scores. Tick `submitTestScore` in the inspector to
// also write one random score before reading (so you can confirm writes).

const Leaderboard = require("Leaderboard");

cc.Class({
  extends: cc.Component,

  properties: {
    submitTestScore: false,
    testName: "tester",
  },

  start: function () {
    const self = this;
    (async function () {
      try {
        if (self.submitTestScore) {
          const score = Math.floor(Math.random() * 10000);
          const key = await Leaderboard.submitScore(self.testName, score);
          cc.log("[Leaderboard] submitted", self.testName, score, "->", key);
        }
        const top = await Leaderboard.getTopScores(10);
        cc.log("[Leaderboard] top scores:", JSON.stringify(top));
      } catch (e) {
        cc.error("[Leaderboard] error:", (e && e.message) ? e.message : e);
      }
    })();
  },
});
