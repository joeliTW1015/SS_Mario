const Auth        = require("Auth");
const Leaderboard = require("Leaderboard");
const FocusManagerMod = require("FocusManager");
const FocusManager = FocusManagerMod.default || FocusManagerMod;

const { ccclass, property } = cc._decorator;

// ─── helpers ─────────────────────────────────────────────────────────────────

// Seconds → "MM:SS"
function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return (mm < 10 ? "0" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss;
}

// Unix‐ms timestamp → "YYYY-MM-DD"
function formatDate(ts: number): string {
  if (!ts) { return ""; }
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return y + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
}

// ─── component ───────────────────────────────────────────────────────────────

@ccclass
export default class LevelSelectManager extends cc.Component {

  // ─── node references (auto-found) ──────────────────────────────────────────

  private level1Button: cc.Button  = null;
  private level2Button: cc.Button  = null;
  private logoutButton: cc.Button  = null;
  private recordText1:  cc.Label   = null;
  private recordText2:  cc.Label   = null;
  private lb1ItemLabel: cc.Label   = null;
  private lb1Content:   cc.Node    = null;
  private lb2ItemLabel: cc.Label   = null;
  private lb2Content:   cc.Node    = null;

  // Cached leaderboard data for personal record lookup
  private allEntries: any[] = [];

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    this.autoFindNodes();
    this.wireButtons();
    this.loadLeaderboards();

