const Auth = require("Auth");
const RoomSync = require("RoomSync");

const { ccclass, property } = cc._decorator;

// Visual-only stand-in for a remote player. Driven entirely by network state;
// no physics, no input. Rendered semi-transparent.
interface Puppet {
  node: cc.Node;
  anim: cc.Animation;
  label: cc.Node;          // sibling Label node above the ghost's head
  sizeScale: number;       // 1 for SMALL, bigScale for BIG — used for label Y
  targetX: number;
  targetY: number;
  lastAnim: string;
  lastName: string;
  inited: boolean;
}

@ccclass("MultiplayerSync")
export default class MultiplayerSync extends cc.Component {

  // ─── inspector ───────────────────────────────────────────────────────────────

  @property({ tooltip: "Room code. Both players must enter the same value to meet." })
  roomId: string = "room1";

  @property({ type: cc.Node, tooltip: "The local player. Falls back to a node named 'Player'." })
  localPlayer: cc.Node = null;

  @property({ type: cc.Prefab, tooltip: "Optional. Visual prefab for remote players. If empty, the local player node is cloned." })
  remotePlayerPrefab: cc.Prefab = null;

  @property({ tooltip: "State updates sent to Firebase per second." })
  sendRate: number = 15;

  @property({ tooltip: "Remote movement smoothing. Higher = snappier, lower = smoother." })
  lerpSpeed: number = 12;

  @property({ tooltip: "Opacity (0-255) of remote-player ghosts. ~120 = semi-transparent." })
  ghostOpacity: number = 120;

  @property({ tooltip: "Y offset (px) of the username label above each ghost's origin." })
  nameLabelOffsetY: number = 28;

  @property({ tooltip: "Font size of the username label." })
  nameLabelFontSize: number = 14;

  // ─── state ───────────────────────────────────────────────────────────────────

