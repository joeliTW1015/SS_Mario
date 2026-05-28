const Auth = require("Auth");
const Firebase = require("Firebase");
const Leaderboard = require("Leaderboard");

const { ccclass, property } = cc._decorator;

// Module-level singleton reference (avoids static field issues in Cocos 2.4.x)
let _instance: GameManager = null;

@ccclass
export default class GameManager extends cc.Component {

  // ─── singleton ───────────────────────────────────────────────────────────────

  static getInstance(): GameManager {
    return _instance;
  }

  // ─── inspector properties ────────────────────────────────────────────────────

  @property(cc.Node)
  gameOverPanel: cc.Node = null;

  @property(cc.Node)
  winPanel: cc.Node = null;

  @property(cc.Label)
  livesLabel: cc.Label = null;

  @property(cc.Label)
  scoreLabel: cc.Label = null;

  @property(cc.Label)
  timerLabel: cc.Label = null;

  @property(cc.AudioClip)
  bgm: cc.AudioClip = null;

  @property(cc.AudioClip)
  sfxDeath: cc.AudioClip = null;

  @property(cc.AudioClip)
  sfxScore: cc.AudioClip = null;

  // ─── game state ──────────────────────────────────────────────────────────────

  lives: number = 3;
  score: number = 0;

  @property
  timerSeconds: number = 200;

  @property
  currentLevel: number = 1;

  playerState: string = "SMALL";   // "SMALL" | "BIG" | "DEAD"

  private initialTimerSeconds: number = 200;
  private timerRunning: boolean = false;
  private bgmId: number = -1;
  private gameEnded: boolean = false;

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    _instance = this;
    this.initialTimerSeconds = this.timerSeconds;

    // Enable Box2D physics
    const physics = cc.director.getPhysicsManager();
    physics.enabled = true;
    physics.gravity = cc.v2(0, -960);

    // Hide end-game panels
    if (this.gameOverPanel) { this.gameOverPanel.active = false; }
    if (this.winPanel)      { this.winPanel.active = false; }

    // Init HUD
    this.updateLivesLabel();
    this.updateScoreLabel();
    this.updateTimerLabel();

    // Start BGM
    if (this.bgm) {
      this.bgmId = cc.audioEngine.playMusic(this.bgm, true);
    }

    // Load saved progress then start timer
    const self = this;
    this.loadProgress().then(function () {
      self.timerRunning = true;
    }).catch(function () {
      self.timerRunning = true;
    });
  }

  onDestroy() {
    if (_instance === this) { _instance = null; }
  }

  update(dt: number) {
    if (!this.timerRunning || this.gameEnded) { return; }

    this.timerSeconds -= dt;
    if (this.timerSeconds < 0) { this.timerSeconds = 0; }
    this.updateTimerLabel();

    if (this.timerSeconds <= 0) {
      this.timerRunning = false;
      this.triggerPlayerDeath();
    }
  }

  // ─── score / lives ───────────────────────────────────────────────────────────

  addScore(points: number) {
    this.score += points;
    this.updateScoreLabel();
    if (this.sfxScore) { cc.audioEngine.playEffect(this.sfxScore, false); }
    this.saveProgress();
  }

  triggerPlayerDeath() {
    if (this.gameEnded) { return; }
    this.lives--;
    if (this.lives < 0) { this.lives = 0; }
    this.updateLivesLabel();

    if (this.sfxDeath) { cc.audioEngine.playEffect(this.sfxDeath, false); }

    if (this.lives <= 0) {
      this.showGameOver();
    } else {
      const self = this;
      this.scheduleOnce(function () {
        cc.director.loadScene("Level1");
      }, 1.5);
    }
  }

  // ─── end states ──────────────────────────────────────────────────────────────

  showGameOver() {
    if (this.gameEnded) { return; }
    this.gameEnded = true;
    this.timerRunning = false;
    cc.audioEngine.stopMusic();
    if (this.gameOverPanel) { this.gameOverPanel.active = true; }
    const self = this;
    this.scheduleOnce(function () {
      self.restartLevel();
    }, 3);
  }

  showWin() {
    if (this.gameEnded) { return; }
    this.gameEnded = true;
    this.timerRunning = false;
    cc.audioEngine.stopMusic();
    if (this.winPanel) { this.winPanel.active = true; }
    this.saveProgress();
    this.submitToLeaderboard();
    const self = this;
    this.scheduleOnce(function () {
      self.goToLevelSelect();
    }, 3);
  }

  // Submit completion time to the backend leaderboard
  private submitToLeaderboard() {
    const elapsed = Math.floor(this.initialTimerSeconds - this.timerSeconds);
    const level   = this.currentLevel;
    Auth.currentUser().then(function (user: any) {
      var name = "anonymous";
      if (user) {
        name = user.username || user.email || "anonymous";
      }
      cc.log("[GameManager] Submitting to leaderboard: " + name + " level=" + level + " time=" + elapsed + "s");
      return Leaderboard.submitEntry(name, level, elapsed);
    }).then(function (result: any) {
      cc.log("[GameManager] Leaderboard submit success:", result);
    }).catch(function (e: any) {
      cc.warn("[GameManager] Leaderboard submit failed:", e);
    });
  }

  // ─── scene navigation ────────────────────────────────────────────────────────

  restartLevel() {
    cc.director.loadScene("Level1");
  }

  goToLevelSelect() {
    cc.director.loadScene("LevelSelectScene");
  }

  // ─── Firebase progress ───────────────────────────────────────────────────────

  saveProgress() {
    const self = this;
    Auth.currentUser().then(function (user) {
      if (!user) { return; }
      return Firebase.init().then(function (firebase) {
        return firebase.database()
          .ref("users/" + user.uid + "/gameProgress")
          .set({
            score: self.score,
            lives: self.lives,
            level: self.currentLevel,
            savedAt: firebase.database.ServerValue.TIMESTAMP,
          });
      });
    }).catch(function (e) {
      cc.warn("[GameManager] saveProgress failed:", e);
    });
  }

  loadProgress() {
    const self = this;
    return Auth.currentUser().then(function (user) {
      if (!user) { return; }
      return Firebase.init().then(function (firebase) {
        return firebase.database()
          .ref("users/" + user.uid + "/gameProgress")
          .once("value")
          .then(function (snap) {
            const data = snap.val();
            if (!data) { return; }
            if (typeof data.score === "number") {
              self.score = data.score;
              self.updateScoreLabel();
            }
            if (typeof data.lives === "number" && data.lives > 0) {
              self.lives = data.lives;
              self.updateLivesLabel();
            }
            if (typeof data.level === "number") {
              self.currentLevel = data.level;
            }
          });
      });
    });
  }

  // ─── HUD helpers ─────────────────────────────────────────────────────────────

  private updateLivesLabel() {
    if (this.livesLabel) {
      this.livesLabel.string = "x" + this.lives;
    }
  }

  private updateScoreLabel() {
    if (this.scoreLabel) {
      // Zero-pad to 6 digits
      let s = String(this.score);
      while (s.length < 6) { s = "0" + s; }
      this.scoreLabel.string = s;
    }
  }

  private updateTimerLabel() {
    if (this.timerLabel) {
      this.timerLabel.string = String(Math.ceil(this.timerSeconds));
    }
  }
}
