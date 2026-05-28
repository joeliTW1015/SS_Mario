import GameManager from "./GameManager";

const { ccclass, property } = cc._decorator;

@ccclass
export default class GoalPole extends cc.Component {

  @property(cc.AudioClip)
  sfxWin: cc.AudioClip = null;

  private triggered: boolean = false;

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    const collider = this.getComponent(cc.PhysicsBoxCollider);
    if (collider) {
      collider.sensor = true;
      collider.apply();
    }
    // onBeginContact below is auto-called by physics manager.
  }

  // ─── physics contact ─────────────────────────────────────────────────────────

  onBeginContact(contact: cc.PhysicsContact, self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
    if (this.triggered) { return; }
    if (other.node.group !== "PLAYER") { return; }

    this.triggered = true;

    if (this.sfxWin) { cc.audioEngine.playEffect(this.sfxWin, false); }

    const gm = GameManager.getInstance();
    if (gm) { gm.showWin(); }
  }
}
