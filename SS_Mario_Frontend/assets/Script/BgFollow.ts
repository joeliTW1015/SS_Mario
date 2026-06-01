const { ccclass, property } = cc._decorator;

// Attaches to a background node and makes it follow the player with a
// parallax ratio. A ratio of 1.0 = move 1:1 with the player (no parallax);
// 0.5 = half-speed (classic distant background feel); 0 = static.

@ccclass
export default class BgFollow extends cc.Component {

  @property({ type: cc.Node, tooltip: "跟隨的目標（留空自動找 Player）" })
  target: cc.Node = null;

  @property({ tooltip: "X 軸視差比例 (0=不動, 0.5=半速, 1=同速)" })
  parallaxX: number = 0.5;

  @property({ tooltip: "Y 軸視差比例 (0=不動, 0.5=半速, 1=同速)" })
  parallaxY: number = 0;

  private startX: number = 0;
  private startY: number = 0;
  private targetStartX: number = 0;
  private targetStartY: number = 0;

  onLoad() {
    if (!this.target) {
      var p = cc.find("Player");
      if (!p) { p = cc.find("Level1/Player") || cc.find("Level2/Player"); }
      if (p) { this.target = p; }
    }
    if (!this.target) {
      cc.warn("[BgFollow] No target found.");
      return;
    }

    // Snap background to the camera's initial position so they're aligned.
    var cam = cc.find("Main Camera") || cc.find("Level1/Main Camera") || cc.find("Level2/Main Camera");
    if (cam) {
      this.node.x = cam.x;
      this.node.y = cam.y;
    }

    this.startX = this.node.x;
    this.startY = this.node.y;
    this.targetStartX = this.target.x;
    this.targetStartY = this.target.y;
  }

  lateUpdate() {
    if (!this.target || !this.target.isValid) { return; }

    var dx = this.target.x - this.targetStartX;
    var dy = this.target.y - this.targetStartY;

    this.node.x = this.startX + dx * this.parallaxX;
    this.node.y = this.startY + dy * this.parallaxY;
  }
}
