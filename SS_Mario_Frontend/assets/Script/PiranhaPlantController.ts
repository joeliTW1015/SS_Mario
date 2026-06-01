const { ccclass, property } = cc._decorator;

@ccclass
export default class PiranhaPlantController extends cc.Component {

  @property({ tooltip: "單程移動距離 (px)" })
  moveDistance: number = 60;

  @property({ tooltip: "移動速度 (px/s)" })
  moveSpeed: number = 30;

  onLoad() {
    // Static body — not affected by gravity, just a sensor trigger.
    var rb = this.getComponent(cc.RigidBody);
    if (rb) {
      rb.enabledContactListener = true;
    }

    // Play idle animation on loop.
    var anim = this.getComponent(cc.Animation);
    if (anim) {
      var state = anim.getAnimationState("idle");
      if (state) {
        state.wrapMode = cc.WrapMode.Loop;
        anim.play("idle");
      }
    }

    // Tween-based vertical patrol: up → down → repeat.
    var dur = this.moveDistance / Math.max(this.moveSpeed, 1);
    cc.tween(this.node)
      .by(dur, { y: this.moveDistance })
      .by(dur, { y: -this.moveDistance })
      .union()
      .repeatForever()
      .start();
  }
}