    // Accessibility: keyboard nav + Esc settings overlay on the level menu.
    FocusManager.ensure();
  }

  // ─── node discovery ──────────────────────────────────────────────────────────

  private autoFindNodes() {
    const c = this.node;  // Canvas

    // Level 1 nodes
    const l1Btn = cc.find("Level1/Level1Button", c);
    if (l1Btn) { this.level1Button = l1Btn.getComponent(cc.Button); }

    const r1 = cc.find("Level1/RecordText1", c);
    if (r1) { this.recordText1 = r1.getComponent(cc.Label); }

    const lb1Content = cc.find("Level1/LeaderBoard1/view/content", c);
    if (lb1Content) { this.lb1Content = lb1Content; }

    const lb1Item = cc.find("Level1/LeaderBoard1/view/content/item", c);
    if (lb1Item) { this.lb1ItemLabel = lb1Item.getComponent(cc.Label); }

    // Level 2 nodes
    const l2Btn = cc.find("Level2/Level2Button", c);
    if (l2Btn) { this.level2Button = l2Btn.getComponent(cc.Button); }

    const r2 = cc.find("Level2/RecordText2", c);
    if (r2) { this.recordText2 = r2.getComponent(cc.Label); }

    const lb2Content = cc.find("Level2/LeaderBoard2/view/content", c);
    if (lb2Content) { this.lb2Content = lb2Content; }

    const lb2Item = cc.find("Level2/LeaderBoard2/view/content/item", c);
    if (lb2Item) { this.lb2ItemLabel = lb2Item.getComponent(cc.Label); }

    // Logout button — added so the full login → logout cycle can be done
    // from the keyboard. FocusManager will auto-include it in tab order.
    const lo = cc.find("LogoutButton", c);
    if (lo) { this.logoutButton = lo.getComponent(cc.Button); }

    // Warnings
    if (!this.level1Button)  { cc.warn("[LevelSelect] Level1Button not found"); }
    if (!this.level2Button)  { cc.warn("[LevelSelect] Level2Button not found"); }
    if (!this.logoutButton)  { cc.warn("[LevelSelect] LogoutButton not found (add a Button named 'LogoutButton' under Canvas)"); }
    if (!this.recordText1)   { cc.warn("[LevelSelect] RecordText1 not found"); }
    if (!this.recordText2)   { cc.warn("[LevelSelect] RecordText2 not found"); }
    if (!this.lb1ItemLabel)  { cc.warn("[LevelSelect] LeaderBoard1 item label not found"); }
    if (!this.lb2ItemLabel)  { cc.warn("[LevelSelect] LeaderBoard2 item label not found"); }
  }

  // ─── buttons ─────────────────────────────────────────────────────────────────

  private wireButtons() {
    if (this.level1Button) {
      this.level1Button.node.on("click", this.onLevel1Click, this);
    }
    if (this.level2Button) {
      this.level2Button.node.on("click", this.onLevel2Click, this);
    }
    if (this.logoutButton) {
      this.logoutButton.node.on("click", this.onLogoutClick, this);
    }
  }

  onLevel1Click() {
    cc.director.loadScene("Level1");
  }

  onLevel2Click() {
    cc.director.loadScene("Level2");
  }

  onLogoutClick() {
    // Sign out, then return to StartScene. The FocusManager singleton
    // persists across the scene change and will rescan StartScene
    // automatically on EVENT_AFTER_SCENE_LAUNCH.
    Auth.logout().then(function () {
      cc.director.loadScene("StartScene");
    }).catch(function (e: any) {
      cc.warn("[LevelSelect] logout failed:", e);
      // Best-effort: still send the user back to the login screen.
      cc.director.loadScene("StartScene");
    });
  }

  // ─── leaderboard loading ─────────────────────────────────────────────────────

  private loadLeaderboards() {
    // Show loading state
    if (this.lb1ItemLabel) { this.lb1ItemLabel.string = "Loading..."; }
    if (this.lb2ItemLabel) { this.lb2ItemLabel.string = "Loading..."; }
    if (this.recordText1)  { this.recordText1.string = "Time: --:--"; }
    if (this.recordText2)  { this.recordText2.string = "Time: --:--"; }

    const self = this;

    Leaderboard.getLeaderboard().then(function (data: any[]) {
      if (!data) { data = []; }
      self.allEntries = data;

      // Filter entries per level
      var level1Entries: any[] = [];
      var level2Entries: any[] = [];
      for (var i = 0; i < data.length; i++) {
        var entry = data[i];
        if (entry.level === 1) { level1Entries.push(entry); }
        if (entry.level === 2) { level2Entries.push(entry); }
      }

      // Sort ascending by score (lower time = better = rank #1)
      level1Entries.sort(function (a: any, b: any) { return a.score - b.score; });
      level2Entries.sort(function (a: any, b: any) { return a.score - b.score; });

      // Populate ScrollView labels
      self.populateLeaderboard(self.lb1ItemLabel, self.lb1Content, level1Entries);
      self.populateLeaderboard(self.lb2ItemLabel, self.lb2Content, level2Entries);

      // Load personal records
      self.loadPersonalRecords(level1Entries, level2Entries);

    }).catch(function (e: any) {
      cc.warn("[LevelSelect] loadLeaderboards failed:", e);
      if (self.lb1ItemLabel) { self.lb1ItemLabel.string = "Failed to load"; }
      if (self.lb2ItemLabel) { self.lb2ItemLabel.string = "Failed to load"; }
    });
  }

  private populateLeaderboard(itemLabel: cc.Label, contentNode: cc.Node, entries: any[]) {
    if (!itemLabel) { return; }

    if (entries.length === 0) {
      itemLabel.string = "No records yet";
      return;
    }

    var lines: string[] = [];
    var count = Math.min(entries.length, 20);  // cap at 20 entries
    for (var i = 0; i < count; i++) {
      var e = entries[i];
      var rank  = String(i + 1);
      var name  = String(e.username || "???").slice(0, 10);
      var time  = formatTime(e.score);
      var score = String(e.coins != null ? e.coins : 0);
      var date  = formatDate(e.timestamp);

      // Pad rank
      if (rank.length < 2) { rank = " " + rank; }
      // Pad name to 10 chars
      while (name.length < 10) { name = name + " "; }
      // Pad score to 6 chars (right-aligned)
      while (score.length < 6) { score = " " + score; }

      lines.push("#" + rank + "  " + name + "  " + time + "  " + score + "  " + date);
    }

    itemLabel.string = lines.join("\n");

    // Resize content node height to fit text
    if (contentNode) {
      var lineHeight = itemLabel.lineHeight || 20;
      var totalHeight = Math.max(count * lineHeight + 20, 250);
      contentNode.setContentSize(contentNode.width, totalHeight);
    }
  }

  // ─── personal records ────────────────────────────────────────────────────────

  private loadPersonalRecords(level1Entries: any[], level2Entries: any[]) {
    var self = this;

    Auth.currentUser().then(function (user: any) {
      if (!user) { return; }
      var username = user.username || user.email || "";

      // Find best (lowest score) entry matching this user for each level
      var best1 = self.findBestEntry(level1Entries, username);
      var best2 = self.findBestEntry(level2Entries, username);
      var bestScore1 = self.findBestScore(level1Entries, username);
      var bestScore2 = self.findBestScore(level2Entries, username);

      if (self.recordText1) {
        self.recordText1.string =
          (best1 !== null ? "Time: " + formatTime(best1) : "Time: --:--") +
          "\nScore: " + bestScore1;
      }
      if (self.recordText2) {
        self.recordText2.string =
          (best2 !== null ? "Time: " + formatTime(best2) : "Time: --:--") +
          "\nScore: " + bestScore2;
      }
    }).catch(function (e: any) {
      cc.warn("[LevelSelect] loadPersonalRecords failed:", e);
    });
  }

  // Returns the best (lowest) time for the given username, or null.
  private findBestEntry(entries: any[], username: string): number {
    var best: number = null;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var eName = String(e.username || "");
      if (eName === username) {
        if (best === null || e.score < best) {
          best = e.score;
        }
      }
    }
    return best;
  }

  // Returns the highest coin score for the given username (0 if none).
  private findBestScore(entries: any[], username: string): number {
    var best: number = 0;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var eName = String(e.username || "");
      if (eName === username) {
        var c = (e.coins != null ? e.coins : 0);
        if (c > best) { best = c; }
      }
    }
    return best;
  }
}
