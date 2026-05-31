// Renders ONE semi-transparent "ghost" of another player in the same room,
// driven by Firebase Realtime Database. Tier-0 multiplayer — no interaction,
// no collisions, no enemy sync. Just "where is the other player right now".
//
// Hard-capped to 1 remote ghost: the first non-self uid we see in the room
// becomes the ghost; any 3rd+ player joining is ignored.
//
// Editor setup:
//   1. Add an empty node to Level1 (e.g. "GhostManager"), attach this component.
//   2. Drag the Player node into `localPlayer`.
//   3. (Optional) drag a sprite frame into `ghostSprite` to override the look;
//      otherwise the ghost copies the local player's current sprite frame.
//   4. Make sure both clients use the same `roomId`.

const Auth     = require("Auth");
const Firebase = require("Firebase");

const { ccclass, property } = cc._decorator;

// Rate at which we push our own position to Firebase. 10 Hz is plenty for
// a "where are you" ghost and keeps RTDB usage well under quota.
const TICK_HZ        = 10;
const ROOM_PATH_BASE = "rooms";

@ccclass
export default class GhostPlayer extends cc.Component {

  // ─── inspector ───────────────────────────────────────────────────────────────

  @property({ type: cc.Node, tooltip: "The local Player node to mirror." })
  localPlayer: cc.Node = null;

  @property({ tooltip: "Both clients must use the same room id to see each other." })
  roomId: string = "room1";

  @property({
    type: cc.SpriteFrame,
    tooltip: "Optional. If unset, the ghost copies the local player's sprite frame."
  })
  ghostSprite: cc.SpriteFrame = null;

  @property({
    tooltip: "Opacity 0–255. ~80 looks like a clear translucent ghost."
  })
  ghostOpacity: number = 80;

  // ─── private state ───────────────────────────────────────────────────────────

  private myUid: string   = null;
  private myRef: any      = null;   // firebase ref to MY slot
  private roomRef: any    = null;   // firebase ref to the room's players collection
  private ghostNode: cc.Node = null;
  private ghostUid: string   = null;

  // Lerp targets (set on every incoming snapshot; update() interpolates toward).
  private ghostTargetX: number      = 0;
  private ghostTargetY: number      = 0;
  private ghostFacingRight: boolean = true;
  private ghostIsBig: boolean       = false;

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    const self = this;

    if (!this.localPlayer) {
      // Convenience: try a couple of common scene paths.
      const fallback = cc.find("Level1/Player") || cc.find("Player");
      if (fallback) { this.localPlayer = fallback; }
    }
    if (!this.localPlayer) {
      cc.warn("[GhostPlayer] localPlayer not assigned — component disabled.");
      return;
    }

