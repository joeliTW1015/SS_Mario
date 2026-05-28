const { ccclass, property } = cc._decorator;

@ccclass
export default class GoombaController extends cc.Component {

  // ─── inspector ───────────────────────────────────────────────────────────────

  @property
  moveSpeed: number = 80;

  @property(cc.Animation)
  anim: cc.Animation = null;

  // ─── state ───────────────────────────────────────────────────────────────────

  alive: boolean = true;
  private rb: cc.RigidBody = null;
  private directionX: number = -1;   // start moving left

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    this.rb = this.getComponent(cc.RigidBody);
    if (!this.anim) { this.anim = this.getComponent(cc.Animation); }

    // onBeginContact below is auto-called by physics manager
    // (RigidBody must have enabledContactListener = true).

    // Start walking
    if (this.anim) { this.anim.play("walk"); }
  }

  start() {
    // Apply initial velocity after first physics tick
    if (this.rb) {
      this.rb.linearVelocity = cc.v2(this.directionX * this.moveSpeed, 0);
    }
  }

  update(dt: number) {
    if (!this.alive) { return; }

    // Sync sprite direction
    this.node.scaleX = this.directionX > 0 ? 1 : -1;

    // Maintain horizontal speed (gravity may change vy)
    if (this.rb) {
      const vy = this.rb.linearVelocity.y;
      this.rb.linearVelocity = cc.v2(this.directionX * this.moveSpeed, vy);
    }
  }

  // ─── physics contacts ────────────────────────────────────────────────────────

  onBeginContact(contact: cc.PhysicsContact, self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
    if (!this.alive) { return; }

    const otherGroup = other.node.group;

    // Reverse on walls, edges, or other enemies
    if (otherGroup === "GROUND" || otherGroup === "WALL" ||
        otherGroup === "BRICK"  || otherGroup === "BLOCK" ||
        otherGroup === "ENEMY") {

      const worldManifold = contact.getWorldManifold();
      const normal = worldManifold.normal;

      // Horizontal contact → wall/edge detected
      if (Math.abs(normal.x) > 0.5) {
        this.directionX = -this.directionX;
        if (this.rb) {
          const vy = this.rb.linearVelocity.y;
          this.rb.linearVelocity = cc.v2(this.directionX * this.moveSpeed, vy);
        }
      }
    }
  }

  // ─── stomped by player ───────────────────────────────────────────────────────

  onStomped() {
    if (!this.alive) { return; }
    this.alive = false;

    if (this.rb) {
      this.rb.linearVelocity = cc.v2(0, 0);
      this.rb.type = cc.RigidBodyType.Static;
    }

    if (this.anim) {
      // Try to play "dead" clip; if unavailable, just hide
      const deadState = this.anim.getAnimationState("dead");
      if (deadState) {
        this.anim.play("dead");
      } else {
        this.node.scaleY = 0.3;
      }
    }

    // Destroy after short delay
    const self = this;
    this.scheduleOnce(function () {
      if (self.node && self.node.isValid) { self.node.destroy(); }
    }, 0.4);
  }
}
