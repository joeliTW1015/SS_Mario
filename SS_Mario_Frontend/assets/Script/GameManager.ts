const Auth = require("Auth");
const Firebase = require("Firebase");
const Leaderboard = require("Leaderboard");
const FocusManager = require("FocusManager");
const SettingsPanel = require("SettingsPanel");

const { ccclass, property } = cc._decorator;

// Module-level singleton reference (avoids static field issues in Cocos 2.4.x)
let _instance: GameManager = null;

// Lives must survive scene reloads. `cc.director.loadScene` rebuilds every
// node so any field initializer (e.g. `lives = 3`) is reset — but module-level
// variables persist, so we stash the count here.
const DEFAULT_LIVES = 3;
let _persistedLives: number = DEFAULT_LIVES;

// Same trick for the timer: when the player dies but still has lives, the
// clock must NOT refill on respawn. Sentinel -1 means "not yet persisted —
// fall back to the @property default the editor set".
let _persistedTimer: number = -1;

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
  timerLabel: cc.Label = null;

  @property(cc.AudioClip)
  bgm: cc.AudioClip = null;

  @property(cc.AudioClip)
  sfxDeath: cc.AudioClip = null;

  // ─── game state ──────────────────────────────────────────────────────────────

  lives: number = 3;

  @property
  timerSeconds: number = 200;

  @property
  currentLevel: number = 1;

  playerState: string = "SMALL";   // "SMALL" | "BIG" | "DEAD"

  private initialTimerSeconds: number = 200;
  private timerRunning: boolean = false;
  private bgmId: number = -1;
  private gameEnded: boolean = false;
  // Re-entry guard for triggerPlayerDeath. Prevents double-decrement when
  // multiple sources (enemy + DeadZone + timer) all fire in the same death.
  private dying: boolean = false;

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    _instance = this;
    this.initialTimerSeconds = this.timerSeconds;

    // Restore the persisted life count (carries across loadScene reloads).
    // First-ever scene load: _persistedLives is DEFAULT_LIVES.
    this.lives = _persistedLives;

    // Restore the persisted clock if a previous life left one. On a fresh game
    // it's still -1, so the @property default from the editor stays in effect.
    if (_persistedTimer >= 0) {
      this.timerSeconds = _persistedTimer;
    }

    // Enable Box2D physics
    const physics = cc.director.getPhysicsManager();
    physics.enabled = true;
    physics.gravity = cc.v2(0, -960);

    // Hide end-game panels
    if (this.gameOverPanel) { this.gameOverPanel.active = false; }
    if (this.winPanel)      { this.winPanel.active = false; }

    // Init HUD
    this.updateLivesLabel();
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

    // Auto-attach multiplayer ghost sync so no editor wiring is needed.
    // Becomes a no-op if no user is logged in (see MultiplayerSync.start).
    if (!this.node.getComponent("MultiplayerSync")) {
      this.node.addComponent("MultiplayerSync");
    }

    // Accessibility: enemy proximity audio cues (stereo-positioned). Plus
    // keyboard focus manager (persists across scenes) and the Esc-toggled
    // HTML settings overlay.
    if (!this.node.getComponent("AudioCueManager")) {
      this.node.addComponent("AudioCueManager");
    }
    FocusManager.ensure();
    SettingsPanel.init();
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

  // ─── lives ───────────────────────────────────────────────────────────────────

  triggerPlayerDeath() {
    // Guard against double-decrement: between the moment a death is triggered
    // and the scene actually reloading (1.5 s later), other sources (DeadZone,
    // timer, another enemy contact) can still try to deduct a life.
    if (this.gameEnded || this.dying) { return; }
    this.dying = true;
    // Freeze the clock during the death animation so it doesn't tick down
    // for free while the player is dead.
    this.timerRunning = false;

    this.lives--;
    if (this.lives < 0) { this.lives = 0; }
    _persistedLives = this.lives;   // carry the new count across the scene reload
    this.updateLivesLabel();

    if (this.sfxDeath) { cc.audioEngine.playEffect(this.sfxDeath, false); }

    if (this.lives <= 0) {
      this.showGameOver();
    } else {
      // Still have lives — carry the remaining time over so respawning the
      // level doesn't refill the clock.
      _persistedTimer = this.timerSeconds;
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
    // The run is over — refill lives AND reset the clock for the next attempt.
    _persistedLives = DEFAULT_LIVES;
    _persistedTimer = -1;
    // After showing the Game Over panel for a moment, return to level selection
    // (not restart the same level — the player has already lost all lives).
    const self = this;
    this.scheduleOnce(function () {
      self.goToLevelSelect();
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
    // Player cleared the level — refresh lives and clock for the next run.
    _persistedLives = DEFAULT_LIVES;
    _persistedTimer = -1;
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
      this.livesLabel.string = "Lives: x" + this.lives;
    }
  }

  private updateTimerLabel() {
    if (this.timerLabel) {
      const total = Math.max(0, Math.ceil(this.timerSeconds));
      const mm = Math.floor(total / 60);
      const ss = total % 60;
      const mmStr = (mm < 10 ? "0" : "") + mm;
      const ssStr = (ss < 10 ? "0" : "") + ss;
      this.timerLabel.string = "TIME: " + mmStr + ":" + ssStr;
    }
  }
}
