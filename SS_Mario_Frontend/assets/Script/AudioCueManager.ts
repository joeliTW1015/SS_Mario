const A11y = require("AccessibilitySettings");
const SpatialAudio = require("SpatialAudio");

const { ccclass, property } = cc._decorator;

// One running voice per tracked enemy. Pan/volume re-tuned every frame
// from the player↔enemy delta. Voices are torn down when the enemy node
// is destroyed (e.g. stomped) or out of audible range.
interface Cue {
  node: cc.Node;
  voiceId: number;          // 0 = not currently sounding
  freq: number;
}

@ccclass
export default class AudioCueManager extends cc.Component {

  @property({ tooltip: "Frequency for Goomba proximity cue (Hz)." })
  goombaFreq: number = 200;

  @property({ tooltip: "Frequency for Turtle proximity cue (Hz)." })
  turtleFreq: number = 280;

  @property({ tooltip: "Default frequency for any other enemy (Hz)." })
  defaultFreq: number = 240;

  @property({ tooltip: "How often to rescan the scene tree for new enemies (sec)." })
  rescanInterval: number = 1.0;

  private localPlayer: cc.Node = null;
  private cues: Cue[] = [];
  private unsub: () => void = null;

  onLoad() {
    this.localPlayer = this.findPlayer();
    if (!this.localPlayer) {
      cc.warn("[AudioCueManager] No 'Player' node found; cues disabled.");
      return;
    }
    this.rescan();
    this.schedule(this.rescan, this.rescanInterval);

    // React to enable/disable from the settings panel.
    this.unsub = A11y.subscribe((key: string) => {
      if (key === "audioCuesEnabled" || key === null) {
        if (!A11y.get("audioCuesEnabled")) { this.stopAll(); }
      }
    });
  }

  onDestroy() {
    this.unschedule(this.rescan);
    if (this.unsub) { this.unsub(); this.unsub = null; }
    this.stopAll();
  }

  update(_dt: number) {
    if (!this.localPlayer || !this.localPlayer.isValid) { return; }
    const enabled = A11y.get("audioCuesEnabled");
    const peak    = A11y.get("audioCueVolume");
    const range   = A11y.get("audioCueRange");

    const px = this.localPlayer.x;
    const py = this.localPlayer.y;

    for (let i = this.cues.length - 1; i >= 0; i--) {
      const c = this.cues[i];
      if (!c.node || !c.node.isValid) {
        if (c.voiceId) { SpatialAudio.stop(c.voiceId); }
        this.cues.splice(i, 1);
        continue;
      }
      if (!enabled) {
        if (c.voiceId) { SpatialAudio.stop(c.voiceId); c.voiceId = 0; }
        continue;
      }

      const dx = c.node.x - px;
      const dy = c.node.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const t = Math.max(0, 1 - dist / range);   // 1 close, 0 far
      const volume = peak * t * t;               // quadratic fall-off feels right
      // Pan: clamp dx normalised by range so enemies at the edge are fully panned.
      const pan = Math.max(-1, Math.min(1, dx / (range * 0.5)));

      if (volume <= 0.001) {
        if (c.voiceId) { SpatialAudio.stop(c.voiceId); c.voiceId = 0; }
      } else if (!c.voiceId) {
        c.voiceId = SpatialAudio.startTone({
          freq: c.freq, type: "sine", pan: pan, volume: volume, attack: 0.08,
        });
      } else {
        SpatialAudio.update(c.voiceId, { pan: pan, volume: volume });
      }
    }
  }

  // ─── enemy discovery ───────────────────────────────────────────────────────────

  private rescan = () => {
    const scene = cc.director.getScene();
    if (!scene) { return; }
    const seen: { [key: string]: boolean } = {};
    for (let i = 0; i < this.cues.length; i++) {
      seen[(this.cues[i].node as any).uuid] = true;
    }
    this.collect(scene as any as cc.Node, seen);
  };

  private collect(node: cc.Node, seen: { [key: string]: boolean }) {
    if (!node) { return; }
    if (node.group === "ENEMY" && !seen[(node as any).uuid]) {
      const freq = this.frequencyFor(node);
      this.cues.push({ node: node, voiceId: 0, freq: freq });
    }
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
      this.collect(children[i], seen);
    }
  }

  private frequencyFor(node: cc.Node): number {
    // Crude type sniff by component name — the project's enemy controllers
    // are GoombaController, TurtleController, etc.
    if (node.getComponent("GoombaController")) { return this.goombaFreq; }
    if (node.getComponent("TurtleController")) { return this.turtleFreq; }
    return this.defaultFreq;
  }

  // ─── helpers ───────────────────────────────────────────────────────────────────

  private findPlayer(): cc.Node {
    const direct = cc.find("Player");
    if (direct) { return direct; }
    return this.findByName(cc.director.getScene() as any, "Player");
  }

  private findByName(root: cc.Node, name: string): cc.Node {
    if (!root) { return null; }
    if (root.name === name) { return root; }
    const ch = root.children;
    for (let i = 0; i < ch.length; i++) {
      const found = this.findByName(ch[i], name);
      if (found) { return found; }
    }
    return null;
  }

  private stopAll() {
    for (let i = 0; i < this.cues.length; i++) {
      if (this.cues[i].voiceId) {
        SpatialAudio.stop(this.cues[i].voiceId);
        this.cues[i].voiceId = 0;
      }
    }
  }
}
