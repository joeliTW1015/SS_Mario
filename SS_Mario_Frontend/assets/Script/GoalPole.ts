import GameManager from "./GameManager";

const { ccclass, property } = cc._decorator;

@ccclass
export default class GoalPole extends cc.Component {

  @property(cc.AudioClip)
  sfxWin: cc.AudioClip = null;

  private triggered: boolean = false;

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    // The GoalPole sits in the "default" group in the scene, but PLAYER × default
    // is DISABLED in the collision matrix, so the player can never touch it and
    // the win never fires. Move it into a group that DOES collide with PLAYER.
    // "GROUND" works (PLAYER × GROUND = true) and, being a sensor, it won't block.
    if (this.node.group === "default") {
      this.node.group = "GROUND";
      cc.log("[GoalPole] group was 'default' (no PLAYER collision) — switched to 'GROUND'.");
    }

    // Contact callbacks only fire on THIS node if its own RigidBody has the
    // contact listener enabled. Guarantee a listening Static body exists.
    let rb = this.getComponent(cc.RigidBody);
    if (!rb) {
      rb = this.addComponent(cc.RigidBody);
      rb.type = cc.RigidBodyType.Static;
      cc.log("[GoalPole] No RigidBody found — added a Static one at runtime.");
    }
    rb.enabledContactListener = true;

    const collider = this.getComponent(cc.PhysicsBoxCollider);
    if (collider) {
      collider.sensor = true;
      collider.apply();   // rebuild the fixture so the new group's collision filter applies
    } else {
      cc.warn("[GoalPole] No PhysicsBoxCollider on this node — it cannot detect the player.");
    }
    // onBeginContact below is auto-called by physics manager.
  }

  // ─── physics contact ─────────────────────────────────────────────────────────

  onBeginContact(contact: cc.PhysicsContact, self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
    cc.log("[GoalPole] contact with group=" + other.node.group + " name=" + other.node.name);
    if (this.triggered) { return; }
    if (other.node.group !== "PLAYER") { return; }

    this.triggered = true;

    if (this.sfxWin) { cc.audioEngine.playEffect(this.sfxWin, false); }

    const gm = GameManager.getInstance();
    if (!gm) {
      cc.warn("[GoalPole] GameManager.getInstance() is null!");
      return;
    }
    cc.log("[GoalPole] triggering win");
    gm.showWin();
  }
}
