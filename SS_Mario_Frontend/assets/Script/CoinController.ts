import GameManager from "./GameManager";

const { ccclass, property } = cc._decorator;

// A collectible coin. Static sensor in the ITEM group: when the player
// touches it, score increases and the coin removes itself. Mirrors the
// SuperMushroom collection pattern (own onBeginContact detects PLAYER).

@ccclass
export default class CoinController extends cc.Component {

  @property({ tooltip: "此金幣的分數價值" })
  value: number = 100;

  @property(cc.AudioClip)
  sfxCollect: cc.AudioClip = null;

  private collected: boolean = false;

  onLoad() {
    var rb = this.getComponent(cc.RigidBody);
    if (rb) { rb.enabledContactListener = true; }

    // Optional spin animation (clip named "spin").
    var anim = this.getComponent(cc.Animation);
    if (anim) {
      var st = anim.getAnimationState("spin");
      if (st) {
        st.wrapMode = cc.WrapMode.Loop;
        anim.play("spin");
      }
    }
  }

  onBeginContact(contact: cc.PhysicsContact, self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
    if (this.collected) { return; }
    if (other.node.group !== "PLAYER") { return; }

    this.collected = true;

    var gm = GameManager.getInstance();
    if (gm) { gm.addScore(this.value); }

    if (this.sfxCollect) { cc.audioEngine.playEffect(this.sfxCollect, false); }
    if (this.node && this.node.isValid) { this.node.destroy(); }
  }
}