    Auth.currentUser().then(function (user: any) {
      if (!user) {
        cc.warn("[GhostPlayer] no logged-in user — ghost sync disabled.");
        return null;
      }
      self.myUid = user.uid;
      return Firebase.init();
    }).then(function (firebase: any) {
      if (firebase && self.myUid) { self.wireFirebase(firebase); }
    }).catch(function (e: any) {
      cc.warn("[GhostPlayer] init failed:", e);
    });
  }

  onDestroy() {
    // Pull our entry out of the room so the other client's ghost disappears.
    if (this.myRef) {
      try { this.myRef.remove(); } catch (e) { /* offline / detached */ }
      try { this.myRef.onDisconnect().cancel(); } catch (e) { /* idem */ }
    }
    if (this.roomRef) {
      try { this.roomRef.off(); } catch (e) { /* idem */ }
    }
    if (this.ghostNode && this.ghostNode.isValid) {
      this.ghostNode.destroy();
    }
  }

  update(dt: number) {
    if (!this.ghostNode || !this.ghostNode.isValid) { return; }

    // Smooth lerp toward the last-received target. 12 is "snappy but smooth";
    // bump higher (e.g. 20) for tighter tracking, lower for more drift.
    const t = Math.min(1, dt * 12);
    this.ghostNode.x += (this.ghostTargetX - this.ghostNode.x) * t;
    this.ghostNode.y += (this.ghostTargetY - this.ghostNode.y) * t;

    // Facing flip + BIG-state size scale — snap, no lerp (looks right).
    const sizeScale = this.ghostIsBig ? 1.5 : 1;
    this.ghostNode.scaleX = (this.ghostFacingRight ? 1 : -1) * sizeScale;
    this.ghostNode.scaleY = sizeScale;
  }

  // ─── firebase wiring ─────────────────────────────────────────────────────────

  private wireFirebase(firebase: any) {
    const self        = this;
    const playersPath = ROOM_PATH_BASE + "/" + this.roomId + "/players";

    this.roomRef = firebase.database().ref(playersPath);
    this.myRef   = this.roomRef.child(this.myUid);

    // Auto-clean my slot if the tab closes / network drops.
    this.myRef.onDisconnect().remove();

    // First push so we're visible to the other client immediately.
    this.pushState();

    // Periodic pushes.
    this.schedule(this.pushState, 1 / TICK_HZ);

    // Listen for others. child_added also fires once per pre-existing entry.
    this.roomRef.on("child_added",   function (snap: any) { self.onRemote(snap); });
    this.roomRef.on("child_changed", function (snap: any) { self.onRemote(snap); });
    this.roomRef.on("child_removed", function (snap: any) { self.onRemoteLeft(snap); });

    cc.log("[GhostPlayer] joined room '" + this.roomId + "' as uid=" + this.myUid);
  }

  private pushState() {
    if (!this.myRef || !this.localPlayer || !this.localPlayer.isValid) { return; }

    // Read state straight off the local player — no refactoring needed.
    const ctrl  = this.localPlayer.getComponent("PlayerController");
    const state = (ctrl && ctrl["state"]) ? ctrl["state"] : "SMALL";
    // PlayerController writes the facing flip into scaleX (±), so the sign IS
    // the facing direction.
    const facingRight = this.localPlayer.scaleX >= 0;

    this.myRef.set({
      x:            this.localPlayer.x,
      y:            this.localPlayer.y,
      facingRight:  facingRight,
      state:        state,
      ts:           Date.now(),
    }).catch(function () { /* swallow transient write errors */ });
  }

  private onRemote(snap: any) {
    const uid = snap.key;
    if (uid === this.myUid) { return; }    // ignore our own echo

    // 2-player cap: first non-self uid wins; ignore any others until it leaves.
    if (!this.ghostUid) {
      this.ghostUid = uid;
      this.spawnGhost();
    } else if (this.ghostUid !== uid) {
      return;
    }

    const data = snap.val();
    if (!data) { return; }
    if (typeof data.x === "number") { this.ghostTargetX = data.x; }
    if (typeof data.y === "number") { this.ghostTargetY = data.y; }
    this.ghostFacingRight = data.facingRight !== false;
    this.ghostIsBig       = data.state === "BIG";
  }

  private onRemoteLeft(snap: any) {
    const uid = snap.key;
    if (uid !== this.ghostUid) { return; }    // not the one we're tracking
    if (this.ghostNode && this.ghostNode.isValid) {
      this.ghostNode.destroy();
    }
    this.ghostNode = null;
    this.ghostUid  = null;
  }

  // ─── ghost node ──────────────────────────────────────────────────────────────

  private spawnGhost() {
    if (!this.localPlayer || !this.localPlayer.parent) { return; }

    // Build the ghost from scratch — DON'T cc.instantiate the Player, because
    // a cloned PlayerController/RigidBody would have its onLoad fire for one
    // frame before we could strip them (keyboard input wired, physics body
    // created, etc). A bare Sprite node is cleaner.
    const ghost  = new cc.Node("GhostPlayer");
    const sprite = ghost.addComponent(cc.Sprite);

    // Sprite frame: inspector override > copy the local player's current frame.
    let frame: cc.SpriteFrame = this.ghostSprite;
    if (!frame) {
      const localSprite = this.localPlayer.getComponent(cc.Sprite);
      if (localSprite) { frame = localSprite.spriteFrame; }
    }
    if (frame) { sprite.spriteFrame = frame; }

    // Mirror the local player's size + anchor so positions align 1:1.
    ghost.setContentSize(this.localPlayer.getContentSize());
    ghost.anchorX = this.localPlayer.anchorX;
    ghost.anchorY = this.localPlayer.anchorY;

    ghost.opacity = this.ghostOpacity;

    // Same parent → same coordinate frame as the local player.
    this.localPlayer.parent.addChild(ghost);

    // Seed pose from the latest snapshot so it doesn't appear at (0,0) first.
    ghost.x      = this.ghostTargetX;
    ghost.y      = this.ghostTargetY;
    ghost.scaleX = this.ghostFacingRight ? 1 : -1;
    ghost.scaleY = 1;

    this.ghostNode = ghost;
  }
}
