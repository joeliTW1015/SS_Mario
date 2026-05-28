import GameManager from "./GameManager";

const { ccclass, property } = cc._decorator;

@ccclass
export default class DeathZone extends cc.Component {

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    // Ensure the collider on this node is a sensor (no physical response)
    const collider = this.getComponent(cc.PhysicsBoxCollider);
    if (collider) {
      collider.sensor = true;
      collider.apply();
    }
    // onBeginContact below is auto-called by physics manager.
  }

  // ─── physics contact ─────────────────────────────────────────────────────────

  onBeginContact(contact: cc.PhysicsContact, self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
    if (other.node.group === "PLAYER") {
      const gm = GameManager.getInstance();
      if (gm) { gm.triggerPlayerDeath(); }
    }
  }
}
