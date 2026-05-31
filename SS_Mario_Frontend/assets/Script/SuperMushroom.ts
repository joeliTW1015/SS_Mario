import PlayerController from "./PlayerController";

const { ccclass, property } = cc._decorator;

@ccclass
export default class SuperMushroom extends cc.Component {

  // ─── inspector ───────────────────────────────────────────────────────────────

  @property
  moveSpeed: number = 60;

  @property(cc.AudioClip)
  sfxCollect: cc.AudioClip = null;

  // ─── state ───────────────────────────────────────────────────────────────────

  collected: boolean = false;
  private rb: cc.RigidBody = null;
  private directionX: number = 1;   // start moving right

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    this.rb = this.getComponent(cc.RigidBody);
    // Contact callbacks only fire on this node if its RigidBody is listening.
    if (this.rb) { this.rb.enabledContactListener = true; }
    // onBeginContact below is auto-called by physics manager.
  }

  start() {
    // Apply initial velocity after first physics tick so mushroom slides right
    if (this.rb) {
      this.rb.linearVelocity = cc.v2(this.directionX * this.moveSpeed, 0);
    }
  }

  update(dt: number) {
    if (this.collected) { return; }

    // Maintain horizontal velocity (gravity handles Y)
    if (this.rb) {
      const vy = this.rb.linearVelocity.y;
      this.rb.linearVelocity = cc.v2(this.directionX * this.moveSpeed, vy);
    }
  }

  // ─── physics contacts ────────────────────────────────────────────────────────

  onBeginContact(contact: cc.PhysicsContact, self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
    if (this.collected) { return; }

    const otherGroup = other.node.group;

    // Collected by player
    if (otherGroup === "PLAYER") {
      this.collect(other.node);
      return;
    }

    // Bounce off walls / edges
    if (otherGroup === "GROUND" || otherGroup === "WALL" ||
        otherGroup === "BRICK"  || otherGroup === "BLOCK") {
      const worldManifold = contact.getWorldManifold();
      const normal = worldManifold.normal;
      if (Math.abs(normal.x) > 0.5) {
        this.directionX = -this.directionX;
        if (this.rb) {
          const vy = this.rb.linearVelocity.y;
          this.rb.linearVelocity = cc.v2(this.directionX * this.moveSpeed, vy);
        }
      }
    }
  }

  // ─── collection ──────────────────────────────────────────────────────────────

  collect(playerNode: cc.Node) {
    if (this.collected) { return; }
    this.collected = true;

    // Grow player
    const playerCtrl = playerNode.getComponent(PlayerController);
    if (playerCtrl) { playerCtrl.growBig(); }

    // Sound
    if (this.sfxCollect) { cc.audioEngine.playEffect(this.sfxCollect, false); }

    // Remove from scene
    if (this.node && this.node.isValid) { this.node.destroy(); }
  }
}