  private myUid: string = null;
  private joined: boolean = false;
  private localPC: any = null;
  private bigScale: number = 1.5;   // mirrors PlayerController.bigScale, read in onLoad
  private puppets: { [uid: string]: Puppet } = {};

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    if (!this.localPlayer) {
      this.localPlayer = cc.find("Player");
    }
    if (this.localPlayer) {
      this.localPC = this.localPlayer.getComponent("PlayerController");
      if (this.localPC && typeof this.localPC.bigScale === "number") {
        this.bigScale = this.localPC.bigScale;
      }
    }
  }

  start() {
    if (!this.localPlayer) {
      cc.warn("[MultiplayerSync] No local player node; multiplayer disabled.");
      return;
    }

    const self = this;
    Auth.currentUser().then(function (user) {
      if (!user) {
        cc.warn("[MultiplayerSync] No logged-in user; multiplayer disabled.");
        return;
      }
      self.myUid = user.uid;
      const name = user.username || user.email || "Player";
      return RoomSync.join(self.roomId, user.uid, name, self.readLocalState()).then(function () {
        self.joined = true;
        RoomSync.on("playerJoined", function (d) { self.onRemoteUpsert(d.uid, d.state); });
        RoomSync.on("playerUpdate", function (d) { self.onRemoteUpsert(d.uid, d.state); });
        RoomSync.on("playerLeft",   function (d) { self.onRemoteLeft(d.uid); });
        const rate = self.sendRate > 0 ? self.sendRate : 15;
        self.schedule(self.tickSend, 1 / rate);
      });
    }).catch(function (e) {
      cc.warn("[MultiplayerSync] join failed:", e);
    });
  }

  onDestroy() {
    this.unschedule(this.tickSend);
    if (this.joined) {
      RoomSync.leave();
      this.joined = false;
    }
  }

  update(dt: number) {
    const t = Math.min(1, dt * this.lerpSpeed);
    for (const uid in this.puppets) {
      const p = this.puppets[uid];
      if (!p.node || !p.node.isValid) { continue; }
      p.node.x += (p.targetX - p.node.x) * t;
      p.node.y += (p.targetY - p.node.y) * t;
      // Label is a sibling node so it stays upright & full-opacity regardless
      // of the puppet's scaleX flip and ghost opacity. Track puppet position.
      if (p.label && p.label.isValid) {
        p.label.x = p.node.x;
        p.label.y = p.node.y + this.nameLabelOffsetY * p.sizeScale;
      }
    }
  }

  // ─── local → network ───────────────────────────────────────────────────────────

  private readLocalState() {
    const p = this.localPlayer;
    const net = (this.localPC && this.localPC.getNetState)
      ? this.localPC.getNetState()
      : { facingRight: true, anim: "idle", state: "SMALL" };
    return {
      x: p ? p.x : 0,
      y: p ? p.y : 0,
      facingRight: net.facingRight,
      anim: net.anim,
      state: net.state,
    };
  }

  private tickSend = () => {
    if (!this.joined || !this.localPlayer || !this.localPlayer.isValid) { return; }
    RoomSync.sendState(this.readLocalState());
  };

  // ─── network → remote puppets ───────────────────────────────────────────────────

  private onRemoteUpsert(uid: string, state: any) {
    if (!uid || uid === this.myUid || !state) { return; }

    let p = this.puppets[uid];
    if (!p) {
      p = this.createPuppet();
      if (!p) { return; }
      this.puppets[uid] = p;
    }

    if (typeof state.x === "number") { p.targetX = state.x; }
    if (typeof state.y === "number") { p.targetY = state.y; }

    // First update: snap into place instead of sliding in from the origin.
    if (!p.inited) {
      p.node.x = p.targetX;
      p.node.y = p.targetY;
      p.inited = true;
    }

    // scaleX carries facing-flip × size, scaleY carries size only — same shape
    // as PlayerController.update so the ghost mirrors growBig/shrink visually.
    const sizeScale = state.state === "BIG" ? this.bigScale : 1;
    const facingRight = state.facingRight !== false;   // default true
    p.node.scaleX = (facingRight ? 1 : -1) * sizeScale;
    p.node.scaleY = sizeScale;
    p.sizeScale = sizeScale;

    if (state.anim && state.anim !== p.lastAnim && p.anim) {
      if (p.anim.getAnimationState(state.anim)) {
        p.anim.play(state.anim);
        p.lastAnim = state.anim;
      }
    }

    // Username label — only touch the string when it actually changes.
    if (p.label && p.label.isValid && typeof state.name === "string" && state.name !== p.lastName) {
      const lbl = p.label.getComponent(cc.Label);
      if (lbl) { lbl.string = state.name; }
      p.lastName = state.name;
    }
  }

  private onRemoteLeft(uid: string) {
    const p = this.puppets[uid];
    if (p) {
      if (p.node  && p.node.isValid)  { p.node.destroy(); }
      if (p.label && p.label.isValid) { p.label.destroy(); }
    }
    delete this.puppets[uid];
  }

  private createPuppet(): Puppet | null {
    let node: cc.Node = null;

    if (this.remotePlayerPrefab) {
      node = cc.instantiate(this.remotePlayerPrefab);
    } else if (this.localPlayer) {
      node = cc.instantiate(this.localPlayer);
      this.stripToVisual(node);   // remove input/physics so it can't be controlled
    }
    if (!node) { return null; }

    node.name = "RemotePlayer";
    node.opacity = this.ghostOpacity;
    // Reset scale; size/facing are reapplied each onRemoteUpsert based on state.
    node.scaleX = 1;
    node.scaleY = 1;

    const parent = this.localPlayer && this.localPlayer.parent
      ? this.localPlayer.parent
      : this.node;
    parent.addChild(node);

    // Sibling label — kept outside the puppet so the puppet's scaleX flip
    // doesn't mirror the text, and the ghost opacity doesn't fade the name.
    const label = this.createNameLabel();
    parent.addChild(label);

    return {
      node: node,
      anim: node.getComponent(cc.Animation),
      label: label,
      sizeScale: 1,
      targetX: node.x,
      targetY: node.y,
      lastAnim: "",
      lastName: "",
      inited: false,
    };
  }

  private createNameLabel(): cc.Node {
    const n = new cc.Node("PlayerName");
    const lbl = n.addComponent(cc.Label);
    lbl.string = "";
    lbl.fontSize = this.nameLabelFontSize;
    lbl.lineHeight = this.nameLabelFontSize + 2;
    lbl.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
    lbl.verticalAlign = cc.Label.VerticalAlign.BOTTOM;
    n.color = cc.Color.WHITE;
    n.opacity = 230;
    return n;
  }

  // Strips a cloned player down to a pure visual: no controller, no rigid body,
  // no colliders. Done while the node is still detached so the removed
  // components' onLoad ideally never fires; we also disable them defensively
  // because removeComponent is deferred to end-of-frame in Cocos 2.4.
  private stripToVisual(node: cc.Node) {
    const pc = node.getComponent("PlayerController") as any;
    if (pc) { pc.enabled = false; node.removeComponent(pc); }

    const rb = node.getComponent(cc.RigidBody);
    if (rb) {
      // Belt-and-braces: even if the body lives for one frame, freeze it.
      rb.type = cc.RigidBodyType.Static;
      rb.enabled = false;
      node.removeComponent(rb);
    }

    const colliders = node.getComponents(cc.Collider);
    for (let i = 0; i < colliders.length; i++) {
      colliders[i].enabled = false;
      node.removeComponent(colliders[i]);
    }
  }
}
