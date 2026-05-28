import GameManager from "./GameManager";

const { ccclass, property } = cc._decorator;

@ccclass
export default class QuestionBlock extends cc.Component {

  // ─── inspector ───────────────────────────────────────────────────────────────

  @property(cc.Prefab)
  mushroomPrefab: cc.Prefab = null;

  @property(cc.SpriteFrame)
  emptySprite: cc.SpriteFrame = null;

  @property
  bounceHeight: number = 16;

  @property
  givesCoin: boolean = false;   // if true, add coin score instead of spawning mushroom

  @property
  coinScore: number = 200;

  // ─── state ───────────────────────────────────────────────────────────────────

  triggered: boolean = false;
  private originalY: number = 0;

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    this.originalY = this.node.y;
    // onBeginContact below is auto-called by physics manager.
  }

  // ─── physics contact ─────────────────────────────────────────────────────────

  onBeginContact(contact: cc.PhysicsContact, self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
    if (this.triggered) { return; }
    if (other.node.group !== "PLAYER") { return; }

    // Detect hit from below: player center must be below this block's center
    const playerWorldY = other.node.convertToWorldSpaceAR(cc.v2(0, 0)).y;
    const blockWorldY  = this.node.convertToWorldSpaceAR(cc.v2(0, 0)).y;

    if (playerWorldY < blockWorldY - 8) {
      this.triggerBlock();
    }
  }

  // ─── trigger logic ───────────────────────────────────────────────────────────

  triggerBlock() {
    if (this.triggered) { return; }
    this.triggered = true;

    // Bounce tween
    const self = this;
    cc.tween(this.node)
      .by(0.08, { y: this.bounceHeight })
      .by(0.08, { y: -this.bounceHeight })
      .call(function () {
        self.node.y = self.originalY;
        self.onBounceComplete();
      })
      .start();
  }

  private onBounceComplete() {
    // Swap to empty sprite
    if (this.emptySprite) {
      const sprite = this.node.getComponent(cc.Sprite);
      if (sprite) { sprite.spriteFrame = this.emptySprite; }
    }

    const gm = GameManager.getInstance();

    if (this.givesCoin || !this.mushroomPrefab) {
      // Coin block: just add score
      if (gm) { gm.addScore(this.coinScore); }
    } else {
      // Spawn mushroom slightly above block
      const mushroom = cc.instantiate(this.mushroomPrefab);
      const parent = this.node.parent;
      parent.addChild(mushroom);

      // Position above block in world space
      const blockWorld = this.node.convertToWorldSpaceAR(cc.v2(0, 0));
      const localPos   = parent.convertToNodeSpaceAR(
        cc.v2(blockWorld.x, blockWorld.y + this.node.height)
      );
      mushroom.setPosition(localPos);

      if (gm) { gm.addScore(this.coinScore); }
    }
  }
}
