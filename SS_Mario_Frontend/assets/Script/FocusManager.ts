const A11y = require("AccessibilitySettings");

const { ccclass } = cc._decorator;

const KEY_TAB    = cc.macro.KEY.tab;
const KEY_ENTER  = cc.macro.KEY.enter;
const KEY_SPACE  = cc.macro.KEY.space;
const KEY_SHIFT  = cc.macro.KEY.shift;
const KEY_ESC    = cc.macro.KEY.escape;

// Single persistent component that supplies keyboard navigation +
// visible focus to every scene. Auto-discovers cc.Button and cc.EditBox
// nodes in the active scene whenever a scene launches.
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

  private focusables: cc.Node[] = [];
  private focusedIndex: number = -1;
  private shiftHeld: boolean = false;
  private indicator: cc.Node = null;
  // Document-level keydown handler for Tab interception (browser only). Stored
  // so we can removeEventListener cleanly in onDestroy.
  private _docKeyHandler: (e: KeyboardEvent) => void = null;

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  onLoad() {
    cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP,   this.onKeyUp,   this);
    cc.director.on(cc.Director.EVENT_AFTER_SCENE_LAUNCH, this.rescan, this);

    // Document-level Tab capture. cc.systemEvent cannot preventDefault, so the
    // browser would otherwise hand Tab to the address bar / dev tools / the
    // next HTML element in tab order — and once an EditBox's <input> has
    // native focus, Tab inside it follows the browser's tab order, not ours.
    // We capture Tab at the document level (capture phase = true so we beat
    // any <input> handler), preventDefault, and steer through our own list.
    if (cc.sys.isBrowser && typeof document !== "undefined") {
      const self = this;
      this._docKeyHandler = function (e: KeyboardEvent) {
        if (e.key === "Tab") {
          e.preventDefault();
          self.shiftHeld = e.shiftKey;
          self.move(e.shiftKey ? -1 : 1);
        }
      };
      document.addEventListener("keydown", this._docKeyHandler, true);
    }

    // Initial scan for the current scene (the one we were just ensured into).
    this.rescan();
  }

  onDestroy() {
    cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP,   this.onKeyUp,   this);
    cc.director.off(cc.Director.EVENT_AFTER_SCENE_LAUNCH, this.rescan, this);
    if (this._docKeyHandler && typeof document !== "undefined") {
      document.removeEventListener("keydown", this._docKeyHandler, true);
      this._docKeyHandler = null;
    }
    if (FocusManager._instance === this) { FocusManager._instance = null; }
  }

  // ─── scanning ────────────────────────────────────────────────────────────────

  rescan() {
    this.focusables = [];
    const scene = cc.director.getScene();
    if (!scene) { return; }
    this.collect(scene as any as cc.Node);

    // Drop our own indicator (and the FocusManager node) if any sneaks in.
    this.focusables = this.focusables.filter((n) => n !== this.node && n !== this.indicator);

    // Stable order: roughly top-to-bottom, left-to-right by world Y desc, X asc.
    this.focusables.sort((a, b) => {
      const ap = a.convertToWorldSpaceAR(cc.v2(0, 0));
      const bp = b.convertToWorldSpaceAR(cc.v2(0, 0));
      if (Math.abs(ap.y - bp.y) > 4) { return bp.y - ap.y; }   // higher Y first
      return ap.x - bp.x;
    });

    this.focusedIndex = this.focusables.length > 0 ? 0 : -1;
    this.refreshIndicator();

    // Push native focus to the first focusable so the HTML <input> behind an
    // EditBox actually receives keystrokes immediately — without this, the
    // yellow border appears on the Email field but typing does nothing until
    // the user presses Tab once.
    if (this.focusedIndex >= 0) {
      this.tryNativeFocus(this.focusables[this.focusedIndex]);
    }
  }

  private collect(node: cc.Node) {
    if (!node || !node.active) { return; }
    const isButton  = !!node.getComponent(cc.Button);
    const isEditBox = !!node.getComponent(cc.EditBox);
    if (isButton || isEditBox) { this.focusables.push(node); }
    const ch = node.children;
    for (let i = 0; i < ch.length; i++) { this.collect(ch[i]); }
  }

  // ─── input ───────────────────────────────────────────────────────────────────

  private onKeyDown(e: cc.Event.EventKeyboard) {
    if (e.keyCode === KEY_SHIFT) { this.shiftHeld = true; return; }
    if (e.keyCode === KEY_TAB) {
      // Note: cc.systemEvent.onKeyDown can't preventDefault — the browser
      // will still Tab the canvas itself. Acceptable for this menu UX.
      if (this.focusables.length === 0) { return; }
      this.move(this.shiftHeld ? -1 : 1);
      return;
    }
    if (e.keyCode === KEY_ENTER || e.keyCode === KEY_SPACE) {
      // Don't hijack space while playing — only when focus is on a button.
      const cur = this.current();
      if (cur && cur.getComponent(cc.Button)) {
        this.activate();
      }
      return;
    }
  }

  private onKeyUp(e: cc.Event.EventKeyboard) {
    if (e.keyCode === KEY_SHIFT) { this.shiftHeld = false; }
  }

  // ─── focus movement ──────────────────────────────────────────────────────────

  private current(): cc.Node {
    if (this.focusedIndex < 0 || this.focusedIndex >= this.focusables.length) { return null; }
    const n = this.focusables[this.focusedIndex];
    return (n && n.isValid && n.active) ? n : null;
  }

  private move(delta: number) {
    const n = this.focusables.length;
    if (n === 0) { return; }
    let i = this.focusedIndex;
    for (let step = 0; step < n; step++) {
      i = (i + delta + n) % n;
      const node = this.focusables[i];
      if (node && node.isValid && node.active) {
        this.focusedIndex = i;
        this.refreshIndicator();
        this.tryNativeFocus(node);
        return;
      }
    }
  }

  private activate() {
    const node = this.current();
    if (!node) { return; }
    const btn = node.getComponent(cc.Button);
    if (btn && btn.interactable) {
      node.emit("click", btn);
    }
  }

  // For cc.EditBox the underlying HTML input lives at ._impl._edTxt
  // in Cocos 2.4.x. Focusing it lets the user start typing immediately
  // when Tab lands on the field.
  //
  // When we move TO a non-EditBox (a button), we also blur whatever HTML
  // element currently holds DOM focus — otherwise the previously-focused
  // <input> keeps receiving keystrokes even though the logical focus has
  // moved on, and Tab inside that input still follows the browser's order.
  private tryNativeFocus(node: cc.Node) {
    const eb = node.getComponent(cc.EditBox) as any;
    if (!eb) {
      if (typeof document !== "undefined" && document.activeElement) {
        const ae = document.activeElement as HTMLElement;
        if (ae && typeof ae.blur === "function") {
          try { ae.blur(); } catch (e) { /* ignore */ }
        }
      }
      return;
    }
    const impl = eb._impl;
    const input = impl && (impl._edTxt || impl._edFnt);
    if (input && typeof input.focus === "function") {
      try { input.focus(); } catch (e) { /* ignore */ }
    }
  }

  // ─── visible focus border ────────────────────────────────────────────────────

  private ensureIndicator(): cc.Node {
    if (this.indicator && this.indicator.isValid) { return this.indicator; }
    const n = new cc.Node("FocusBorder");
    n.addComponent(cc.Graphics);
    this.indicator = n;
    // Gentle breathing pulse so the focused element is unmissable even at
    // low viewport sizes. ~0.6 s per phase = noticeable but not distracting.
    cc.tween(n)
      .to(0.6, { opacity: 160 })
      .to(0.6, { opacity: 255 })
      .union()
      .repeatForever()
      .start();
    return n;
  }

  private refreshIndicator() {
    const show = A11y.get("showFocusIndicator");
    const cur = this.current();
    if (!show || !cur) {
      if (this.indicator && this.indicator.isValid) { this.indicator.active = false; }
      return;
    }
    const ind = this.ensureIndicator();
    if (ind.parent !== cur.parent) {
      ind.removeFromParent(false);
      cur.parent.addChild(ind);
    }
    ind.active = true;
    ind.x = cur.x;
    ind.y = cur.y;
    ind.anchorX = cur.anchorX;
    ind.anchorY = cur.anchorY;
    ind.zIndex = (cur.zIndex || 0) + 1;

    // Two-layer border: chunky yellow outer + thin white inner so it pops
    // against any background colour. 12 px padding clearly separates the
    // border from the focused element.
    const pad = 12;
    const w = cur.width  + pad;
    const h = cur.height + pad;
    const x0 = -w * cur.anchorX;
    const y0 = -h * cur.anchorY;
    const g = ind.getComponent(cc.Graphics);
    g.clear();

    // Outer yellow
    g.strokeColor = cc.Color.YELLOW;
    g.lineWidth = 5;
    g.rect(x0, y0, w, h);
    g.stroke();

    // Inner white (inset 3 px)
    const inset = 3;
    g.strokeColor = cc.Color.WHITE;
    g.lineWidth = 2;
    g.rect(x0 + inset, y0 + inset, w - inset * 2, h - inset * 2);
    g.stroke();
  }
}
