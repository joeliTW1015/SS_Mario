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

  update(dt: number) {
    if (this.isDead) { return; }

    const movingLeft  = this.keysHeld[KEY_LEFT]  || this.keysHeld[KEY_A];
    const movingRight = this.keysHeld[KEY_RIGHT]  || this.keysHeld[KEY_D];

    let vx = 0;
    if (movingLeft)  { vx = -this.moveSpeed; this.facingRight = false; }
    if (movingRight) { vx =  this.moveSpeed; this.facingRight = true;  }

    // Preserve vertical velocity (gravity / jump)
    const vy = this.rb ? this.rb.linearVelocity.y : 0;
    if (this.rb) {
      this.rb.linearVelocity = cc.v2(vx, vy);
    }

    // Flip sprite
    this.node.scaleX = this.facingRight ? 1 : -1;

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
    if (!this.isGrounded) { return; }
    if (!this.rb) { return; }

    const vx = this.rb.linearVelocity.x;
    this.rb.linearVelocity = cc.v2(vx, this.jumpForce);
    this.isGrounded = false;
    this.groundContactCount = 0;

    if (this.sfxJump) { cc.audioEngine.playEffect(this.sfxJump, false); }
  }

  // ─── physics contacts ────────────────────────────────────────────────────────

  onBeginContact(contact: cc.PhysicsContact, self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
    if (this.isDead) { return; }

    const otherGroup = other.node.group;

    // Ground detection — check contact normal to ensure surface below
    if (otherGroup === "GROUND" || otherGroup === "BRICK" || otherGroup === "BLOCK") {
      const worldManifold = contact.getWorldManifold();
      const normal = worldManifold.normal;
      // Normal pointing upward relative to player means surface is below
      if (normal.y > 0.5) {
        this.groundContactCount++;
        this.isGrounded = true;
      }

      // Block hit from below: normal pointing DOWN from block means player below pushed up
      if (otherGroup === "BLOCK" && normal.y < -0.5) {
        const blockComp = other.node.getComponent("QuestionBlock");
        if (blockComp) { blockComp["triggerBlock"](); }
      }
    }

    // Enemy contact
    if (otherGroup === "ENEMY") {
      const selfWorldY  = this.node.convertToWorldSpaceAR(cc.v2(0, 0)).y;
      const otherWorldY = other.node.convertToWorldSpaceAR(cc.v2(0, 0)).y;

      if (selfWorldY > otherWorldY + 8) {
        // Stomp — player center is clearly above enemy center
        this.onStompEnemy(other.node);
      } else {
        this.takeDamage();
      }
    }

    // Item contact
    if (otherGroup === "ITEM") {
      const mushroomComp = other.node.getComponent("SuperMushroom");
      if (mushroomComp) { mushroomComp["collect"](); }
    }
  }

  onEndContact(contact: cc.PhysicsContact, self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
    const otherGroup = other.node.group;
    if (otherGroup === "GROUND" || otherGroup === "BRICK" || otherGroup === "BLOCK") {
      const worldManifold = contact.getWorldManifold();
      const normal = worldManifold.normal;
      if (normal.y > 0.5) {
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
    // Bounce the player upward
    if (this.rb) {
      const vx = this.rb.linearVelocity.x;
      this.rb.linearVelocity = cc.v2(vx, this.jumpForce * 0.6);
    }

    const enemyCtrl = enemyNode.getComponent("GoombaController");
    if (enemyCtrl) { enemyCtrl["onStomped"](); }

    const gm = GameManager.getInstance();
    if (gm) { gm.addScore(100); }

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

    if (this.rb) {
      this.rb.linearVelocity = cc.v2(0, 0);
      this.rb.type = cc.RigidBodyType.Static;
    }

    if (this.sfxHurt) { cc.audioEngine.playEffect(this.sfxHurt, false); }
    if (this.anim)    { this.playAnim("die"); }

    const gm = GameManager.getInstance();
    const self = this;
    this.scheduleOnce(function () {
      if (gm) { gm.triggerPlayerDeath(); }
    }, 0.8);
  }

  growBig() {
    if (this.isDead) { return; }
    this.state = "BIG";

    if (this.bodyCollider) {
      this.bodyCollider.size = cc.size(28, 48);
      this.bodyCollider.offset = cc.v2(0, 8);
      this.bodyCollider.apply();
    }

    if (this.sfxGrow) { cc.audioEngine.playEffect(this.sfxGrow, false); }
    if (this.anim)    { this.playAnim("grow"); }

    const self = this;
    this.scheduleOnce(function () {
      if (self.state === "BIG") { self.playAnim("idle"); }
    }, 0.5);
  }

  private shrink() {
    this.state = "SMALL";

    if (this.bodyCollider) {
      this.bodyCollider.size = cc.size(28, 32);
      this.bodyCollider.offset = cc.v2(0, 0);
      this.bodyCollider.apply();
    }

    if (this.sfxHurt) { cc.audioEngine.playEffect(this.sfxHurt, false); }

    // Start invincibility window
    this.isInvincible = true;
    this.startInvincibilityFlash();

    const self = this;
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
