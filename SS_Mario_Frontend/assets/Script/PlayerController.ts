import GameManager from "./GameManager";

const { ccclass, property } = cc._decorator;

// Key codes
const KEY_LEFT  = cc.macro.KEY.left;
const KEY_RIGHT = cc.macro.KEY.right;
const KEY_UP    = cc.macro.KEY.up;
const KEY_A     = cc.macro.KEY.a;
const KEY_D     = cc.macro.KEY.d;
const KEY_W     = cc.macro.KEY.w;
const KEY_SPACE = cc.macro.KEY.space;

@ccclass
export default class PlayerController extends cc.Component {

  // ─── inspector ───────────────────────────────────────────────────────────────

  @property
  moveSpeed: number = 200;

  @property
  jumpForce: number = 600;

  // ─── BIG-state multipliers (apply while state === "BIG") ─────────────────────

  @property({ tooltip: "Visual + collider scale when BIG. 1.5 = 50% bigger Mario." })
  bigScale: number = 1.5;

  @property({ tooltip: "moveSpeed multiplier when BIG. 1.5 = 50% faster." })
  bigMoveBoost: number = 1.5;

  @property({ tooltip: "jumpForce multiplier when BIG. 1.35 = 35% higher jump." })
  bigJumpBoost: number = 1.35;

  @property(cc.Animation)
  anim: cc.Animation = null;

  @property(cc.PhysicsBoxCollider)
  bodyCollider: cc.PhysicsBoxCollider = null;

  @property(cc.AudioClip)
  sfxJump: cc.AudioClip = null;

  @property(cc.AudioClip)
  sfxStomp: cc.AudioClip = null;

  @property(cc.AudioClip)
  sfxGrow: cc.AudioClip = null;

  @property(cc.AudioClip)
  sfxHurt: cc.AudioClip = null;

  // ─── state ───────────────────────────────────────────────────────────────────

  state: string = "SMALL";   // "SMALL" | "BIG" | "DEAD"
  isGrounded: boolean = false;
  isInvincible: boolean = false;
  facingRight: boolean = true;

  private rb: cc.RigidBody = null;
  private keysHeld: { [key: number]: boolean } = {};
  private groundContactCount: number = 0;
  private isDead: boolean = false;

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    this.rb = this.getComponent(cc.RigidBody);

    // Guarantee contact callbacks fire on THIS node regardless of the editor checkbox.
    if (this.rb) {
      this.rb.enabledContactListener = true;
    } else {
      cc.warn("[Player] No RigidBody found! Movement, jumping and all contacts will be dead.");
    }

    if (!this.bodyCollider) {
      this.bodyCollider = this.getComponent(cc.PhysicsBoxCollider);
    }
    if (!this.anim) {
      this.anim = this.getComponent(cc.Animation);
    }

    // Cocos 2.4.x physics: onBeginContact/onEndContact on this component
    // will be called automatically by the physics manager when contacts
    // occur, AS LONG AS the RigidBody has `enabledContactListener = true`.
    // No manual subscription needed.

    cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP,   this.onKeyUp,   this);
  }

  onDestroy() {
    cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP,   this.onKeyUp,   this);
  }

  // Snapshot of the visual state other players need to mirror this player.
  getNetState(): { facingRight: boolean; anim: string; state: string } {
    return {
      facingRight: this.facingRight,
      anim: this.currentAnim || "idle",
      state: this.state,
    };
  }

  update(dt: number) {
    if (this.isDead) { return; }

    const isBig      = this.state === "BIG";
    const moveBoost  = isBig ? this.bigMoveBoost : 1;
    const sizeScale  = isBig ? this.bigScale     : 1;
    const speed      = this.moveSpeed * moveBoost;

    const movingLeft  = this.keysHeld[KEY_LEFT]  || this.keysHeld[KEY_A];
    const movingRight = this.keysHeld[KEY_RIGHT]  || this.keysHeld[KEY_D];

    let vx = 0;
    if (movingLeft)  { vx = -speed; this.facingRight = false; }
    if (movingRight) { vx =  speed; this.facingRight = true;  }

    // Preserve vertical velocity (gravity / jump)
    const vy = this.rb ? this.rb.linearVelocity.y : 0;
    if (this.rb) {
      this.rb.linearVelocity = cc.v2(vx, vy);
    }

    // scaleX carries BOTH the facing flip (±1) and the BIG-state size scale.
    // scaleY is just the size scale.
    this.node.scaleX = (this.facingRight ? 1 : -1) * sizeScale;
    this.node.scaleY = sizeScale;

    // Animation selection
    this.updateAnimation(vx, vy);
  }

  // ─── keyboard ────────────────────────────────────────────────────────────────

  private onKeyDown(event: cc.Event.EventKeyboard) {
    this.keysHeld[event.keyCode] = true;

    const isJumpKey = event.keyCode === KEY_UP    ||
                      event.keyCode === KEY_W      ||
                      event.keyCode === KEY_SPACE;
    if (isJumpKey) { this.tryJump(); }
  }

  private onKeyUp(event: cc.Event.EventKeyboard) {
    this.keysHeld[event.keyCode] = false;
  }

  private tryJump() {
    if (this.isDead) { return; }
    if (!this.isGrounded) {
      cc.log("[Player] Jump blocked: not grounded");
      return;
    }
    if (!this.rb) { return; }

    const vx        = this.rb.linearVelocity.x;
    const jumpBoost = this.state === "BIG" ? this.bigJumpBoost : 1;
    this.rb.linearVelocity = cc.v2(vx, this.jumpForce * jumpBoost);
    this.isGrounded = false;
    this.groundContactCount = 0;

    if (this.sfxJump) { cc.audioEngine.playEffect(this.sfxJump, false); }
  }

  // ─── physics contacts ────────────────────────────────────────────────────────

  onBeginContact(contact: cc.PhysicsContact, self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
    if (this.isDead) { return; }

    const otherGroup = other.node.group;

    // Ground detection — compare world Y positions (more robust than contact normal)
    if (otherGroup === "GROUND" || otherGroup === "BRICK" || otherGroup === "BLOCK") {
      const playerY = self.node.convertToWorldSpaceAR(cc.v2(0, 0)).y;
      const otherY  = other.node.convertToWorldSpaceAR(cc.v2(0, 0)).y;

      // Use contact manifold to filter out pure side contacts (walls)
      const worldManifold = contact.getWorldManifold();
      const normal = worldManifold.normal;
      const isVerticalContact = Math.abs(normal.y) > 0.5;

      if (isVerticalContact && playerY > otherY) {
        // Player landed on top of this surface
        this.groundContactCount++;
        this.isGrounded = true;
      } else if (otherGroup === "BLOCK" && isVerticalContact && playerY < otherY) {
        // Player hit a block from below
        const blockComp = other.node.getComponent("QuestionBlock");
        if (blockComp) { blockComp["triggerBlock"](); }
      }
    }

    // Enemy contact
    if (otherGroup === "ENEMY") {
      // Already-stomped goomba: skip. Box2D fires a SECOND begin-contact one
      // frame after the stomp, because GoombaController.onStomped switches
      // the body Dynamic → Static (we defer it one frame to avoid the
      // contact-callback crash). The body-type change rebuilds the fixture,
      // which ends the old contact and immediately starts a new one while
      // the player is still mid-bounce (vy now positive). Without this guard
      // that spurious second event reads as "moving-up side hit" → damage.
      const stompedCtrl = other.node.getComponent("GoombaController");
      if (stompedCtrl && stompedCtrl["alive"] === false) { return; }

      const selfWorldY  = this.node.convertToWorldSpaceAR(cc.v2(0, 0)).y;
      const otherWorldY = other.node.convertToWorldSpaceAR(cc.v2(0, 0)).y;

      // Use the Box2D contact NORMAL to tell stomp from side-hit. Reasoning:
      //   • landing on the goomba's head → contact surface is its top → the
      //     world manifold normal is mostly vertical (|ny| dominates),
      //   • walking into the goomba's side → contact surface is its side →
      //     normal is mostly horizontal.
      // This is much more robust than the feet-vs-centre position check we
      // had before, which mis-classified fast falls (Box2D fires the begin
      // event a few pixels after overlap starts, so by then the player has
      // already penetrated the goomba and the "feet" math says side-hit).
      const worldManifold     = contact.getWorldManifold();
      const normal            = worldManifold.normal;
      const isVerticalContact = Math.abs(normal.y) > 0.5;
      const playerAbove       = selfWorldY > otherWorldY;
      const movingUpFast      = this.rb && this.rb.linearVelocity.y > 50;

      cc.log("[Player] ENEMY contact: normal=(" + normal.x.toFixed(2) + "," +
             normal.y.toFixed(2) + ") playerY=" + selfWorldY.toFixed(1) +
             " enemyY=" + otherWorldY.toFixed(1) +
             " vy=" + (this.rb ? this.rb.linearVelocity.y.toFixed(1) : "?"));

      if (isVerticalContact && playerAbove && !movingUpFast) {
        this.onStompEnemy(other.node);
      } else {
        this.takeDamage();
      }
    }

    // Item contact
    if (otherGroup === "ITEM") {
      const mushroomComp = other.node.getComponent("SuperMushroom");
      if (mushroomComp) { mushroomComp["collect"](this.node); }
    }
  }

  onEndContact(contact: cc.PhysicsContact, self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
    const otherGroup = other.node.group;
    if (otherGroup === "GROUND" || otherGroup === "BRICK" || otherGroup === "BLOCK") {
      const playerY = self.node.convertToWorldSpaceAR(cc.v2(0, 0)).y;
      const otherY  = other.node.convertToWorldSpaceAR(cc.v2(0, 0)).y;
      if (playerY > otherY) {
        this.groundContactCount--;
        if (this.groundContactCount <= 0) {
          this.groundContactCount = 0;
          this.isGrounded = false;
        }
      }
    }
  }

  // ─── enemy stomp ─────────────────────────────────────────────────────────────

  private onStompEnemy(enemyNode: cc.Node) {
    // Bounce the player upward (BIG state also boosts this bounce)
    if (this.rb) {
      const vx        = this.rb.linearVelocity.x;
      const jumpBoost = this.state === "BIG" ? this.bigJumpBoost : 1;
      this.rb.linearVelocity = cc.v2(vx, this.jumpForce * 0.6 * jumpBoost);
    }

    const enemyCtrl = enemyNode.getComponent("GoombaController");
    if (enemyCtrl) {
      enemyCtrl["onStomped"]();
    } else {
      cc.warn("[Player] Stomped node '" + enemyNode.name +
              "' has no GoombaController component — check the script is attached.");
    }

    if (this.sfxStomp) { cc.audioEngine.playEffect(this.sfxStomp, false); }
  }

  // ─── damage / growth ─────────────────────────────────────────────────────────

  takeDamage() {
    if (this.isDead || this.isInvincible) { return; }

    if (this.state === "BIG") {
      this.shrink();
    } else {
      this.die();
    }
  }

  die() {
    if (this.isDead) { return; }
    this.isDead = true;
    this.state  = "DEAD";
    this.keysHeld = {};

    // Stop horizontal motion immediately (velocity change is safe in contact callback,
    // but type change is NOT — must be deferred to next frame).
    if (this.rb) {
      this.rb.linearVelocity = cc.v2(0, 0);
    }

    if (this.sfxHurt) { cc.audioEngine.playEffect(this.sfxHurt, false); }
    if (this.anim)    { this.playAnim("die"); }

    // Defer RigidBody.type change so Box2D isn't mid-contact-resolution
    const self = this;
    this.scheduleOnce(function () {
      if (self.rb && self.rb.isValid) {
        self.rb.type = cc.RigidBodyType.Static;
      }
    }, 0);

    this.scheduleOnce(function () {
      const gm = GameManager.getInstance();
      if (gm) { gm.triggerPlayerDeath(); }
    }, 0.8);
  }

  growBig() {
    if (this.isDead) { return; }
    if (this.state === "BIG") { return; }   // already big — eat extra mushroom = no-op
    this.state = "BIG";

    // Visual size is driven by node.scale in update(), so we no longer have to
    // mutate the collider here. Two things still need to happen:
    //   (a) bump Y up so the suddenly taller sprite's feet don't sink into the
    //       floor (~ half of the height increase);
    //   (b) rebuild the collider fixture once so Box2D picks up the new scale.
    // Both are deferred a frame so Box2D isn't mid-contact-resolution.
    const self = this;
    this.scheduleOnce(function () {
      if (!self.node || !self.node.isValid) { return; }
      const lift = 16 * (self.bigScale - 1);   // 16 = roughly half SMALL height
      self.node.y += lift;
      if (self.bodyCollider && self.bodyCollider.isValid) {
        self.bodyCollider.apply();
      }
    }, 0);

    if (this.sfxGrow) { cc.audioEngine.playEffect(this.sfxGrow, false); }
    if (this.anim)    { this.playAnim("grow"); }

    this.scheduleOnce(function () {
      if (self.state === "BIG") { self.playAnim("idle"); }
    }, 0.5);
  }

  private shrink() {
    this.state = "SMALL";

    // node.scale picks up the change in update() automatically; we just need to
    // rebuild the collider fixture so Box2D sees the new scale. Deferred a
    // frame so we're not mutating Box2D mid-contact.
    const self = this;
    this.scheduleOnce(function () {
      if (self.bodyCollider && self.bodyCollider.isValid) {
        self.bodyCollider.apply();
      }
    }, 0);

    if (this.sfxHurt) { cc.audioEngine.playEffect(this.sfxHurt, false); }

    // Start invincibility window
    this.isInvincible = true;
    this.startInvincibilityFlash();

    this.scheduleOnce(function () {
      self.isInvincible = false;
      self.node.opacity = 255;
    }, 2);
  }

  private startInvincibilityFlash() {
    let visible = true;
    const self = this;
    const interval = 0.1;
    let elapsed = 0;

    const flashFunc = function () {
      if (!self.isInvincible) {
        self.node.opacity = 255;
        return;
      }
      visible = !visible;
      self.node.opacity = visible ? 255 : 60;
      elapsed += interval;
      if (elapsed < 2) {
        self.scheduleOnce(flashFunc, interval);
      }
    };
    this.scheduleOnce(flashFunc, interval);
  }

  // ─── animation ───────────────────────────────────────────────────────────────

  private updateAnimation(vx: number, vy: number) {
    if (!this.anim) { return; }
    if (this.isDead) { return; }

    if (!this.isGrounded) {
      this.playAnim("jump");
    } else if (Math.abs(vx) > 1) {
      this.playAnim("run");
    } else {
      this.playAnim("idle");
    }
  }

  private currentAnim: string = "";

  private playAnim(name: string) {
    if (!this.anim) { return; }
    if (this.currentAnim === name) { return; }
    const state = this.anim.getAnimationState(name);
    if (!state) { return; }
    this.currentAnim = name;
    this.anim.play(name);
  }
}
