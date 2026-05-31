import GameManager from "./GameManager";

const { ccclass, property } = cc._decorator;

@ccclass
export default class DeathZone extends cc.Component {

  // Per-zone latch: once this zone has triggered a death, ignore further
  // contacts until the scene reloads (which destroys this component anyway).
  private triggered: boolean = false;

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    // New nodes default to the "default" group, but PLAYER × default is DISABLED
    // in the collision matrix — so a death zone left in "default" never fires.
    // Move it to a group that collides with PLAYER.
    if (this.node.group === "default") {
      this.node.group = "GROUND";
      cc.log("[DeathZone] group was 'default' (no PLAYER collision) — switched to 'GROUND'.");
    }

    // Contact callbacks only fire on THIS node if its own RigidBody has the
    // contact listener enabled. A bare sensor often has no RigidBody, so make
    // sure a Static one exists and is listening — otherwise falling never kills.
    let rb = this.getComponent(cc.RigidBody);
    if (!rb) {
      rb = this.addComponent(cc.RigidBody);
      rb.type = cc.RigidBodyType.Static;
      cc.log("[DeathZone] No RigidBody found — added a Static one at runtime.");
    }
    rb.enabledContactListener = true;

    // Ensure the collider on this node is a sensor (no physical response)
    const collider = this.getComponent(cc.PhysicsBoxCollider);
    if (collider) {
      collider.sensor = true;
      collider.apply();
    } else {
      cc.warn("[DeathZone] No PhysicsBoxCollider on this node — it cannot detect the player.");
    }
    // onBeginContact below is auto-called by physics manager.
  }

  // ─── physics contact ─────────────────────────────────────────────────────────

  onBeginContact(contact: cc.PhysicsContact, self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
    if (this.triggered) { return; }
    cc.log("[DeathZone] contact with group=" + other.node.group + " name=" + other.node.name);
    if (other.node.group === "PLAYER") {
      this.triggered = true;
      const gm = GameManager.getInstance();
      if (!gm) {
        cc.warn("[DeathZone] GameManager.getInstance() is null!");
        return;
      }
      cc.log("[DeathZone] triggering player death");
      gm.triggerPlayerDeath();
    }
  }
}
