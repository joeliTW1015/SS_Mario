const { ccclass, property } = cc._decorator;

@ccclass
export default class CameraFollow extends cc.Component {

  // ─── inspector ───────────────────────────────────────────────────────────────

  @property(cc.Node)
  target: cc.Node = null;

  @property
  followSpeed: number = 5;

  @property
  minX: number = 0;

  @property
  maxX: number = 3000;

  // Set both to 0 to disable vertical following (camera stays fixed vertically)
  @property
  fixedY: boolean = true;

  @property
  minY: number = 0;

  @property
  maxY: number = 600;

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    if (!this.target) {
      // Try to auto-find the Player node in the scene
      const playerNode = cc.find("Player");
      if (playerNode) { this.target = playerNode; }
    }
  }

  // Use lateUpdate so camera moves AFTER physics step has updated player position
  lateUpdate(dt: number) {
    if (!this.target || !this.target.isValid) { return; }

    // Get target world position
    const targetWorldPos = this.target.convertToWorldSpaceAR(cc.v2(0, 0));

    // Convert to camera's parent local space
    const parent = this.node.parent;
    const targetLocal = parent
      ? parent.convertToNodeSpaceAR(targetWorldPos)
      : targetWorldPos;

    // Lerp X
    const currentX = this.node.x;
    const desiredX  = Math.max(this.minX, Math.min(this.maxX, targetLocal.x));
    this.node.x = currentX + (desiredX - currentX) * this.followSpeed * dt;

    // Optionally follow Y
    if (!this.fixedY) {
      const currentY = this.node.y;
      const desiredY  = Math.max(this.minY, Math.min(this.maxY, targetLocal.y));
      this.node.y = currentY + (desiredY - currentY) * this.followSpeed * dt;
    }
  }
}
