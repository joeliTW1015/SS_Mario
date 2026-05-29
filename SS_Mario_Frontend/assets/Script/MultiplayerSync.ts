const Auth = require("Auth");
const RoomSync = require("RoomSync");

const { ccclass, property } = cc._decorator;

// Visual-only stand-in for a remote player. Driven entirely by network state;
// no physics, no input.
interface Puppet {
  node: cc.Node;
  anim: cc.Animation;
  baseScaleX: number;
  targetX: number;
  targetY: number;
  lastAnim: string;
  inited: boolean;
}

@ccclass
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

  // ─── state ───────────────────────────────────────────────────────────────────

  private myUid: string = null;
  private joined: boolean = false;
  private localPC: any = null;
  private puppets: { [uid: string]: Puppet } = {};

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    if (!this.localPlayer) {
      this.localPlayer = cc.find("Player");
    }
    if (this.localPlayer) {
      this.localPC = this.localPlayer.getComponent("PlayerController");
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

    if (typeof state.facingRight === "boolean") {
      p.node.scaleX = p.baseScaleX * (state.facingRight ? 1 : -1);
    }

    if (state.anim && state.anim !== p.lastAnim && p.anim) {
      if (p.anim.getAnimationState(state.anim)) {
        p.anim.play(state.anim);
        p.lastAnim = state.anim;
      }
    }
  }

  private onRemoteLeft(uid: string) {
    const p = this.puppets[uid];
    if (p && p.node && p.node.isValid) { p.node.destroy(); }
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
    node.opacity = 255;

    const parent = this.localPlayer && this.localPlayer.parent
      ? this.localPlayer.parent
      : this.node;
    parent.addChild(node);

    return {
      node: node,
      anim: node.getComponent(cc.Animation),
      baseScaleX: Math.abs(node.scaleX) || 1,
      targetX: node.x,
      targetY: node.y,
      lastAnim: "",
      inited: false,
    };
  }

  // Strips a cloned player down to a pure visual: no controller, no rigid body,
  // no colliders. Done while the node is still detached so onLoad never fires
  // for the removed components.
  private stripToVisual(node: cc.Node) {
    const pc = node.getComponent("PlayerController");
    if (pc) { node.removeComponent(pc); }

    const rb = node.getComponent(cc.RigidBody);
    if (rb) { node.removeComponent(rb); }

    const colliders = node.getComponents(cc.Collider);
    for (let i = 0; i < colliders.length; i++) {
      node.removeComponent(colliders[i]);
    }
  }
}
