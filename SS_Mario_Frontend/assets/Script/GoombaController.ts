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

    // onBeginContact below is auto-called by physics manager, but ONLY if this
    // node's RigidBody has enabledContactListener = true. Force it on here.
    if (this.rb) {
      this.rb.enabledContactListener = true;
      cc.log("[Goomba] '" + this.node.name + "' RigidBody OK. type=" + this.rb.type +
             " (Dynamic must be " + cc.RigidBodyType.Dynamic + ")");
    } else {
      cc.warn("[Goomba] '" + this.node.name +
              "' has NO RigidBody — enemy cannot move. Add a Dynamic RigidBody + PhysicsBoxCollider.");
    }

    // Start walking
    if (this.anim) { this.anim.play("walk"); }
  }

  start() {
    // Apply initial velocity after first physics tick
    if (this.rb) {
      this.rb.linearVelocity = cc.v2(this.directionX * this.moveSpeed, 0);
      cc.log("[Goomba] '" + this.node.name + "' initial velocity set to vx=" +
             (this.directionX * this.moveSpeed));
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

    // Visible "squashed" state runs immediately — this is what the player sees.
    if (this.anim) {
      const deadState = this.anim.getAnimationState("dead");
      if (deadState) {
        this.anim.play("dead");
      } else {
        this.node.scaleY = 0.3;
      }
    }

    const self = this;

    // ⚠️ Box2D forbids changing RigidBody.type (or rebuilding fixtures) inside
    // a contact callback — and this method IS called from the player's
    // onBeginContact stomp path. Defer the body mutations one frame; otherwise
    // they throw silently and the goomba ends up in a half-dead zombie state.
    this.scheduleOnce(function () {
      if (self.rb && self.rb.isValid) {
        self.rb.linearVelocity = cc.v2(0, 0);
        self.rb.type = cc.RigidBodyType.Static;
      }
    }, 0);

    // Destroy after short delay (let the squashed sprite show for a moment).
    this.scheduleOnce(function () {
      if (self.node && self.node.isValid) { self.node.destroy(); }
    }, 0.4);
  }
}
