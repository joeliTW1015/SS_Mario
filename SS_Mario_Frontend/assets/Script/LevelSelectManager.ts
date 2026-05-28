const Auth        = require("Auth");
const Leaderboard = require("Leaderboard");

const { ccclass, property } = cc._decorator;

@ccclass
export default class LevelSelectManager extends cc.Component {

  // ─── inspector properties ────────────────────────────────────────────────────

  @property(cc.Button)
  level1Button: cc.Button = null;

  @property(cc.Button)
  logoutButton: cc.Button = null;

  @property(cc.Label)
  usernameLabel: cc.Label = null;

  @property(cc.Label)
  leaderboardLabel: cc.Label = null;

  @property(cc.Node)
  leaderboardPanel: cc.Node = null;

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    this.autoFindNodes();
    this.wireButtons();
    this.loadUserInfo();
    this.loadLeaderboard();
  }

  // ─── auto-find ───────────────────────────────────────────────────────────────

  private autoFindNodes() {
    const c = this.node;

    if (!this.level1Button) {
      const n = cc.find("Level1Button", c);
      if (n) { this.level1Button = n.getComponent(cc.Button); }
    }
    if (!this.logoutButton) {
      const n = cc.find("LogoutButton", c);
      if (n) { this.logoutButton = n.getComponent(cc.Button); }
    }
    if (!this.usernameLabel) {
      const n = cc.find("UsernameLabel", c);
      if (n) { this.usernameLabel = n.getComponent(cc.Label); }
    }
    if (!this.leaderboardLabel) {
      const n = cc.find("LeaderboardLabel", c);
      if (n) { this.leaderboardLabel = n.getComponent(cc.Label); }
    }
    if (!this.leaderboardPanel) {
      const n = cc.find("LeaderboardPanel", c);
      if (n) { this.leaderboardPanel = n; }
    }

    if (!this.level1Button)      { cc.warn("[LevelSelectManager] Level1Button not found"); }
    if (!this.logoutButton)      { cc.warn("[LevelSelectManager] LogoutButton not found"); }
    if (!this.usernameLabel)     { cc.warn("[LevelSelectManager] UsernameLabel not found"); }
    if (!this.leaderboardLabel)  { cc.warn("[LevelSelectManager] LeaderboardLabel not found"); }
  }

  // ─── button wiring ───────────────────────────────────────────────────────────

  private wireButtons() {
    if (this.level1Button) {
      this.level1Button.node.on("click", this.onLevel1Click, this);
    }
    if (this.logoutButton) {
      this.logoutButton.node.on("click", this.onLogoutClick, this);
    }
  }

  // ─── data loading ────────────────────────────────────────────────────────────

  private loadUserInfo() {
    const self = this;
    Auth.currentUser().then(function (user) {
      if (!user) {
        // Not logged in — redirect back to start
        cc.director.loadScene("StartScene");
        return;
      }
      if (self.usernameLabel) {
        self.usernameLabel.string = "Welcome, " + (user.username || user.email) + "!";
      }
    }).catch(function (e) {
      cc.warn("[LevelSelectManager] loadUserInfo failed:", e);
    });
  }

  private loadLeaderboard() {
    if (!this.leaderboardLabel) { return; }
    const self = this;
    self.leaderboardLabel.string = "Loading...";

    Leaderboard.getTopScores(10).then(function (scores) {
      if (!scores || scores.length === 0) {
        self.leaderboardLabel.string = "No scores yet!";
        return;
      }

      let text = "─ TOP SCORES ─\n";
      // Use regular for loop (not for...of) for ES5 compatibility
      for (let i = 0; i < scores.length; i++) {
        const entry = scores[i];
        const rank  = String(i + 1);
        const name  = String(entry.name || "???").slice(0, 12);
        let   scoreStr = String(entry.score || 0);
        while (scoreStr.length < 6) { scoreStr = "0" + scoreStr; }
        text += rank + ". " + name + "  " + scoreStr + "\n";
      }

      self.leaderboardLabel.string = text.trim();
    }).catch(function (e) {
      cc.warn("[LevelSelectManager] loadLeaderboard failed:", e);
      if (self.leaderboardLabel) {
        self.leaderboardLabel.string = "Failed to load scores.";
      }
    });
  }

  // ─── button handlers ─────────────────────────────────────────────────────────

  onLevel1Click() {
    cc.director.loadScene("Level1");
  }

  onLogoutClick() {
    Auth.logout().then(function () {
      cc.director.loadScene("StartScene");
    }).catch(function (e) {
      cc.warn("[LevelSelectManager] logout failed:", e);
      cc.director.loadScene("StartScene");
    });
  }
}
