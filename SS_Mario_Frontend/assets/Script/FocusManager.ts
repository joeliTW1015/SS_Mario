const A11y      = require("AccessibilitySettings");
const A11yBridge = require("A11yBridge");

const { ccclass } = cc._decorator;

// Visual focus indicator for keyboard navigation.
//
// Bypass strategy: cc.systemEvent doesn't expose the raw KeyboardEvent so
// we can't preventDefault — and the canvas can't receive native focus —
// so all keyboard nav goes through A11yBridge's invisible DOM buttons
// instead. The browser handles Tab/Enter/Space natively (correct focus
// order, ARIA, preventDefault, IME safety, the lot).
//
// What's left for FocusManager: paint a Cocos-side yellow border on the
// cc.Button that matches whichever DOM bridge button currently has focus,
// so sighted keyboard users see where they are. Also draws the border on
// focused cc.EditBox (already a native input).

@ccclass
export default class FocusManager extends cc.Component {

  private static _instance: FocusManager = null;

  /** Idempotent: creates the persistent FocusManager node if it doesn't exist. */
  static ensure(): FocusManager {
    if (FocusManager._instance && FocusManager._instance.isValid) {
      return FocusManager._instance;
    }
    const scene = cc.director.getScene();
    if (!scene) { return null; }
    const node = new cc.Node("FocusManager");
    scene.addChild(node);
    try { cc.game.addPersistRootNode(node); }
    catch (e) { cc.warn("[FocusManager] addPersistRootNode failed:", e); }
    const comp = node.addComponent(FocusManager);
    FocusManager._instance = comp;
    return comp;
  }

  // ─── state ───────────────────────────────────────────────────────────────────

  private indicator: cc.Node = null;
  private focused: cc.Node = null;
  private unsubBridge: () => void = null;
  private unsubA11y: () => void = null;
  private domFocusInHandler: (e: FocusEvent) => void = null;

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    // Hook the bridge's focus events for buttons.
    this.unsubBridge = A11yBridge.onFocusChange((node: cc.Node) => {
      this.setFocused(node);
    });

    // For cc.EditBox: native <input> elements fire focusin too. Reflect
    // them in our Cocos-side border so all focusable controls look the same.
    if (typeof document !== "undefined") {
      this.domFocusInHandler = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (!target || (target as any).dataset && (target as any).dataset.bridge) {
          // Bridge buttons go through A11yBridge.onFocusChange already.
          return;
        }
        const ccNode = this.findCcNodeForDomInput(target);
        if (ccNode) { this.setFocused(ccNode); }
      };
      document.addEventListener("focusin", this.domFocusInHandler, true);
    }

    // Refresh the border when the user toggles its visibility in settings.
    this.unsubA11y = A11y.subscribe((key: string) => {
      if (key === "showFocusIndicator" || key === null) { this.refresh(); }
    });
  }

  onDestroy() {
    if (this.unsubBridge) { this.unsubBridge(); this.unsubBridge = null; }
    if (this.unsubA11y)   { this.unsubA11y();   this.unsubA11y   = null; }
    if (typeof document !== "undefined" && this.domFocusInHandler) {
      document.removeEventListener("focusin", this.domFocusInHandler, true);
      this.domFocusInHandler = null;
    }
    if (FocusManager._instance === this) { FocusManager._instance = null; }
  }

  update(_dt: number) {
    // Keep the indicator stuck to the focused node — it may animate.
    if (this.focused && this.focused.isValid && this.indicator && this.indicator.isValid) {
      this.position(this.focused);
    }
  }

  // ─── focus state ─────────────────────────────────────────────────────────────

  private setFocused(node: cc.Node) {
    this.focused = node;
    this.refresh();
  }

  private refresh() {
    const show = A11y.get("showFocusIndicator");
    if (!show || !this.focused || !this.focused.isValid) {
      if (this.indicator && this.indicator.isValid) { this.indicator.active = false; }
      return;
    }
    this.ensureIndicator();
    this.indicator.active = true;
    this.position(this.focused);
  }

  private ensureIndicator() {
    if (this.indicator && this.indicator.isValid) { return; }
    const n = new cc.Node("FocusBorder");
    const g = n.addComponent(cc.Graphics);
    g.strokeColor = cc.Color.YELLOW;
    g.lineWidth = 3;
    this.indicator = n;
  }

  private position(target: cc.Node) {
    if (!target || !target.parent) { return; }
    const ind = this.indicator;
    if (ind.parent !== target.parent) {
      ind.removeFromParent(false);
      target.parent.addChild(ind);
    }
    ind.x = target.x;
    ind.y = target.y;
    ind.anchorX = target.anchorX;
    ind.anchorY = target.anchorY;
    ind.zIndex = (target.zIndex || 0) + 1;

    const w = target.width + 8;
    const h = target.height + 8;
    const g = ind.getComponent(cc.Graphics);
    g.clear();
    g.rect(-w * target.anchorX, -h * target.anchorY, w, h);
    g.stroke();
  }

  // Map a focused <input> back to its cc.EditBox node. In Cocos 2.4 the
  // EditBox's underlying input is stored at editBox._impl._edTxt — we
  // walk the scene tree comparing references.
  private findCcNodeForDomInput(input: HTMLElement): cc.Node {
    const scene = cc.director.getScene();
    if (!scene) { return null; }
    return this.search(scene as any as cc.Node, input);
  }

  private search(root: cc.Node, input: HTMLElement): cc.Node {
    if (!root) { return null; }
    const eb = root.getComponent(cc.EditBox) as any;
    if (eb && eb._impl && (eb._impl._edTxt === input || eb._impl._edFnt === input)) {
      return root;
    }
    const ch = root.children;
    for (let i = 0; i < ch.length; i++) {
      const found = this.search(ch[i], input);
      if (found) { return found; }
    }
    return null;
  }
}
